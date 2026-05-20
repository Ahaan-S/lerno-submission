import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { chat, resolveModel } from '@/lib/ai/llm'
import { checkRateLimit, rateLimitedResponse } from '@/lib/rate-limit'

// Keep in sync with StudyFeed SHORT_ANS_MAX_WORDS (token safety).
const MAX_ANSWER_WORDS = 200

function clampAnswerWords(text: string): string {
    const t = text.trim()
    if (!t) return t
    const words = t.split(/\s+/)
    if (words.length <= MAX_ANSWER_WORDS) return t
    return words.slice(0, MAX_ANSWER_WORDS).join(' ')
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
    console.log("[study/evaluate/short] POST request received")
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        console.log("[study/evaluate/short] Unauthorized: no user")
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rl = await checkRateLimit(user.id, "llm_evaluate")
    if (!rl.success) {
        console.log("[study/evaluate/short] Rate limited:", user.id)
        return rateLimitedResponse(rl.reset)
    }

    let body: { question_id: string; answer_given: string }
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { question_id, answer_given } = body

    if (!question_id || typeof question_id !== 'string') {
        return NextResponse.json({ error: 'question_id is required' }, { status: 400 })
    }
    if (!answer_given || typeof answer_given !== 'string') {
        return NextResponse.json({ error: 'answer_given is required' }, { status: 400 })
    }

    const answerTrimmed = clampAnswerWords(answer_given)

    console.log("[study/evaluate/short] question:", question_id, "| answer length:", answerTrimmed.length)

    // ── Fetch question ─────────────────────────────────────────────────────────

    const { data: question, error: questionErr } = await supabase
        .from('study_questions')
        .select('marks, question_type, key_points, marking_scheme, model_answer, solution_text')
        .eq('id', question_id)
        .single()

    if (questionErr || !question) {
        console.error('[study/evaluate/short] Question not found:', questionErr?.message)
        return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    const { marks, question_type, key_points, marking_scheme, model_answer, solution_text } = question as {
        marks: number
        question_type: string
        key_points: string[] | null
        marking_scheme: Array<{ point: string; marks: number }> | null
        model_answer: string | null
        solution_text: string | null
    }

    if (question_type !== 'short_ans') {
        return NextResponse.json({ error: 'This endpoint is only for short_ans questions' }, { status: 400 })
    }

    // ── Build marking context ──────────────────────────────────────────────────

    const contextParts: string[] = []

    if (marking_scheme && marking_scheme.length > 0) {
        const schemeLines = marking_scheme.map(s => `- ${s.point} (${s.marks} mark${s.marks !== 1 ? 's' : ''})`).join('\n')
        contextParts.push(`Marking scheme:\n${schemeLines}`)
    }

    if (key_points && key_points.length > 0) {
        contextParts.push(`Key points required:\n${key_points.map(k => `- ${k}`).join('\n')}`)
    }

    if (model_answer) {
        contextParts.push(`Model answer:\n${model_answer}`)
    } else if (solution_text) {
        contextParts.push(`Solution:\n${solution_text}`)
    }

    if (contextParts.length === 0) {
        console.log("[study/evaluate/short] No marking context for question:", question_id)
        return NextResponse.json({
            marks: null,
            max_marks: marks,
            remarks: 'No marking criteria available for this question.',
        })
    }

    // ── AI evaluation ─────────────────────────────────────────────────────────

    const systemPrompt = `You are a concise exam marker for Indian school students (NCERT curriculum). Grade the student's answer quickly and fairly. Return ONLY a JSON object with two fields: "marks" (integer, 0 to ${marks}) and "remarks" (one short sentence, max 20 words, giving specific feedback — praise what's right or name exactly what's missing).`

    const userPrompt = `Question worth: ${marks} mark${marks !== 1 ? 's' : ''}

${contextParts.join('\n\n')}

Student's answer: "${answerTrimmed}"

Grade it and return JSON: { "marks": <int>, "remarks": "<one sentence>" }`

    try {
        const raw = await chat(
            [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            { model: resolveModel(false), jsonMode: true, temperature: 0.2 },
        )

        let parsed: { marks: unknown; remarks: unknown }
        try {
            parsed = JSON.parse(raw)
        } catch {
            console.error('[study/evaluate/short] Failed to parse AI JSON:', raw)
            return NextResponse.json({ error: 'AI returned invalid JSON' }, { status: 500 })
        }

        const aiMarks = Math.min(Math.max(Math.round(Number(parsed.marks)), 0), marks)
        const aiRemarks = typeof parsed.remarks === 'string' ? parsed.remarks.trim() : ''

        console.log("[study/evaluate/short] AI result | marks:", aiMarks, "/", marks, "| remarks:", aiRemarks)

        return NextResponse.json({
            marks: aiMarks,
            max_marks: marks,
            remarks: aiRemarks,
        })
    } catch (e) {
        console.error('[study/evaluate/short] AI call failed:', e)
        return NextResponse.json({ error: 'AI grading failed' }, { status: 500 })
    }
}
