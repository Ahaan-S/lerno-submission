import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

/** POST — Create a study feed session. Returns { session_id } */
export async function POST(request: NextRequest) {
    console.log("[study/session] POST start request received")
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        console.log("[study/session] Unauthorized: no user")
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: { filters_applied?: Record<string, unknown>; entry_source?: string }
    try {
        body = await request.json()
    } catch {
        body = {}
    }

    const {
        filters_applied = {},
        entry_source = 'sidebar',
    } = body

    const validSources = ['sidebar', 'tutor_redirect', 'diagnostic', 'dashboard']
    if (!validSources.includes(entry_source)) {
        return NextResponse.json({ error: 'Invalid entry_source' }, { status: 400 })
    }

    console.log("[study/session] Creating session | user:", user.id, "| entry_source:", entry_source)

    const { data: inserted, error: insertError } = await supabase
        .from('study_feed_sessions')
        .insert({
            user_id: user.id,
            filters_applied,
            entry_source,
        })
        .select('id')
        .single()

    if (insertError) {
        console.error('[study/session] insert error:', insertError)
        return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
    }

    console.log("[study/session] Created session:", inserted.id)
    return NextResponse.json({ session_id: inserted.id })
}
