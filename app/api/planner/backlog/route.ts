import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/** GET /api/planner/backlog */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const completed = searchParams.get("completed");
  const completedStart = searchParams.get("completedStart");
  const completedEnd = searchParams.get("completedEnd");

  let query = supabase
    .from("study_backlog")
    .select("*")
    .eq("user_id", user.id);

  if (completed === "true") {
    query = query
      .eq("completed", true)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(20);

    if (completedStart && completedEnd) {
      query = query.gte("completed_at", completedStart).lt("completed_at", completedEnd);
    }
  } else {
    query = query
      .eq("completed", false)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(20);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data ?? [] });
}

/** POST /api/planner/backlog */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    title: string;
    subject: string;
    priority?: "low" | "medium" | "high";
    estimated_minutes?: number;
    due_date?: string;
  };

  if (!body.title || !body.subject) {
    return NextResponse.json({ error: "title and subject are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("study_backlog")
    .insert({
      user_id: user.id,
      title: body.title,
      subject: body.subject,
      priority: body.priority ?? "medium",
      estimated_minutes: body.estimated_minutes ?? 45,
      due_date: body.due_date ?? null,
      completed: false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ item: data }, { status: 201 });
}
