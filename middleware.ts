import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

/** Copy cookies from one response onto a redirect response. */
function makeRedirect(request: NextRequest, destPath: string, response: NextResponse): NextResponse {
    const redirectUrl = new URL(destPath, request.url)
    const redirectRes = NextResponse.redirect(redirectUrl)
    response.cookies.getAll().forEach((c) => redirectRes.cookies.set(c.name, c.value))
    return redirectRes
}

function parseHostname(value: string | null): string {
    return value?.split(',')[0]?.trim().split(':')[0]?.toLowerCase() || ''
}

export async function middleware(request: NextRequest) {
    const url = request.nextUrl
    const hostnameOnly =
        parseHostname(request.headers.get('x-fh-requested-host')) ||
        parseHostname(request.headers.get('x-forwarded-host')) ||
        parseHostname(request.headers.get('host'))

    if (hostnameOnly === 'www.lerno.in') {
        const canonicalUrl = request.nextUrl.clone()
        canonicalUrl.protocol = 'https:'
        canonicalUrl.hostname = 'lerno.in'
        canonicalUrl.port = ''
        return NextResponse.redirect(canonicalUrl, 308)
    }

    const isStaticAsset =
        url.pathname.startsWith('/_next/static') ||
        url.pathname.startsWith('/_next/image') ||
        url.pathname === '/favicon.ico' ||
        /\.(?:svg|png|jpg|jpeg|gif|webp|mp4|webm|ogg|mov|json|woff2|woff|ttf|ico)$/.test(url.pathname)

    // API routes, Sentry tunnel, and static assets: skip all auth/routing logic
    if (
        url.pathname.startsWith('/api') ||
        url.pathname.startsWith('/monitoring') ||
        url.pathname === '/sitemap.xml' ||
        url.pathname === '/robots.txt' ||
        isStaticAsset
    ) {
        return NextResponse.next()
    }

    // Subdomain routing: app.* → /portal, everything else → /marketing.
    // In local/dev environments there is no app subdomain, so treat localhost as app domain.
    const isLocalHost =
        hostnameOnly === 'localhost' ||
        hostnameOnly === '127.0.0.1' ||
        hostnameOnly === '::1'
    const isAppDomain = hostnameOnly.startsWith('app.') || isLocalHost

    if (isAppDomain) {
        if (!url.pathname.startsWith('/portal')) {
            url.pathname = `/portal${url.pathname}`
        }
    } else {
        if (!url.pathname.startsWith('/marketing')) {
            url.pathname = `/marketing${url.pathname}`
        }
    }

    // Marketing domain: no auth logic needed
    if (!isAppDomain) {
        const marketingResponse = NextResponse.rewrite(url)
        marketingResponse.headers.set('Cache-Control', 'no-store, max-age=0')
        return marketingResponse
    }

    // App domain: refresh the Supabase session so tokens stay valid and cookies
    // are updated on the response. This is critical — Server Components cannot
    // set cookies, so the middleware is the only place that can persist
    // refreshed tokens. Without this, rotating refresh tokens cause an
    // auth ↔ dashboard redirect loop when the access token expires.
    const supabaseResponse = NextResponse.rewrite(url)

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    // Write onto the request (for downstream Server Components) and
                    // onto the response (so the browser stores the refreshed tokens).
                    cookiesToSet.forEach(({ name, value, options }) => {
                        request.cookies.set(name, value)
                        supabaseResponse.cookies.set(name, value, options)
                    })
                },
            },
        }
    )

    // Refresh session if the access token is expired. getSession() only hits
    // the network when a refresh is actually needed (~every hour); for valid
    // tokens it's a fast local cookie decode with no round-trip.
    await supabase.auth.getSession()

    const internalPath = url.pathname // e.g. /portal/learn, /portal/auth (after rewrite above)

    // /waitlist: retired path, always send into the app
    if (internalPath === '/portal/waitlist' || internalPath.startsWith('/portal/waitlist/')) {
        return makeRedirect(request, '/learn', supabaseResponse)
    }

    // Portal root → /learn
    if (
        internalPath === '/portal' ||
        internalPath === '/portal/' ||
        internalPath === '/marketing/portal' ||
        internalPath === '/marketing/portal/'
    ) {
        return makeRedirect(request, '/learn', supabaseResponse)
    }

    return supabaseResponse
}

export const config = {
    matcher: [
        // Match broadly so the canonical www redirect also protects static asset URLs.
        '/:path*',
    ],
}
