/**
 * Portal app root: routing is handled in `middleware.ts` to avoid Next.js 16 dev
 * `Performance.measure` errors ("negative time stamp") from RSC `redirect()` on this page.
 */
export default function PortalRootPage() {
    return (
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-neutral-500">
            Loading…
        </div>
    )
}
