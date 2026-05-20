export type DmInboxThread = {
    threadId: string;
    peerUserId: string;
    displayName: string;
    fullName: string | null;
    grade: string | number | null;
    avatarUrl: string | null;
    lastMessageAt: string;
    preview: string;
    unreadCount: number;
    /** Peer heartbeat for online / last seen (optional until API returns it). */
    peerLastSeenAt?: string | null;
};

export type DmMessageRow = {
    id: string;
    thread_id: string;
    sender_id: string;
    content: string;
    message_type: string;
    metadata: unknown;
    read_at: string | null;
    created_at: string;
};
