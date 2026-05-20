/**
 * Lerno GA4 analytics — typed event tracking over the gtag() global.
 * GA4 property: G-3MBDX6SK3R
 *
 * Usage:
 *   import { track, setUserProperties } from "@/lib/analytics";
 *   track("auth_login", { method: "password" });
 */

declare global {
  function gtag(command: "event", action: string, params?: Record<string, unknown>): void;
  function gtag(command: "set", params: Record<string, unknown>): void;
  function gtag(command: "config", targetId: string, params?: Record<string, unknown>): void;
}

/** Safe gtag wrapper — no-ops if gtag isn't loaded yet (SSR, ad-blockers). */
function gtag_safe(command: "event", action: string, params?: Record<string, unknown>): void;
function gtag_safe(command: "set", params: Record<string, unknown>): void;
function gtag_safe(command: "config", targetId: string, params?: Record<string, unknown>): void;
function gtag_safe(...args: unknown[]): void {
  if (typeof window === "undefined") return;
  if (typeof window.gtag !== "function") return;
  // @ts-expect-error — overload spread
  window.gtag(...args);
}

// ─── User Properties ──────────────────────────────────────────────────────────

export interface UserProperties {
  grade?: string;
  selected_subjects?: string;
  is_onboarded?: boolean;
  access_status?: "granted" | "waitlisted";
}

/** Call after login / onboarding to associate user properties with the session. */
export function setUserProperties(props: UserProperties): void {
  gtag_safe("set", {
    user_properties: {
      ...(props.grade ? { grade: props.grade } : {}),
      ...(props.selected_subjects ? { selected_subjects: props.selected_subjects } : {}),
      ...(props.is_onboarded !== undefined ? { is_onboarded: props.is_onboarded } : {}),
      ...(props.access_status ? { access_status: props.access_status } : {}),
    },
  });
}

// ─── Event catalogue ─────────────────────────────────────────────────────────

export type LernoEvent =
  // Auth
  | { name: "auth_email_submitted"; params?: { user_exists?: boolean } }
  | { name: "auth_login"; params: { method: "password" | "google" } }
  | { name: "auth_signup"; params: { method: "password" | "google" } }
  | { name: "auth_google_initiated"; params?: Record<string, never> }
  | { name: "auth_otp_sent"; params?: Record<string, never> }
  | { name: "auth_otp_verified"; params?: Record<string, never> }
  | { name: "auth_error"; params: { step: string; error_message?: string } }
  // Onboarding
  | { name: "onboarding_step_viewed"; params: { step_number: number; step_name: string } }
  | { name: "onboarding_step_completed"; params: { step_number: number; step_name: string } }
  | { name: "onboarding_completed"; params: { grade: string; subjects_count: number } }
  // Navigation
  | { name: "nav_item_clicked"; params: { item: string } }
  | { name: "nav_new_session"; params?: Record<string, never> }
  | { name: "nav_search_opened"; params?: { trigger?: "keyboard" | "button" } }
  | { name: "nav_analytics_clicked"; params?: Record<string, never> }
  | { name: "nav_sidebar_toggled"; params: { collapsed: boolean } }
  | { name: "feedback_prompt_auto_shown"; params?: Record<string, never> }
  // Learn Mode
  | { name: "learn_subject_selected"; params: { subject: string } }
  | { name: "learn_chapter_opened"; params: { subject: string; chapter_index: number } }
  | { name: "learn_diagnostic_started"; params: { subject: string; chapter_index: number } }
  | { name: "learn_diagnostic_completed"; params: { subject: string; chapter_index: number; score?: number } }
  | { name: "learn_session_started"; params: { subject: string; chapter_index: number } }
  | { name: "learn_message_sent"; params: { subject?: string; input_method?: "text" | "voice"; has_attachment?: boolean } }
  | { name: "learn_ai_response_completed"; params: { task_type?: string; has_citations?: boolean } }
  | { name: "learn_tts_played"; params?: Record<string, never> }
  | { name: "learn_feedback_given"; params: { sentiment: "positive" | "negative" } }
  | { name: "learn_response_copied"; params?: Record<string, never> }
  | { name: "learn_chapter_completed"; params: { subject: string; chapter_index: number } }
  | { name: "learn_simplify_clicked"; params?: Record<string, never> }
  | { name: "learn_continue_clicked"; params?: Record<string, never> }
  // Ask Mode
  | { name: "ask_session_started"; params?: { subject?: string } }
  | { name: "ask_message_sent"; params: { task_type?: string; has_attachment?: boolean; input_method?: "text" | "voice" } }
  | { name: "ask_ai_response_completed"; params: { task_type?: string; has_citations?: boolean } }
  | { name: "ask_file_uploaded"; params: { file_type: "image" | "pdf" } }
  | { name: "ask_session_starred"; params: { starred: boolean } }
  | { name: "ask_feedback_given"; params: { sentiment: "positive" | "negative" } }
  | { name: "ask_response_copied"; params?: Record<string, never> }
  | { name: "ask_tts_played"; params?: Record<string, never> }
  | { name: "ask_quiz_started"; params?: Record<string, never> }
  // Study Feed
  | { name: "study_session_started"; params?: { grade?: string; subject?: string } }
  | { name: "study_answer_submitted"; params: { is_correct: boolean; question_type?: string; subject?: string } }
  | { name: "study_session_ended"; params: { questions_attempted: number; questions_correct: number; duration_secs?: number } }
  | { name: "study_streak_milestone"; params: { streak: number } }
  // Social
  | {
      name: "content_shared";
      params: {
        kind: "question" | "session";
        recipient_id?: string;
        channel?: "dm" | "external_link_copy";
      };
    }
  // Waitlist
  | { name: "waitlist_viewed"; params?: Record<string, never> }
  // Marketing
  | { name: "marketing_cta_clicked"; params: { cta_label: string; location?: string } }
  | { name: "page_view"; params?: { page_title?: string; page_path?: string } };

/** Fire a type-safe GA4 event. */
export function track<E extends LernoEvent>(
  name: E["name"],
  params?: Extract<E, { name: typeof name }>["params"]
): void {
  gtag_safe("event", name, params as Record<string, unknown> | undefined);
}
