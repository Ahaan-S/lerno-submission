import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { upsertDailyActivityAfterSession } from '@/lib/analytics-daily-activity'

/** POST — End a study feed session. Ghost sessions (0 attempts) are deleted. Returns { ok: true } */
export async function POST(request: NextRequest) {
    console.log("[study/session/end] POST request received")
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        console.log("[study/session/end] Unauthorized: no user")
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: { session_id: string; time_active_secs?: number }
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { session_id, time_active_secs } = body

    if (!session_id || typeof session_id !== 'string') {
        return NextResponse.json({ error: 'session_id is required' }, { status: 400 })
    }

    // Verify ownership and fetch attempt count
    const { data: existing, error: fetchError } = await supabase
        .from('study_feed_sessions')
        .select('id, questions_attempted')
        .eq('id', session_id)
        .eq('user_id', user.id)
        .maybeSingle()

    if (fetchError) {
        console.error('[study/session/end] fetch error:', fetchError)
        return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 })
    }

    if (!existing) {
        console.log("[study/session/end] Session not found or unauthorized:", session_id)
        return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const sessRow = existing as { id: string; questions_attempted: number }

    // Ghost session cleanup: no real work happened — delete rather than accumulate junk rows
    if (sessRow.questions_attempted === 0) {
        console.log("[study/session/end] Ghost session (0 attempts), deleting:", session_id)
        const { error: deleteErr } = await supabase
            .from('study_feed_sessions')
            .delete()
            .eq('id', session_id)
            .eq('user_id', user.id)
        if (deleteErr) {
            console.error('[study/session/end] Ghost delete error:', deleteErr.message)
        }
        return NextResponse.json({ ok: true, ghost: true })
    }

    // Real session: stamp ended_at
    console.log("[study/session/end] Ending session:", session_id, "| attempts:", sessRow.questions_attempted)

    const resolvedTimeActive =
        typeof time_active_secs === 'number' ? time_active_secs : null

    const { error: updateError } = await supabase
        .from('study_feed_sessions')
        .update({
            ended_at: new Date().toISOString(),
            ...(resolvedTimeActive != null ? { time_active_secs: resolvedTimeActive } : {}),
        })
        .eq('id', session_id)
        .eq('user_id', user.id)

    if (updateError) {
        console.error('[study/session/end] update error:', updateError)
        return NextResponse.json({ error: 'Failed to end session' }, { status: 500 })
    }

    void upsertDailyActivityAfterSession({
        userId: user.id,
        timeActiveSecs: resolvedTimeActive,
        feedSessionId: session_id,
    })

    // Fire-and-forget: sync topics from this session into student_ai_memory
    void syncRecentlyDiscussed(user.id, session_id)

    console.log("[study/session/end] Session ended:", session_id)
    return NextResponse.json({ ok: true })
}

/**
 * Aggregates topic names from this session's answered attempts and prepends them
 * to student_ai_memory.recently_discussed_topics (per subject, capped at 15).
 * Non-fatal; errors are logged and swallowed.
 */
async function syncRecentlyDiscussed(userId: string, sessionId: string): Promise<void> {
    const admin = createAdminClient()
    if (!admin) {
        console.warn('[study/session/end] Admin client unavailable — skipping recently_discussed sync')
        return
    }

    // Only answered interactions count as "discussed"
    const { data: attempts } = await admin
        .from('study_attempts')
        .select('question_id')
        .eq('feed_session_id', sessionId)
        .eq('interaction_type', 'answered')

    if (!attempts || attempts.length === 0) return

    const questionIds = [...new Set(attempts.map(a => a.question_id as string))]

    const { data: questions } = await admin
        .from('study_questions')
        .select('id, subject, topic_name')
        .in('id', questionIds)

    if (!questions || questions.length === 0) return

    // Group unique topic names by subject
    const bySubject = new Map<string, string[]>()
    for (const q of questions as Array<{ id: string; subject: string; topic_name: string }>) {
        if (!q.topic_name) continue
        const list = bySubject.get(q.subject) ?? []
        if (!list.includes(q.topic_name)) list.push(q.topic_name)
        bySubject.set(q.subject, list)
    }

    // Upsert per subject: new topics go to the front, cap at 15
    await Promise.all(
        [...bySubject.entries()].map(async ([subject, newTopics]) => {
            const { data: memory } = await admin
                .from('student_ai_memory')
                .select('recently_discussed_topics')
                .eq('user_id', userId)
                .eq('subject', subject)
                .maybeSingle()

            const prev: string[] =
                ((memory as Record<string, unknown> | null)?.recently_discussed_topics as string[] | null) ?? []

            const merged = [...new Set([...newTopics, ...prev])].slice(0, 15)

            const { error } = await admin.from('student_ai_memory').upsert(
                {
                    user_id: userId,
                    subject,
                    recently_discussed_topics: merged,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'user_id,subject' },
            )
            if (error) {
                console.warn('[study/session/end] recently_discussed upsert error:', subject, error.message)
            } else {
                console.log(
                    '[study/session/end] recently_discussed synced | subject:', subject,
                    '| topics:', merged.slice(0, 3).join(', '),
                )
            }
        }),
    )
}
