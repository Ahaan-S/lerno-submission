import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getChapterLimitForSubject, getStudyFeedSubjectLabelsForGrade } from '@/lib/chapters'

// ─── Types ────────────────────────────────────────────────────────────────────

interface StudyQuestion {
    id: string
    question_code: string
    grade: number
    subject: string
    chapter_index: number
    chapter_name: string
    topic_index: string
    topic_name: string
    question_type: string
    question_text: string
    has_image: boolean
    question_image_url: string | null
    marks: number
    difficulty: string
    estimated_time_secs: number
    bloom_level: string | null
    options: Array<{ id: string; text: string; is_correct: boolean; image_url?: string }> | null
    correct_option: string | null
    blank_answer: string | null
    blank_answers_alt: string[] | null
    blank_tolerance: string | null
    numeric_range: Record<string, number> | null
    match_left: string[] | null
    match_right: string[] | null
    match_correct: Record<string, number> | null
    model_answer: string | null
    key_points: string[] | null
    marking_scheme: Array<{ point: string; marks: number }> | null
    min_words: number | null
    hints: string[] | null
    solution_text: string | null
    solution_steps: Array<{ step: number; text: string; explanation: string }> | null
    solution_image_url: string | null
    common_mistakes: string[] | null
    source: string
    pyq_year: number | null
    pyq_set_code: string | null
    sqp_year: number | null
    sqp_set_code: string | null
    ncert_ref: string | null
    /** Multi-part prompts (case study, some long_ans / 4-markers); jsonb in DB */
    sub_parts: Array<Record<string, unknown>> | null
    concept_tags: string[] | null
    times_attempted: number
    times_correct: number
    avg_time_secs: number | null
}

interface LastAttempt {
    question_id: string
    attempted_at: string
    is_correct: boolean | null
    interaction_type: string
}

interface ScoredQuestion extends StudyQuestion {
    _score: number
    _last_attempted_at: string | null
    _last_result: boolean | null
    _last_interaction: string | null
}

const STUDY_QUESTION_COLS = 'id,question_code,grade,subject,chapter_index,chapter_name,topic_index,topic_name,question_type,question_text,has_image,question_image_url,marks,difficulty,estimated_time_secs,bloom_level,options,correct_option,blank_answer,blank_answers_alt,blank_tolerance,numeric_range,match_left,match_right,match_correct,model_answer,key_points,marking_scheme,min_words,hints,solution_text,solution_steps,solution_image_url,common_mistakes,source,pyq_year,pyq_set_code,sqp_year,sqp_set_code,ncert_ref,sub_parts,concept_tags,times_attempted,times_correct,avg_time_secs'

