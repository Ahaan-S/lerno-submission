import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/** GET /api/planner/stats?date=YYYY-MM-DD&dayStart=ISO&dayEnd=ISO — day bounds should be the viewer's local start/end of day for correct calendar overlap. */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const dayStart = searchParams.get("dayStart");
  const dayEnd = searchParams.get("dayEnd");

  const { data } = await supabase
    .from("daily_study_stats")
    .select("total_minutes, subjects_covered, events_completed, backlog_reduced")
    .eq("user_id", user.id)
    .eq("date", date)
    .maybeSingle();

  let scheduled_minutes = 0;
  const calendarSubjects = new Set<string>();

  if (dayStart && dayEnd) {
    const { data: events, error } = await supabase
      .from("study_events")
      .select("subject, duration_minutes, status, start_time, end_time")
      .eq("user_id", user.id)
      .lt("start_time", dayEnd)
      .gt("end_time", dayStart);

    if (!error && events?.length) {
      for (const ev of events) {
        if (ev.status === "skipped") continue;
        calendarSubjects.add(ev.subject);
        if (ev.status === "scheduled" || ev.status === "in_progress") {
          scheduled_minutes += ev.duration_minutes ?? 0;
        }
      }
    }
  }

  const studiedSubjects = (data?.subjects_covered as string[]) ?? [];

  return NextResponse.json({
    total_minutes: data?.total_minutes ?? 0,
    subjects_covered: studiedSubjects,
    events_completed: data?.events_completed ?? 0,
    backlog_reduced: data?.backlog_reduced ?? 0,
    scheduled_minutes,
    subjects_on_calendar: [...calendarSubjects],
  });
}
