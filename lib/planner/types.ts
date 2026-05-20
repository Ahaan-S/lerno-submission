export interface StudyEvent {
  id: string;
  user_id: string;
  title: string;
  subject: string;
  chapter_index?: number;
  chapter_name?: string;
  topic?: string;
  related_exam?: string;
  difficulty?: "easy" | "medium" | "hard";
  notes?: string;
  start_time: string; // ISO
  end_time: string;   // ISO
  duration_minutes: number;
  status: "scheduled" | "completed" | "skipped" | "in_progress";
  /** When false, shown on calendar only — excluded from Today’s Focus and cannot be completed. */
  is_task?: boolean;
  completed_at?: string;
  google_event_id?: string;
  color?: string;
  /** Shared UUID across all occurrences of a recurring series. Null for one-off events. */
  recurrence_group_id?: string | null;
  /** AI exam plan run that created this event, when applicable. */
  plan_run_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BacklogItem {
  id: string;
  user_id: string;
  title: string;
  subject: string;
  priority: "low" | "medium" | "high";
  estimated_minutes: number;
  due_date?: string;
  completed: boolean;
  completed_at?: string;
  created_at: string;
}

export interface DailyStats {
  total_minutes: number;
  /** Subjects with completed study time today (from daily_study_stats). */
  subjects_covered: string[];
  events_completed: number;
  backlog_reduced: number;
  /** Minutes scheduled for today (scheduled / in_progress events overlapping local day). */
  scheduled_minutes: number;
  /** Unique subjects with any calendar block today (excluding skipped). */
  subjects_on_calendar: string[];
}

export interface AiSuggestion {
  suggestion: string;
  recommended_subject: string;
  recommended_duration_minutes: number;
  urgency: "low" | "medium" | "high";
}

export interface SubjectUrgency {
  subject: string;
  daysSinceStudied: number;
  weakTopicCount: number;
  completionPct: number;
  urgencyScore: number;
}

export interface ExamPlanQuestionOption {
  id: string;
  label: string;
  description?: string;
}

export interface ExamPlanQuestion {
  id: string;
  type: "single_choice" | "multi_choice" | "short_text";
  title: string;
  helper?: string;
  required?: boolean;
  options?: ExamPlanQuestionOption[];
}

export interface ExamPlanDraftEvent {
  title: string;
  subject: string;
  chapter_index?: number | null;
  chapter_name?: string | null;
  topic?: string | null;
  difficulty?: "easy" | "medium" | "hard" | null;
  notes?: string | null;
  start_time: string;
  duration_minutes: number;
}

export interface ExamPlanSummary {
  headline: string;
  total_blocks: number;
  total_minutes: number;
  focus_notes: string[];
}