/** profiles.grade may be 10, "10", or "Class 10" (text); study_questions.grade is int. */
function parseProfileGrade(raw: unknown): number | null {
    if (raw == null) return null
    if (typeof raw === 'number' && Number.isFinite(raw)) {
        const n = Math.round(raw)
        return n >= 1 && n <= 12 ? n : null
    }
    if (typeof raw === 'string') {
        const t = raw.trim()
        if (!t) return null
        const classMatch = t.match(/^class\s*(\d{1,2})\b/i)
        if (classMatch) {
            const n = parseInt(classMatch[1], 10)
            return n >= 1 && n <= 12 ? n : null
        }
        const n = parseInt(t.replace(/\D/g, '') || 'NaN', 10)
        if (!Number.isNaN(n) && n >= 1 && n <= 12) return n
    }
    return null
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function noveltyScore(lastAttemptedAt: string | null): number {
    if (!lastAttemptedAt) return 0.40 // never attempted

    const daysSince = (Date.now() - new Date(lastAttemptedAt).getTime()) / (1000 * 60 * 60 * 24)

    if (daysSince >= 30) return 0.25
    if (daysSince >= 7) {
        // Linear: 7 days → 0.10, 30 days → 0.25
        return 0.10 + ((daysSince - 7) / 23) * 0.15
    }
    // Linear: 0 days → 0.00, 7 days → 0.10
    return (daysSince / 7) * 0.10
}

function spacedRepetitionScore(lastInteraction: string | null, lastResult: boolean | null): number {
    if (!lastInteraction) return 0
    if (lastInteraction === 'answered') {
        return lastResult === false ? 0.25 : -0.15
    }
    if (lastInteraction === 'skipped') return 0.10
    if (lastInteraction === 'marked_as_done') return 0.05
    return 0
}

function qualityScore(q: StudyQuestion): number {
    if (q.times_attempted < 5) return 0.10
    return (q.times_correct / q.times_attempted) * 0.20
}

function pyqRecencyScore(q: StudyQuestion): number {
    if (q.source === 'pyq' && q.pyq_year) {
        if (q.pyq_year >= 2024) return 0.15
        if (q.pyq_year >= 2020) return 0.10
        if (q.pyq_year >= 2015) return 0.06
        return 0.03
    }
    if (q.source === 'ncert_exercise' || q.source === 'ncert_exemplar') return 0.10
    if (q.source === 'ncert_intext') return 0.08
    if (q.source === 'ai_generated') return 0.05
    if (q.source === 'sqp') return 0.15
    return 0.07 // fallback
}

function scoreQuestion(
    q: StudyQuestion,
    lastAttempt: LastAttempt | undefined,
    weakTopics: ReadonlySet<string>,
    strongTopics: ReadonlySet<string>,
    sessionAccuracy: number | null,
    questionsAttempted: number,
    consecutiveWrongs: number,
): ScoredQuestion {
    const lastAttemptedAt = lastAttempt?.attempted_at ?? null
    const lastInteraction = lastAttempt?.interaction_type ?? null
    const lastResult = lastAttempt?.is_correct ?? null

    // Personal mastery boost: surface weak topics, gently deprioritise mastered ones
    let topicBoost = 0
    if (weakTopics.has(q.topic_name)) topicBoost = 0.15
    else if (strongTopics.has(q.topic_name)) topicBoost = -0.05

    // Difficulty adaptation: steer toward easier questions when struggling, harder when excelling
    let difficultyBoost = 0
    if (sessionAccuracy !== null) {
        if (sessionAccuracy < 0.4 && q.difficulty === 'easy') difficultyBoost = 0.10
        else if (sessionAccuracy > 0.7 && q.difficulty === 'hard') difficultyBoost = 0.10
    }

    // Warm-up: first 3 questions of a session lean accessible — build early momentum + streak
    let warmupBoost = 0
    if (questionsAttempted < 3 && (q.difficulty === 'easy' || q.difficulty === 'medium')) {
        warmupBoost = 0.20
    }

    // Momentum recovery: after 2+ consecutive wrong answers, float a question this student
    // has previously answered correctly so they can rebuild confidence before the next hard one
    let momentumBoost = 0
    if (consecutiveWrongs >= 2 && lastResult === true) {
        momentumBoost = 0.25
    }

    const score =
        noveltyScore(lastAttemptedAt) +
        spacedRepetitionScore(lastInteraction, lastResult) +
        qualityScore(q) +
        pyqRecencyScore(q) +
        topicBoost +
        difficultyBoost +
        warmupBoost +
        momentumBoost +
        Math.random() * 0.18 // jitter so ordering is not dominated by one chapter / source

    return {
        ...q,
        _score: score,
        _last_attempted_at: lastAttemptedAt,
        _last_result: lastResult,
        _last_interaction: lastInteraction,
    }
}

// ─── Pool building: avoid one-chapter dominance ────────────────────────────────
// A single LIMIT without ORDER BY often returns rows in insertion / index order.
// Bulk inserts are usually chapter-by-chapter, so the first N rows skew to chapter 1.

const MAX_CHAPTER_INDEX = 18
const PER_CHAPTER_FETCH = 32
const SCORING_POOL_TARGET = 220

function shuffleInPlace<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
}

/** Interleave chapters so the scoring pool is mixed before sort-by-score. */
function roundRobinPickByChapter(questions: StudyQuestion[], target: number): StudyQuestion[] {
    const byCh = new Map<number, StudyQuestion[]>()
    for (const q of questions) {
        const list = byCh.get(q.chapter_index) ?? []
        list.push(q)
        byCh.set(q.chapter_index, list)
    }
    for (const list of byCh.values()) {
        shuffleInPlace(list)
    }
    const chOrder = [...byCh.keys()]
    shuffleInPlace(chOrder)
    const out: StudyQuestion[] = []
    while (out.length < target) {
        let progressed = false
        for (const ch of chOrder) {
            const list = byCh.get(ch)
            if (list && list.length > 0) {
                const next = list.pop()
                if (next) {
                    out.push(next)
                    progressed = true
                }
                if (out.length >= target) break
            }
        }
        if (!progressed) break
    }
    return out
}

