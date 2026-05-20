/**
 * Supabase database types for lerno-web
 * Matches schema in supabase/migrations/
 */

import type { GraphArtifact } from "@/lib/graphs/types";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type TutorMessageRole = "user" | "assistant";
export type TutorTaskType = "explain" | "notes" | "quiz" | "solve" | "summary";
export type MasteryLevel = "not_started" | "learning" | "weak" | "strong";

// Memory system types
export type MemoryEntryType =
  | "recently_discussed"
  | "confusion_signal"
  | "style_preference"
  | "mistake_pattern"
  | "onboarding_fact";

export type MemoryConfidence = "onboarding" | "observed_once" | "observed_multiple" | "quiz_verified";
export type MemorySource = "onboarding" | "chat_session" | "quiz";
export type MasterySource = "unassessed" | "quiz_verified" | "ai_inferred";

export interface InlineCitation {
  index: number;
  chunk_id: string;
  chapter_name?: string;
  chapter_index?: string;
  topic_name?: string;
  topic_index?: string;
  subtopic_name?: string;
  subtopic_index?: string;
  page_start?: number;
  page_end?: number;
  content: string;
  book: string;
  referenced_figures?: string[];
}

// Legacy alias so existing code doesn't break
export type CitationChunk = InlineCitation;

export type AttachmentMeta = {
  url: string;           // Supabase Storage signed URL (1-year expiry) — used in UI for preview
  path: string;          // Storage path: "{user_id}/{session_id}/{timestamp}_{filename}"
  name: string;          // Original filename e.g. "question_paper.jpg"
  type: string;          // MIME type: "image/jpeg" | "image/png" | "application/pdf" | etc.
  size: number;          // File size in bytes
  extracted_text: string | null; // PDF text content (null for images)
  description: string | null;    // AI-generated image description (null for PDFs/non-images)
};

export interface TutorSession {
  id: string;
  user_id: string;
  subject: string;
  chapter_name: string | null;
  chapter_index: string | null;
  title: string | null;
  starred: boolean;
  created_at: string;
  last_message_at: string;
  session_rating: number | null;
  session_rating_comment: string | null;
}

export interface TutorSessionInsert {
  user_id: string;
  subject: string;
  chapter_name?: string | null;
  chapter_index?: string | null;
  title?: string | null;
}

export interface TutorSessionUpdate {
  subject?: string;
  chapter_name?: string | null;
  chapter_index?: string | null;
  title?: string | null;
  starred?: boolean;
  last_message_at?: string;
}

export interface TutorMessage {
  id: string;
  session_id: string;
  role: TutorMessageRole;
  content: string;
  /** Shown in UI instead of `content` when present (e.g. Learn Mode tool prompts). */
  display_content: string | null;
  task_type: TutorTaskType | null;
  citations: InlineCitation[] | null;
  graph_artifacts: GraphArtifact[] | null;
  thinking: Json | null;
  created_at: string;
}

export interface TutorMessageInsert {
  session_id: string;
  role: TutorMessageRole;
  content: string;
  display_content?: string | null;
  task_type?: TutorTaskType | null;
  citations?: InlineCitation[] | null;
  graph_artifacts?: GraphArtifact[] | null;
  thinking?: Json | null;
}

export interface StrugglePattern {
  pattern: string;
  evidence: string;
}

export interface StudentAiMemory {
  id: string;
  user_id: string;
  subject: string;
  memory_summary: string | null;
  weak_topics: string[] | null;                      // quiz-verified only
  strong_topics: string[] | null;                    // quiz-verified only
  recently_discussed_topics: string[] | null;        // from chat sessions (not mastery signals)
  common_mistakes: string[] | null;
  learning_pace?: string | null;
  preferred_style?: string | null;
  struggle_patterns?: StrugglePattern[] | null;
  total_sessions?: number | null;
  total_messages?: number | null;
  last_session_at?: string | null;
  chapters_visited?: string[] | null;
  onboarding_seeded?: boolean | null;
  created_at?: string | null;
  updated_at: string;
}

export interface StudentAiMemoryInsert {
  user_id: string;
  subject: string;
  memory_summary?: string | null;
  weak_topics?: string[] | null;
  strong_topics?: string[] | null;
  recently_discussed_topics?: string[] | null;
  common_mistakes?: string[] | null;
  onboarding_seeded?: boolean | null;
}

export interface StudentAiMemoryUpdate {
  memory_summary?: string | null;
  weak_topics?: string[] | null;
  strong_topics?: string[] | null;
  recently_discussed_topics?: string[] | null;
  common_mistakes?: string[] | null;
  onboarding_seeded?: boolean | null;
  updated_at?: string;
}

export interface StudentTopicProgress {
  id: string;
  user_id: string;
  subject: string;
  chapter_index: string;
  topic_index: string;
  topic_name: string | null;
  mastery_level: MasteryLevel;
  mastery_source?: MasterySource;
  quiz_attempts?: number;
  quiz_correct?: number;
  last_practiced_at: string | null;
}

