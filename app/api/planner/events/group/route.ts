import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/** PATCH /api/planner/events/group
 *  Body: { group_id: string, fields: { title?, subject?, topic?, difficulty?, notes?, is_task?, duration_minutes? } }
 *  Updates all events in the recurrence group with the given fields.
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    group_id: string;
    fields: {
      title?: string;
      subject?: string;
      topic?: string;
      related_exam?: string;
      difficulty?: "easy" | "medium" | "hard";
      notes?: string;
      is_task?: boolean;
    };
  };

  if (!body.group_id) {
    return NextResponse.json({ error: "group_id is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("study_events")
    .update({ ...body.fields, updated_at: new Date().toISOString() })
    .eq("recurrence_group_id", body.group_id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
