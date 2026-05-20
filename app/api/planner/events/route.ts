import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { addMinutes } from "date-fns";

/** GET /api/planner/events — rangeStart & rangeEnd ISO (recommended), or legacy start/end */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const rangeStart = searchParams.get("rangeStart");
  const rangeEnd = searchParams.get("rangeEnd");
  const legacyStart = searchParams.get("start");
  const legacyEnd = searchParams.get("end");

  let query = supabase
    .from("study_events")
    .select("*")
    .eq("user_id", user.id)
    .order("start_time", { ascending: true });

  if (rangeStart && rangeEnd) {
    query = query.lt("start_time", rangeEnd).gt("end_time", rangeStart);
  } else if (legacyStart && legacyEnd) {
    query = query.gte("start_time", legacyStart).lte("start_time", legacyEnd);
  } else if (legacyStart) {
    query = query.gte("start_time", legacyStart);
  } else if (legacyEnd) {
    query = query.lte("start_time", legacyEnd);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ events: data ?? [] });
}

/** POST /api/planner/events */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    title: string;
    subject?: string;
    chapter_index?: number;
    chapter_name?: string;
    topic?: string;
    related_exam?: string;
    difficulty?: "easy" | "medium" | "hard";
    notes?: string;
    start_time: string;
    duration_minutes: number;
    color?: string;
    /** Default true: study task. false = calendar-only (not in focus, not completable). */
    is_task?: boolean;
    /** Shared UUID across all occurrences of a recurring series. */
    recurrence_group_id?: string;
    /** AI exam plan run that created this event, when applicable. */
    plan_run_id?: string;
  };

  if (!body.title || !body.start_time || !body.duration_minutes) {
    return NextResponse.json({ error: "title, start_time, and duration_minutes are required" }, { status: 400 });
  }

  const end_time = addMinutes(new Date(body.start_time), body.duration_minutes).toISOString();

  const { data, error } = await supabase
    .from("study_events")
    .insert({
      user_id: user.id,
      title: body.title,
      subject: body.subject ?? "",
      chapter_index: body.chapter_index ?? null,
      chapter_name: body.chapter_name ?? null,
      topic: body.topic ?? null,
      related_exam: body.related_exam ?? null,
      difficulty: body.difficulty ?? null,
      notes: body.notes ?? null,
      start_time: body.start_time,
      end_time,
      duration_minutes: body.duration_minutes,
      color: body.color ?? null,
      status: "scheduled",
      is_task: body.is_task === false ? false : true,
      recurrence_group_id: body.recurrence_group_id ?? null,
      plan_run_id: body.plan_run_id ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ event: data }, { status: 201 });
}
