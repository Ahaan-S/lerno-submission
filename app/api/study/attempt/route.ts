import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AttemptBody {
    session_id: string
    question_id: string
    interaction_type: 'answered' | 'skipped' | 'marked_as_done'
    answer_given?: string | null
    selected_option?: string | null
    is_correct?: boolean | null
    self_assessed_result?: 'correct' | 'partial' | 'incorrect' | null
    hints_used?: number
    time_taken_secs?: number | null
    /** Normalised AI score: marks / max_marks ∈ [0, 1]. Only for AI-graded short_ans. */
    ai_score?: number | null
}

interface QuestionRow {
    id: string
    subject: string
    chapter_index: number
    topic_index: string
    topic_name: string
    times_attempted: number
    times_correct: number
    times_served: number
    avg_time_secs: number | null
}

interface SessionRow {
    id: string
    user_id: string
    questions_served: number
    questions_attempted: number
    questions_correct: number
    questions_skipped: number
    questions_done_nb: number
    total_hints_used: number
    streak_peak: number
}

// ─── Topic mastery helper ─────────────────────────────────────────────────────

async function triggerTopicMastery(
    adminClient: NonNullable<ReturnType<typeof createAdminClient>>,
    userId: string,
    subject: string,
    chapterIndex: number,
    topicIndex: string,
    topicName: string,
    isCorrect: boolean,
    hintsUsed: number,
    sessionId: string,
) {
    console.log("[study/attempt] triggerTopicMastery | topic:", topicName, "| correct:", isCorrect, "| hints:", hintsUsed)

    const { data: existing } = await adminClient
        .from('student_topic_progress')
        .select('id, quiz_attempts, quiz_correct, mastery_level')
        .eq('user_id', userId)
        .eq('subject', subject)
        .eq('chapter_index', String(chapterIndex))
        .eq('topic_index', topicIndex)
        .maybeSingle()

    type ProgressRow = { quiz_attempts?: number; quiz_correct?: number }
    const prevAttempts = (existing as ProgressRow | null)?.quiz_attempts ?? 0
    const prevCorrect = (existing as ProgressRow | null)?.quiz_correct ?? 0
    const newAttempts = prevAttempts + 1

    // Heavy hint usage (2+) on a correct answer = scaffolded correct:
    // count the attempt but NOT the correct so mastery reflects unaided ability.
    const countAsCorrect = isCorrect && hintsUsed < 2
    const newCorrect = prevCorrect + (countAsCorrect ? 1 : 0)

    let masteryLevel: string
    if (newAttempts < 3) {
        masteryLevel = 'learning'
    } else {
        const accuracy = newCorrect / newAttempts
        if (accuracy >= 0.75) masteryLevel = 'strong'
        else if (accuracy >= 0.4) masteryLevel = 'learning'
        else masteryLevel = 'weak'
    }

    console.log(
        "[study/attempt] Mastery | topic:", topicName,
        "| attempts:", newAttempts,
        "| counted correct:", newCorrect,
        "| level:", masteryLevel,
        "| scaffolded:", isCorrect && hintsUsed >= 2 ? 'yes' : 'no',
    )

    const { error: progressErr } = await adminClient.from('student_topic_progress').upsert(
        {
            user_id: userId,
            subject,
            chapter_index: String(chapterIndex),
            topic_index: topicIndex,
            topic_name: topicName,
            mastery_level: masteryLevel,
            mastery_source: 'quiz_verified',
            quiz_attempts: newAttempts,
            quiz_correct: newCorrect,
            last_practiced_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,subject,chapter_index,topic_index' },
    )

    if (progressErr) {
        console.error('[study/attempt] topic_progress upsert error:', progressErr.message)
        return // non-fatal
    }

    // Log confusion signal when student needed heavy scaffolding to get it right
    if (isCorrect && hintsUsed >= 2) {
        const { error: hintEntryErr } = await adminClient.from('memory_entries').insert({
            user_id: userId,
            subject,
            entry_type: 'confusion_signal',
            content: `Needed ${hintsUsed} hint${hintsUsed > 1 ? 's' : ''} to answer ${topicName} correctly — correct but with scaffolding`,
            confidence: 'observed_once',
            source: 'quiz',
            session_id: sessionId,
        })
        if (hintEntryErr) console.warn('[study/attempt] hint confusion_signal insert error (non-fatal):', hintEntryErr.message)
    }

    if (newAttempts < 3) return // don't touch memory until 3+ verified attempts

    // Update student_ai_memory weak/strong topics
    const { data: memory } = await adminClient
        .from('student_ai_memory')
        .select('weak_topics, strong_topics')
        .eq('user_id', userId)
        .eq('subject', subject)
        .maybeSingle()

    type MemoryRow = { weak_topics?: string[]; strong_topics?: string[] }
    const weakTopics: string[] = (memory as MemoryRow | null)?.weak_topics ?? []
    const strongTopics: string[] = (memory as MemoryRow | null)?.strong_topics ?? []

    let updatedWeak = weakTopics
    let updatedStrong = strongTopics

    if (masteryLevel === 'strong') {
        updatedStrong = [...new Set([...strongTopics, topicName])]
        updatedWeak = weakTopics.filter(t => t !== topicName)
    } else if (masteryLevel === 'weak') {
        updatedWeak = [...new Set([...weakTopics, topicName])]
        updatedStrong = strongTopics.filter(t => t !== topicName)
    } else {
        // learning: remove from both extremes
        updatedWeak = weakTopics.filter(t => t !== topicName)
        updatedStrong = strongTopics.filter(t => t !== topicName)
    }

    const { error: memErr } = await adminClient.from('student_ai_memory').upsert(
        {
            user_id: userId,
            subject,
            weak_topics: updatedWeak,
            strong_topics: updatedStrong,
            updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,subject' },
    )
    if (memErr) console.warn('[study/attempt] student_ai_memory update error (non-fatal):', memErr.message)

    // memory_entries audit trail — correct entry_type usage
    const { error: entryErr } = await adminClient.from('memory_entries').insert({
        user_id: userId,
        subject,
        // strong mastery = recently_discussed (it was practised and understood)
        // weak/learning   = confusion_signal (needs more work)
        entry_type: masteryLevel === 'strong' ? 'recently_discussed' : 'confusion_signal',
        content: `Study feed quiz-verified: ${topicName} — ${masteryLevel} (${newCorrect}/${newAttempts} correct)`,
        confidence: 'quiz_verified',
        source: 'quiz',
        session_id: sessionId,
    })
    if (entryErr) console.warn('[study/attempt] memory_entry insert error (non-fatal):', entryErr.message)
}

// ─── Streak calculator ────────────────────────────────────────────────────────

async function computeCurrentStreak(
    supabase: SupabaseClient,
    sessionId: string,
): Promise<number> {
    const { data: recent } = await supabase
        .from('study_attempts')
        .select('is_correct, interaction_type')
        .eq('feed_session_id', sessionId)
        .order('attempted_at', { ascending: false })
        .limit(50)

    let streak = 0
    for (const a of recent ?? []) {
        if (a.interaction_type === 'answered' && a.is_correct === true) {
            streak++
        } else {
            break
        }
    }
    return streak
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
    console.log("[study/attempt] POST request received")
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        console.log("[study/attempt] Unauthorized: no user")
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: AttemptBody
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const {
        session_id,
        question_id,
        interaction_type,
        answer_given = null,
        selected_option = null,
        is_correct = null,
        self_assessed_result = null,
        hints_used = 0,
        time_taken_secs = null,
        ai_score = null,
    } = body

    if (!session_id || !question_id || !interaction_type) {
        return NextResponse.json(
            { error: 'session_id, question_id, and interaction_type are required' },
            { status: 400 },
        )
    }

    const validInteractions = ['answered', 'skipped', 'marked_as_done']
    if (!validInteractions.includes(interaction_type)) {
        return NextResponse.json({ error: 'Invalid interaction_type' }, { status: 400 })
    }

    console.log(
        "[study/attempt] User:", user.id,
        "| question:", question_id,
        "| interaction:", interaction_type,
        "| is_correct:", is_correct,
        "| self_assessed:", self_assessed_result,
        "| ai_score:", ai_score,
        "| hints:", hints_used,
    )

    // ── 1. Fetch question ─────────────────────────────────────────────────────

    const { data: question, error: questionErr } = await supabase
        .from('study_questions')
        .select('id, subject, chapter_index, topic_index, topic_name, times_attempted, times_correct, times_served, avg_time_secs')
        .eq('id', question_id)
        .single()

    if (questionErr || !question) {
        console.error('[study/attempt] Question not found:', questionErr?.message)
        return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    const q = question as QuestionRow

    // ── 2. Fetch session and verify ownership ─────────────────────────────────

    const { data: session, error: sessionErr } = await supabase
        .from('study_feed_sessions')
        .select('id, user_id, questions_served, questions_attempted, questions_correct, questions_skipped, questions_done_nb, total_hints_used, streak_peak')
        .eq('id', session_id)
        .eq('user_id', user.id)
        .maybeSingle()

    if (sessionErr) {
        console.error('[study/attempt] Session fetch error:', sessionErr.message)
        return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 })
    }
    if (!session) {
        console.log('[study/attempt] Session not found:', session_id)
        return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const s = session as SessionRow

    // ── 3. Insert attempt ─────────────────────────────────────────────────────

    const clampedAiScore =
        ai_score != null ? Math.min(1, Math.max(0, ai_score)) : null

    const { error: insertErr } = await supabase.from('study_attempts').insert({
        user_id: user.id,
        question_id,
        feed_session_id: session_id,
        interaction_type,
        answer_given,
        selected_option,
        is_correct,
        self_assessed_result,
        self_assessed: self_assessed_result != null,
        hints_used: hints_used ?? 0,
        time_taken_secs,
        ai_score: clampedAiScore,
        source: 'feed',
    })

    if (insertErr) {
        console.error('[study/attempt] Insert attempt error:', insertErr.message)
        return NextResponse.json({ error: 'Failed to log attempt' }, { status: 500 })
    }

    // ── 4. Compute new session stats ──────────────────────────────────────────

    const isAnswered = interaction_type === 'answered'
    const isSkipped = interaction_type === 'skipped'
    const isDoneNb = interaction_type === 'marked_as_done'
    const wasCorrect = is_correct === true

    const newQuestionsServed = s.questions_served + 1
    const newQuestionsAttempted = s.questions_attempted + (isAnswered ? 1 : 0)
    const newQuestionsCorrect = s.questions_correct + (wasCorrect ? 1 : 0)
    const newQuestionsSkipped = s.questions_skipped + (isSkipped ? 1 : 0)
    const newQuestionsDoneNb = s.questions_done_nb + (isDoneNb ? 1 : 0)
    const newTotalHints = s.total_hints_used + (hints_used ?? 0)

    const currentStreak = await computeCurrentStreak(supabase, session_id)
    const newStreakPeak = Math.max(s.streak_peak, currentStreak)

    const { error: sessionUpdateErr } = await supabase
        .from('study_feed_sessions')
        .update({
            questions_served: newQuestionsServed,
            questions_attempted: newQuestionsAttempted,
            questions_correct: newQuestionsCorrect,
            questions_skipped: newQuestionsSkipped,
            questions_done_nb: newQuestionsDoneNb,
            total_hints_used: newTotalHints,
            streak_peak: newStreakPeak,
        })
        .eq('id', session_id)

    if (sessionUpdateErr) {
        console.error('[study/attempt] Session update error:', sessionUpdateErr.message)
        // Non-fatal — attempt is already logged
    }

    // ── 5. Update study_questions analytics ───────────────────────────────────

    const newTimesServed = q.times_served + 1
    const newTimesAttempted = q.times_attempted + (isAnswered ? 1 : 0)
    const newTimesCorrect = q.times_correct + (wasCorrect ? 1 : 0)

    let newAvgTime: number | null = q.avg_time_secs
    if (isAnswered && time_taken_secs != null && time_taken_secs > 0) {
        const prevCount = q.times_attempted
        if (prevCount === 0 || q.avg_time_secs == null) {
            newAvgTime = time_taken_secs
        } else {
            newAvgTime = (q.avg_time_secs * prevCount + time_taken_secs) / (prevCount + 1)
        }
    }

    // ── 6. Trigger topic mastery + question analytics (admin client) ───────────

    const admin = createAdminClient()
    if (admin) {
        const { error: questionUpdateErr } = await admin
            .from('study_questions')
            .update({
                times_served: newTimesServed,
                times_attempted: newTimesAttempted,
                times_correct: newTimesCorrect,
                avg_time_secs: newAvgTime,
                updated_at: new Date().toISOString(),
            })
            .eq('id', question_id)

        if (questionUpdateErr) {
            console.error('[study/attempt] Question analytics update error:', questionUpdateErr.message)
        }
    } else {
        console.warn('[study/attempt] Admin client unavailable — skipping question analytics update')
    }

    // Determine a mastery signal from is_correct and/or self_assessed_result.
    // Handles all question types:
    //   • MCQ / fill_blank / match: is_correct is always true/false
    //   • AI-checked short_ans: is_correct = true (full), false (zero), null (partial AI score)
    //   • Self-assessed (short_ans / long_ans / case_study):
    //       correct   → is_correct = true
    //       partial   → is_correct = null   ← previously dropped; now treated as 'not correct'
    //       incorrect → is_correct = false
    // Any answered interaction with at least one signal triggers a mastery update.
    const hasMasterySignal = is_correct !== null || self_assessed_result !== null
    const masteryIsCorrect: boolean =
        is_correct !== null
            ? is_correct
            : self_assessed_result === 'correct'  // partial/incorrect → false

    if (isAnswered && hasMasterySignal && q.topic_index && admin) {
        await triggerTopicMastery(
            admin,
            user.id,
            q.subject,
            q.chapter_index,
            q.topic_index,
            q.topic_name,
            masteryIsCorrect,
            hints_used ?? 0,
            session_id,
        )
    } else if (isAnswered && hasMasterySignal && q.topic_index && !admin) {
        console.warn('[study/attempt] Admin client unavailable — skipping topic mastery update')
    }

    console.log(
        "[study/attempt] Done | session attempted:", newQuestionsAttempted,
        "| correct:", newQuestionsCorrect,
        "| streak_peak:", newStreakPeak,
    )

    return NextResponse.json({
        ok: true,
        session_stats: {
            questions_attempted: newQuestionsAttempted,
            questions_correct: newQuestionsCorrect,
            streak_peak: newStreakPeak,
        },
    })
}
