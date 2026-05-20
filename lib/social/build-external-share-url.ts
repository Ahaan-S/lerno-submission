/**
 * Builds a shareable URL for third-party apps (WhatsApp, etc.).
 * Uses the browser origin + app routes (middleware serves `/portal/*` internally).
 *
 * Tutor sessions use an opaque share token (`/chat/s/:token`) so recipients can
 * view the conversation read-only; their first reply forks a copy (see
 * `/api/tutor/share/*`). Pass `sessionShareToken` from `POST /api/tutor/share-link`.
 */
export function buildExternalShareUrl(params: {
    origin: string;
    pathname: string | null;
    shareKind: "question" | "session";
    resourceId: string;
    /** Set for tutor sessions after share-link is created */
    sessionShareToken?: string | null;
}): string {
    const { origin, pathname, shareKind, resourceId, sessionShareToken } = params;
    const base = origin.replace(/\/$/, "");

    if (shareKind === "question") {
        return `${base}/study?question=${encodeURIComponent(resourceId)}`;
    }

    if (sessionShareToken?.trim()) {
        return `${base}/chat/s/${encodeURIComponent(sessionShareToken.trim())}`;
    }

    // Fallback when token not ready yet
    if (pathname?.includes("/session/")) {
        const learnMatch = pathname.match(/^\/learn\/([^/]+)\/session\//);
        if (learnMatch) {
            return `${base}/learn/${learnMatch[1]}`;
        }
    }

    if (pathname?.startsWith("/chat/") || pathname?.startsWith("/ask")) {
        return `${base}/ask`;
    }

    return `${base}/ask`;
}