type SupabaseServer = Awaited<ReturnType<typeof createClient>>

async function fetchStratifiedPool(
    supabase: SupabaseServer,
    opts: {
        userGrade: number
        subjects: string[]
        chaptersFilter: number[]
        difficulties: string[]
        questionTypes: string[]
        marks: number[]
        sources: string[]
        excludeIds: string[]
    },
): Promise<StudyQuestion[]> {
    const { userGrade, subjects, chaptersFilter, difficulties, questionTypes, marks, sources, excludeIds } = opts
    const chapterList =
        chaptersFilter.length > 0
            ? chaptersFilter
            : Array.from({ length: MAX_CHAPTER_INDEX }, (_, i) => i + 1)

    const runChapter = async (chapterIndex: number): Promise<StudyQuestion[]> => {
        let q = supabase
            .from('study_questions')
            .select(STUDY_QUESTION_COLS)
            .eq('is_active', true)
            .eq('grade', userGrade)
            .eq('chapter_index', chapterIndex)
            .limit(PER_CHAPTER_FETCH)
        if (subjects.length > 0) q = q.in('subject', subjects)
        if (difficulties.length > 0) q = q.in('difficulty', difficulties)
        if (questionTypes.length > 0) q = q.in('question_type', questionTypes)
        if (marks.length > 0) q = q.in('marks', marks)
        if (sources.length > 0) q = q.in('source', sources)
        if (excludeIds.length > 0) q = q.not('id', 'in', `(${excludeIds.join(',')})`)
        const { data, error } = await q
        if (error) {
            console.error('[study/feed] Stratified fetch failed ch', chapterIndex, error.message)
            return []
        }
        return (data ?? []) as StudyQuestion[]
    }

    const chunks = await Promise.all(chapterList.map(runChapter))
    const seen = new Set<string>()
    const merged: StudyQuestion[] = []
    for (const rows of chunks) {
        for (const row of rows) {
            if (!seen.has(row.id)) {
                seen.add(row.id)
                merged.push(row)
            }
        }
    }
    return merged
}

async function fetchSinglePool(
    supabase: SupabaseServer,
    opts: {
        userGrade: number
        subjects: string[]
        chaptersFilter: number[]
        difficulties: string[]
        questionTypes: string[]
        marks: number[]
        sources: string[]
        excludeIds: string[]
        limit: number
    },
): Promise<StudyQuestion[]> {
    const { userGrade, subjects, chaptersFilter, difficulties, questionTypes, marks, sources, excludeIds, limit } = opts
    let q = supabase
        .from('study_questions')
        .select(STUDY_QUESTION_COLS)
        .eq('is_active', true)
        .eq('grade', userGrade)
        .limit(limit)
    if (subjects.length > 0) q = q.in('subject', subjects)
    if (chaptersFilter.length > 0) q = q.in('chapter_index', chaptersFilter)
    if (difficulties.length > 0) q = q.in('difficulty', difficulties)
    if (questionTypes.length > 0) q = q.in('question_type', questionTypes)
    if (marks.length > 0) q = q.in('marks', marks)
    if (sources.length > 0) q = q.in('source', sources)
    if (excludeIds.length > 0) q = q.not('id', 'in', `(${excludeIds.join(',')})`)
    const { data, error } = await q
    if (error) throw error
    return (data ?? []) as StudyQuestion[]
}

// ─── Diversity pass ───────────────────────────────────────────────────────────

