import type { ChatMessage } from "@/components/dashboard/DashboardContent";

type Row = {
    id?: string;
    role: string;
    content: string;
    task_type?: string | null;
    citations?: unknown;
    graph_artifacts?: unknown;
    thinking?: unknown;
    attachments?: unknown;
    created_at?: string;
};

/** Maps DB tutor_messages rows to DashboardContent `ChatMessage[]` (matches chat session page). */
export function mapTutorRowsToInitialMessages(rows: Row[]): ChatMessage[] {
    return rows.map((row) => {
        const taskType = row.task_type ?? null;
        const thinking = row.thinking as {
            _kind?: string;
            document?: unknown;
            quiz?: unknown;
            elapsedMs?: number;
            steps?: object[];
        } | null;

        if (
            row.role === "assistant" &&
            (taskType === "notes" || taskType === "summary") &&
            thinking?._kind === "doc" &&
            thinking.document
        ) {
            return {
                id: row.id,
                role: "assistant" as const,
                content: row.content,
                created_at: row.created_at,
                isDocGen: true as const,
                isComplete: true as const,
                document: thinking.document as import("@/lib/ai/doc-types").GeneratedDocument,
                doc_id: null,
                progressEvents: (thinking.steps ?? []) as object[],
                generationElapsedMs: thinking.elapsedMs,
            };
        }

        if (
            row.role === "assistant" &&
            taskType === "quiz" &&
            thinking?._kind === "quiz" &&
            thinking.quiz
        ) {
            return {
                id: row.id,
                role: "assistant" as const,
                content: row.content,
                created_at: row.created_at,
                isQuiz: true as const,
                isComplete: true as const,
                quiz: thinking.quiz as import("@/lib/ai/doc-types").QuizDocument,
                progressEvents: [],
            };
        }

        return {
            id: row.id,
            role: row.role as "user" | "assistant",
            content: row.content,
            attachments: (row.attachments as import("@/lib/database.types").AttachmentMeta[] | null) ?? undefined,
            citations: (row.citations as import("@/lib/database.types").InlineCitation[] | null) ?? undefined,
            graph_artifacts: (row.graph_artifacts as import("@/lib/graphs/types").GraphArtifact[] | null) ?? undefined,
            thinking: (row.thinking as import("@/components/ui/ThinkingBlock").ThinkingData | null) ?? undefined,
            created_at: row.created_at,
        };
    });
}
