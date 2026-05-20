/** Payload stored on direct_messages.metadata for question_share rows */
export type QuestionShareMetadata = {
    question_id: string;
    question_code: string | null;
    grade: number;
    subject: string;
    chapter_name: string;
    chapter_index: number;
    question_type: string;
    preview: string;
    has_image?: boolean;
    question_image_url?: string | null;
};

/** Payload stored on direct_messages.metadata for session_share rows */
export type SessionShareMetadata = {
    session_id: string;
    /** Opaque token for `/chat/s/:token` (recipient read-only + fork on reply) */
    share_token?: string;
    subject: string;
    title: string | null;
    grade: number | null;
    mode: "ask" | "learn" | string;
    chapter_name: string | null;
    chapter_index: string | null;
};
