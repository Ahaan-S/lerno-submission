import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getChapterLimitForSubject } from '@/lib/chapters'
import { resolveSubjectSlug } from '@/lib/tutor-subject'

/** POST — Create or resume a session for user + subject + chapter. Returns { session_id } */
export async function POST(request: NextRequest) {
    console.log("[tutor/session] POST request received");
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        console.log("[tutor/session] Unauthorized: no user");
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: { subject: string; chapter_index?: string | null; chapter_name?: string | null; create_new?: boolean }
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { subject, chapter_index = null, chapter_name = null, create_new = false } = body

    if (!subject || typeof subject !== 'string') {
        return NextResponse.json({ error: 'subject is required' }, { status: 400 })
    }

    // Fetch user grade for chapter validation and session tagging
    const { data: profile } = await supabase
        .from('profiles')
        .select('grade')
        .eq('id', user.id)
        .maybeSingle()
    const rawGrade = profile?.grade
    const userGrade =
        typeof rawGrade === 'string' && rawGrade.startsWith('Class ')
            ? Number(rawGrade.replace('Class ', ''))
            : Number(rawGrade ?? 10)

    if (chapter_index != null && chapter_index !== '') {
        const normalizedSubject = resolveSubjectSlug(subject)
        const limit = getChapterLimitForSubject(userGrade, normalizedSubject)
        const requestedChapter = Number(chapter_index)
        if (limit != null && Number.isFinite(requestedChapter) && requestedChapter > limit) {
            return NextResponse.json({ error: 'Chapter not available yet for this subject' }, { status: 400 })
        }
    }

    if (!create_new) {
        // Find latest session by user_id + subject + chapter_index + grade
        let query = supabase
            .from('tutor_sessions')
            .select('id')
            .eq('user_id', user.id)
            .eq('subject', subject)
            .eq('grade', userGrade)
            .order('last_message_at', { ascending: false })
            .limit(1)

        if (chapter_index != null && chapter_index !== '') {
            query = query.eq('chapter_index', chapter_index)
        } else {
            query = query.is('chapter_index', null)
        }

        const { data: existing, error: fetchError } = await query.maybeSingle()

        if (fetchError) {
            console.error('[tutor/session] fetch error:', fetchError)
            return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 })
        }

        if (existing) {
            console.log("[tutor/session] Resuming existing session:", existing.id);
            return NextResponse.json({ session_id: existing.id })
        }
    }

    // No existing session — create one
    console.log("[tutor/session] Creating new session | subject:", subject, "| chapter_index:", chapter_index);
    const { data: inserted, error: insertError } = await supabase
        .from('tutor_sessions')
        .insert({
            user_id: user.id,
            subject,
            chapter_index: chapter_index || null,
            chapter_name: chapter_name || null,
            grade: userGrade,
        })
        .select('id')
        .single()

    if (insertError) {
        console.error('[tutor/session] insert error:', insertError)
        return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
    }

    console.log("[tutor/session] Created session:", inserted.id);
    return NextResponse.json({ session_id: inserted.id })
}
