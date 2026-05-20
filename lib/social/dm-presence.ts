/** Treat user as "online" if heartbeat within this window (Instagram-style). */
export const DM_ONLINE_WINDOW_MS = 180_000;

export function isPeerOnline(lastSeenIso: string | null | undefined, nowMs = Date.now()): boolean {
    if (!lastSeenIso) return false;
    const t = new Date(lastSeenIso).getTime();
    if (Number.isNaN(t)) return false;
    return nowMs - t < DM_ONLINE_WINDOW_MS;
}

/** Short label for thread header: "Active now" | "Last seen …" */
export function formatPeerPresenceLine(lastSeenIso: string | null | undefined, nowMs = Date.now()): string {
    if (!lastSeenIso) return "Friends on Lerno";
    if (isPeerOnline(lastSeenIso, nowMs)) return "Active now";

    const d = new Date(lastSeenIso);
    if (Number.isNaN(d.getTime())) return "Friends on Lerno";

    const diffMs = nowMs - d.getTime();
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 1) return "Last seen just now";
    if (mins < 60) return `Last seen ${mins}m ago`;

    const hours = Math.floor(mins / 60);
    if (hours < 24 && isSameLocalDay(d, new Date(nowMs))) {
        const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
        return `Last seen today at ${time}`;
    }

    const yesterday = new Date(nowMs);
    yesterday.setDate(yesterday.getDate() - 1);
    if (isSameLocalDay(d, yesterday)) {
        const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
        return `Last seen yesterday at ${time}`;
    }

    const dateStr = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return `Last seen ${dateStr} at ${time}`;
}

function isSameLocalDay(a: Date, b: Date): boolean {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

/** Small caption under own bubbles when peer has read (Instagram-style). */
export function formatSeenCaption(readAtIso: string): string {
    const d = new Date(readAtIso);
    if (Number.isNaN(d.getTime())) return "Seen";
    const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return `Seen · ${time}`;
}
