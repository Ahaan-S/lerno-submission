import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

/** GET — current user's profile fields for settings UI */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [{ data: profile }, { data: social }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, first_name, last_name, avatar_url, grade, selected_subjects, notification_preferences")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("social_profiles")
      .select("bio, profile_privacy, display_name")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  return NextResponse.json({
    user_id: user.id,
    email: user.email ?? null,
    full_name: profile?.full_name ?? null,
    first_name: profile?.first_name ?? null,
    last_name: profile?.last_name ?? null,
    avatar_url: profile?.avatar_url ?? null,
    grade: profile?.grade ?? null,
    selected_subjects: profile?.selected_subjects ?? null,
    notification_preferences: profile?.notification_preferences ?? null,
    bio: social?.bio ?? null,
    profile_privacy: social?.profile_privacy ?? "public",
    display_name: social?.display_name ?? null,
  });
}

type Privacy = "public" | "friends_only" | "private";

function isPrivacy(v: unknown): v is Privacy {
  return v === "public" || v === "friends_only" || v === "private";
}

/** PATCH — update social profile (bio, profile_privacy, display_name) for the signed-in user */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    bio?: string | null;
    profile_privacy?: unknown;
    display_name?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const hasField =
    body.bio !== undefined || body.display_name !== undefined || body.profile_privacy !== undefined;
  if (!hasField) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.bio !== undefined) {
    const s = typeof body.bio === "string" ? body.bio.trim().slice(0, 500) : "";
    patch.bio = s.length ? s : null;
  }

  if (body.display_name !== undefined) {
    const s = typeof body.display_name === "string" ? body.display_name.trim().slice(0, 40) : "";
    patch.display_name = s.length ? s : null;
  }

  if (body.profile_privacy !== undefined) {
    if (!isPrivacy(body.profile_privacy)) {
      return NextResponse.json({ error: "Invalid profile_privacy" }, { status: 400 });
    }
    patch.profile_privacy = body.profile_privacy;
  }

  const { data: existing } = await supabase
    .from("social_profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) {
    const { error: insErr } = await supabase.from("social_profiles").insert({
      user_id: user.id,
      bio: (patch.bio as string | null | undefined) ?? null,
      display_name: (patch.display_name as string | null | undefined) ?? null,
      profile_privacy: (patch.profile_privacy as Privacy | undefined) ?? "public",
      updated_at: patch.updated_at as string,
    });
    if (insErr) {
      console.error("[profile/me] insert social_profiles", insErr);
      return NextResponse.json({ error: "Failed to save" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase.from("social_profiles").update(patch).eq("user_id", user.id);

  if (error) {
    console.error("[profile/me] update", error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
