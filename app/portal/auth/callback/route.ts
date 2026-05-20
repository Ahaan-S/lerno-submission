
import * as Sentry from "@sentry/nextjs";
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

/** Public URL the browser used (works behind Vercel / proxies). */
function getRedirectOrigin(request: Request): string {
    const forwardedHost = request.headers.get('x-forwarded-host')
    const forwardedProto = request.headers.get('x-forwarded-proto')
    if (forwardedHost) {
        const host = forwardedHost.split(',')[0].trim()
        const proto = forwardedProto ?? 'https'
        return `${proto}://${host}`
    }
    return new URL(request.url).origin
}

/** Keep post-login redirect same-origin; strip accidental absolute URLs from `next`. */
function normalizeNextPath(next: string | null): string {
    if (!next) return '/learn'
    if (next.startsWith('http://') || next.startsWith('https://')) {
        try {
            const u = new URL(next)
            const path = u.pathname + u.search + u.hash
            return path || '/'
        } catch {
            return '/learn'
        }
    }
    if (!next.startsWith('/') || next.startsWith('//')) return '/learn'
    return next
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const next = normalizeNextPath(searchParams.get('next'))

    if (code) {
        const supabase = await createClient()
        const { error, data } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
            // Attach the authenticated user to all subsequent Sentry events
            if (data.user) {
                Sentry.setUser({
                    id: data.user.id,
                    email: data.user.email ?? undefined,
                })
            }
            const origin = getRedirectOrigin(request)
            return NextResponse.redirect(`${origin}${next}`)
        }
        // Track auth failures so we know if the OAuth flow breaks
        Sentry.captureException(error, {
            tags: { auth_event: "code_exchange_failed" },
        })
    }

    const origin = getRedirectOrigin(request)
    return NextResponse.redirect(`${origin}/auth?error=CodeExchangeError`)
}
