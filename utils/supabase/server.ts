import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
    const cookieStore = await cookies()

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
        }
    )
}

/**
 * Returns the Supabase client and the session user in one call.
 * Uses getSession() (cookie-read, no auth-server round trip) for speed.
 * Safe because the middleware runs getSession() before every request and
 * persists refreshed tokens to the response and request cookies, so by
 * the time a Server Component calls this the token is always fresh.
 */
export async function getSessionUser() {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return { supabase, user: session?.user ?? null }
}