export interface StudentTopicProgressInsert {
  user_id: string;
  subject: string;
  chapter_index: string;
  topic_index: string;
  topic_name?: string | null;
  mastery_level?: MasteryLevel;
  mastery_source?: MasterySource;
  quiz_attempts?: number;
  quiz_correct?: number;
  last_practiced_at?: string | null;
}

export interface StudentTopicProgressUpdate {
  topic_name?: string | null;
  mastery_level?: MasteryLevel;
  mastery_source?: MasterySource;
  quiz_attempts?: number;
  quiz_correct?: number;
  last_practiced_at?: string | null;
}

export interface MemoryEntry {
  id: string;
  user_id: string;
  subject: string;
  entry_type: MemoryEntryType;
  content: string;
  confidence: MemoryConfidence;
  source: MemorySource;
  session_id: string | null;
  created_at: string;
  last_confirmed_at: string;
}

export interface MemoryEntryInsert {
  user_id: string;
  subject: string;
  entry_type: MemoryEntryType;
  content: string;
  confidence?: MemoryConfidence;
  source: MemorySource;
  session_id?: string | null;
}

export type ChapterProgressStatus = "not_started" | "diagnostic_done" | "in_progress" | "completed";

export interface ChapterLearnProgress {
  id: string;
  user_id: string;
  subject: string;
  chapter_index: number;
  chapter_name: string;
  status: ChapterProgressStatus;
  diagnostic_completed: boolean;
  diagnostic_score: Record<string, number> | null;
  current_topic_index: string | null;
  current_subtopic_index: string | null;
  topics_completed: string[];
  sessions_count: number;
  last_session_id: string | null;
  last_session_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChapterLearnProgressInsert {
  user_id: string;
  subject: string;
  chapter_index: number;
  chapter_name: string;
  status?: ChapterProgressStatus;
  diagnostic_completed?: boolean;
  diagnostic_score?: Record<string, number> | null;
  current_topic_index?: string | null;
  current_subtopic_index?: string | null;
  topics_completed?: string[];
  sessions_count?: number;
  last_session_id?: string | null;
  last_session_at?: string | null;
  started_at?: string | null;
}

export interface ChapterLearnProgressUpdate {
  status?: ChapterProgressStatus;
  diagnostic_completed?: boolean;
  diagnostic_score?: Record<string, number> | null;
  current_topic_index?: string | null;
  current_subtopic_index?: string | null;
  topics_completed?: string[];
  sessions_count?: number;
  last_session_id?: string | null;
  last_session_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  updated_at?: string;
}

export interface RetrievedChunksLog {
  id: string;
  message_id: string;
  chunk_id: string;
  relevance_score: number | null;
  was_used: boolean;
  created_at: string;
}

export interface RetrievedChunksLogInsert {
  message_id: string;
  chunk_id: string;
  relevance_score?: number | null;
  was_used?: boolean;
}

/** Full Database type for Supabase client — use createBrowserClient<Database>() */
export interface Database {
  public: {
    Tables: {
      tutor_sessions: {
        Row: TutorSession;
        Insert: TutorSessionInsert & { id?: string; created_at?: string; last_message_at?: string };
        Update: TutorSessionUpdate & Partial<TutorSessionInsert>;
      };
      tutor_messages: {
        Row: TutorMessage;
        Insert: TutorMessageInsert & { id?: string; created_at?: string };
        Update: Partial<TutorMessageInsert>;
      };
      student_ai_memory: {
        Row: StudentAiMemory;
        Insert: StudentAiMemoryInsert & { id?: string; updated_at?: string };
        Update: StudentAiMemoryUpdate & Partial<StudentAiMemoryInsert>;
      };
      student_topic_progress: {
        Row: StudentTopicProgress;
        Insert: StudentTopicProgressInsert & { id?: string };
        Update: StudentTopicProgressUpdate & Partial<StudentTopicProgressInsert>;
      };
      retrieved_chunks_log: {
        Row: RetrievedChunksLog;
        Insert: RetrievedChunksLogInsert & { id?: string; created_at?: string };
        Update: Partial<RetrievedChunksLogInsert>;
      };
      memory_entries: {
        Row: MemoryEntry;
        Insert: MemoryEntryInsert & { id?: string; created_at?: string; last_confirmed_at?: string };
        Update: Partial<MemoryEntryInsert>;
      };
      general_feedback: {
        Row: GeneralFeedback;
        Insert: GeneralFeedbackInsert & { id?: string; created_at?: string };
        Update: Partial<GeneralFeedbackInsert>;
      };
    };
  };
}

export interface GeneralFeedback {
  id: string;
  user_id: string;
  type: "issue" | "suggestion" | "general";
  message: string;
  grade: string | null;
  created_at: string;
}

export interface GeneralFeedbackInsert {
  user_id: string;
  type?: "issue" | "suggestion" | "general";
  message: string;
  grade?: string | null;
}
