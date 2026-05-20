import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/** GET — Return paginated sessions for the current user, filtered by grade and optionally by mode */
export async function GET(request: Request) {
  console.log("[tutor/sessions] GET request received");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.log("[tutor/sessions] Unauthorized: no user");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch user's current grade so we only return sessions from the same grade
  const { data: profile } = await supabase
    .from("profiles")
    .select("grade")
    .eq("id", user.id)
    .maybeSingle();
  const rawGrade = profile?.grade;
  const userGrade =
    typeof rawGrade === "string" && rawGrade.startsWith("Class ")
      ? Number(rawGrade.replace("Class ", ""))
      : Number(rawGrade ?? null);
  const gradeNum = Number.isFinite(userGrade) ? userGrade : null;

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20"), 50);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");
  const mode = url.searchParams.get("mode"); // "learn" | "ask" | null (all)
  const q = url.searchParams.get("q")?.trim() ?? "";

  let query = supabase
    .from("tutor_sessions")
    .select("id, subject, title, starred, created_at, last_message_at, mode")
    .eq("user_id", user.id)
    .order("last_message_at", { ascending: false });

  // Strict grade filter: only show sessions for the user's current grade.
  if (gradeNum !== null) {
    query = query.eq("grade", gradeNum);
  }

  if (q) {
    // Search by title; ignore mode filter when searching
    query = query.ilike("title", `%${q}%`);
  } else if (mode === "learn" || mode === "ask") {
    query = query.eq("mode", mode);
  }

  const { data, error } = await query.range(offset, offset + limit - 1);

  if (error) {
    console.error("[tutor/sessions] Fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 });
  }

  const sessions = data ?? [];
  console.log("[tutor/sessions] Returning", sessions.length, "sessions (offset", offset, ", mode", mode ?? "all", ", grade", gradeNum, ")");
  return NextResponse.json({ sessions, hasMore: sessions.length === limit });
}