function diversityPass(sorted: ScoredQuestion[], batchSize: number): ScoredQuestion[] {
    const result: ScoredQuestion[] = []
    const remaining = [...sorted]

    while (result.length < batchSize && remaining.length > 0) {
        const recentTopics = result.slice(-2).map(q => q.topic_name)
        const recentTypes = result.slice(-3).map(q => q.question_type)
        const recentChapters = result.slice(-2).map(q => q.chapter_index)
        const recentDifficulties = result.slice(-2).map(q => q.difficulty)

        const topicViolation = recentTopics.length === 2 && recentTopics.every(t => t === recentTopics[0])
        const typeViolation = recentTypes.length === 3 && recentTypes.every(t => t === recentTypes[0])
        const chapterViolation = recentChapters.length === 2 && recentChapters[0] === recentChapters[1]
        // Cap consecutive hard questions at 2 — board exams have mixed difficulty, not hard-only runs
        const hardRunViolation = recentDifficulties.length === 2 && recentDifficulties.every(d => d === 'hard')

        let pickedIdx = -1
        for (let i = 0; i < remaining.length; i++) {
            const candidate = remaining[i]
            const wouldRepeatTopic = topicViolation && candidate.topic_name === recentTopics[0]
            const wouldRepeatType = typeViolation && candidate.question_type === recentTypes[0]
            const wouldRepeatChapter = chapterViolation && candidate.chapter_index === recentChapters[1]
            const wouldExtendHardRun = hardRunViolation && candidate.difficulty === 'hard'
            if (!wouldRepeatTopic && !wouldRepeatType && !wouldRepeatChapter && !wouldExtendHardRun) {
                pickedIdx = i
                break
            }
        }

        if (pickedIdx === -1) pickedIdx = 0

        result.push(remaining[pickedIdx])
        remaining.splice(pickedIdx, 1)
    }

    return result
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
    console.log("[study/feed] GET request received")
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        console.log("[study/feed] Unauthorized: no user")
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Parse query params ────────────────────────────────────────────────────
    const url = new URL(request.url)
    const sessionId = url.searchParams.get('session_id') ?? null
    const subjects = url.searchParams.getAll('subject').filter(Boolean).map(s => s.toLowerCase())
    const chapters = url.searchParams.getAll('chapter').map(Number).filter(n => !isNaN(n))
    const difficulties = url.searchParams.getAll('difficulty').filter(Boolean)
    const questionTypes = url.searchParams.getAll('question_type').filter(Boolean)
    const marks = url.searchParams.getAll('marks').map(Number).filter(n => !isNaN(n))
    const sources = url.searchParams.getAll('source').filter(Boolean)
    const weakTopicsOnly = url.searchParams.get('weak_topics_only') === 'true'

    const bypassRecent = url.searchParams.get('bypass_recent') === 'true'

    const batchRaw = parseInt(url.searchParams.get('batch_size') || '14', 10)
    // Allow larger batches so the client can hold ~20 cards ahead with fewer round trips.
    const batchSize = Math.min(28, Math.max(6, Number.isNaN(batchRaw) ? 14 : batchRaw))

    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    const clientExclude = url.searchParams.getAll('exclude').filter((s) => uuidRe.test(s.trim()))

    console.log(
        "[study/feed] Params | session:", sessionId,
        "| batch_size:", batchSize,
        "| client_exclude:", clientExclude.length,
        "| subjects:", subjects.length ? subjects : 'all',
        "| chapters:", chapters.length ? chapters : 'all',
        "| difficulty:", difficulties.length ? difficulties : 'all',
        "| types:", questionTypes.length ? questionTypes : 'all',
        "| marks:", marks.length ? marks : 'all',
        "| weakTopicsOnly:", weakTopicsOnly,
        "| sources:", sources.length ? sources : 'all',
    )

    // ── Fetch user grade from profiles ────────────────────────────────────────
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('grade')
        .eq('id', user.id)
        .single()

    if (profileError) {
        console.error('[study/feed] Failed to fetch profile:', profileError.message)
        return NextResponse.json({ error: 'Could not load profile' }, { status: 500 })
    }

    let userGrade = parseProfileGrade(profile?.grade)
    if (userGrade == null) {
        userGrade = 9
        console.warn('[study/feed] profile.grade missing or unparsable, defaulting to 9 | raw:', profile?.grade)
    } else {
        console.log('[study/feed] User grade (raw):', profile?.grade, '→ numeric:', userGrade)
    }

    // ── Step 1: Parallel — recent attempts + student memory + session stats ────

    const isGrade11 = userGrade === 11
    const requestedSubjects = subjects.length > 0 ? subjects : getStudyFeedSubjectLabelsForGrade(userGrade).map((s) => s.toLowerCase())
    const boundedSubjects = requestedSubjects.slice(0, 1) // max one subject in feed

    // Grade 10 mathematics only has PYQ content — force-restrict source regardless of client filters
    const isGrade10MathFeed =
        userGrade === 10 && boundedSubjects.length === 1 && boundedSubjects[0] === 'mathematics'
    const effectiveSources = isGrade11
        ? []
        : isGrade10MathFeed
        ? ['pyq']
        : sources
    const chapterLimitForSelected =
        boundedSubjects.length === 1
            ? getChapterLimitForSubject(userGrade, boundedSubjects[0]) ?? null
            : null
    const boundedChapters = chapterLimitForSelected != null
        ? chapters.filter((c) => c >= 1 && c <= chapterLimitForSelected)
        : chapters

    const twentyHoursAgo = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString()

    const [recentResult, memoryResult, sessionResult, momentumResult] = await Promise.all([
        // Exclude questions seen in the last 20 hours
        supabase
            .from('study_attempts')
            .select('question_id')
            .eq('user_id', user.id)
            .gte('attempted_at', twentyHoursAgo),
        // Student's known weak/strong topics for personalized scoring
        supabase
            .from('student_ai_memory')
            .select('subject, weak_topics, strong_topics')
            .eq('user_id', user.id),
        // In-session stats: accuracy (difficulty steering) + attempt count (warm-up phase)
        sessionId
            ? supabase
                .from('study_feed_sessions')
                .select('questions_attempted, questions_correct')
                .eq('id', sessionId)
                .eq('user_id', user.id)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        // Last 3 answered attempts in this session — detect consecutive-wrong streak for momentum recovery
        sessionId
            ? supabase
                .from('study_attempts')
                .select('is_correct')
                .eq('feed_session_id', sessionId)
                .eq('interaction_type', 'answered')
                .order('attempted_at', { ascending: false })
                .limit(3)
            : Promise.resolve({ data: null, error: null }),
    ])

    if (recentResult.error) {
        console.error('[study/feed] Failed to fetch recent attempts:', recentResult.error.message)
        return NextResponse.json({ error: 'Feed query failed' }, { status: 500 })
    }

    // Build weak/strong topic sets (union across all subjects, or filtered to requested subjects)
    type MemRow = { subject: string; weak_topics?: string[] | null; strong_topics?: string[] | null }
    const allWeak: string[] = []
    const allStrong: string[] = []
    for (const row of (memoryResult.data ?? []) as MemRow[]) {
        if (boundedSubjects.length === 0 || boundedSubjects.includes(row.subject.toLowerCase())) {
            allWeak.push(...(row.weak_topics ?? []))
            allStrong.push(...(row.strong_topics ?? []))
        }
    }
    const weakTopicsSet = new Set(allWeak)
    const strongTopicsSet = new Set(allStrong)

    // In-session stats
    let sessionAccuracy: number | null = null
    let questionsAttempted = 0
    if (sessionResult.data) {
        type SessRow = { questions_attempted: number; questions_correct: number }
        const sess = sessionResult.data as SessRow
        questionsAttempted = sess.questions_attempted
        if (questionsAttempted >= 3) {
            sessionAccuracy = sess.questions_correct / questionsAttempted
        }
    }

    // Count consecutive wrong answers at the end of this session (for momentum recovery)
    let consecutiveWrongs = 0
    for (const a of ((momentumResult.data ?? []) as Array<{ is_correct: boolean | null }>)) {
        if (a.is_correct === false) consecutiveWrongs++
        else break
    }

    const recentIds = bypassRecent ? [] : (recentResult.data?.map(a => a.question_id) ?? [])
    const excludeIds = [...new Set([...recentIds, ...clientExclude])]

    console.log(
        "[study/feed] Excluding", excludeIds.length, "questions (20h window + client queue)",
        "| weak topics:", weakTopicsSet.size,
        "| strong topics:", strongTopicsSet.size,
        "| session attempted:", questionsAttempted,
        "| accuracy:", sessionAccuracy != null ? sessionAccuracy.toFixed(2) : 'n/a',
        "| consecutive wrongs:", consecutiveWrongs,
    )

    // ── Step 2: Candidate pool ────────────────────────────────────────────────

    // Stratify by chapter when no chapter filter (avoids ch.1 dominating LIMIT scans)
    const filterOpts = {
        userGrade,
        subjects: boundedSubjects,
        chaptersFilter: boundedChapters,
        difficulties,
        questionTypes,
        marks,
        sources: effectiveSources,
        excludeIds,
    }

    let mergedRaw: StudyQuestion[] = []
    try {
        if (chapters.length > 0) {
            mergedRaw = await fetchSinglePool(supabase, { ...filterOpts, limit: 450 })
            shuffleInPlace(mergedRaw)
        } else {
            mergedRaw = await fetchStratifiedPool(supabase, filterOpts)
        }
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error('[study/feed] Candidate query failed:', msg)
        return NextResponse.json({ error: 'Feed query failed' }, { status: 500 })
    }

    let pool: StudyQuestion[] =
        boundedChapters.length > 0
            ? mergedRaw.slice(0, SCORING_POOL_TARGET)
            : roundRobinPickByChapter(mergedRaw, SCORING_POOL_TARGET)

    if (isGrade11) {
        pool = pool.filter((q) => {
            const limit = getChapterLimitForSubject(11, q.subject);
            return limit == null || q.chapter_index <= limit;
        });
    }

    // Apply weak_topics_only filter: narrow pool to the user's known-weak topics
    if (weakTopicsOnly && weakTopicsSet.size > 0) {
        const narrowed = pool.filter(q => weakTopicsSet.has(q.topic_name))
        if (narrowed.length > 0) {
            console.log('[study/feed] weak_topics_only: narrowed pool', pool.length, '→', narrowed.length)
            pool = narrowed
        } else {
            console.log('[study/feed] weak_topics_only: no matching questions, serving full pool')
        }
    }

    const chapterCounts = pool.reduce<Map<number, number>>((m, q) => {
        m.set(q.chapter_index, (m.get(q.chapter_index) ?? 0) + 1)
        return m
    }, new Map())
    console.log(
        '[study/feed] Scoring pool size:',
        pool.length,
        '| chapters represented:',
        chapterCounts.size,
        '| per-chapter (sample):',
        [...chapterCounts.entries()].slice(0, 8).map(([c, n]) => `${c}:${n}`).join(', '),
    )

    const filterMeta = {
        grade: userGrade,
        subjects: boundedSubjects.length > 0 ? boundedSubjects : null,
        chapters: boundedChapters.length > 0 ? boundedChapters : null,
        difficulty: difficulties.length > 0 ? difficulties : null,
        question_types: questionTypes.length > 0 ? questionTypes : null,
        marks: marks.length > 0 ? marks : null,
        sources: effectiveSources.length > 0 ? effectiveSources : null,
        weak_topics_only: weakTopicsOnly,
    }

    if (pool.length === 0) {
        return NextResponse.json({
            questions: [],
            next_cursor: null,
            session_id: sessionId,
            meta: { ...filterMeta, candidate_pool_size: 0 },
        })
    }

    // ── Step 3: Fetch last attempt per candidate ───────────────────────────────

    const candidateIds = pool.map(q => q.id)

    const { data: attemptsRaw, error: attemptsErr } = await supabase
        .from('study_attempts')
        .select('question_id, attempted_at, is_correct, interaction_type')
        .eq('user_id', user.id)
        .in('question_id', candidateIds)
        .order('attempted_at', { ascending: false })

    if (attemptsErr) {
        console.error('[study/feed] Attempts fetch failed:', attemptsErr.message)
        return NextResponse.json({ error: 'Feed query failed' }, { status: 500 })
    }

    // Build a map: question_id → most recent attempt
    const lastAttemptMap = new Map<string, LastAttempt>()
    for (const a of (attemptsRaw ?? []) as LastAttempt[]) {
        if (!lastAttemptMap.has(a.question_id)) {
            lastAttemptMap.set(a.question_id, a)
        }
    }

    // ── Step 4: Score ──────────────────────────────────────────────────────────

    const scored = pool
        .map(q => scoreQuestion(q, lastAttemptMap.get(q.id), weakTopicsSet, strongTopicsSet, sessionAccuracy, questionsAttempted, consecutiveWrongs))
        .sort((a, b) => {
            const d = b._score - a._score
            if (Math.abs(d) < 1e-4) return Math.random() - 0.5
            return d > 0 ? 1 : -1
        })

    // ── Step 5: Diversity pass ─────────────────────────────────────────────────

    const batch = diversityPass(scored, batchSize)

    console.log(
        "[study/feed] Returning", batch.length, "questions",
        "| top score:", batch[0]?._score.toFixed(3),
        "| bottom score:", batch[batch.length - 1]?._score.toFixed(3),
    )

    return NextResponse.json({
        questions: batch,
        next_cursor: null, // pagination not implemented in v1
        session_id: sessionId,
        meta: { ...filterMeta, candidate_pool_size: pool.length },
    })
}
