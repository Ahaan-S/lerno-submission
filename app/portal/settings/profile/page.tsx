import React from "react";
import { TutoringSessionProvider } from "@/lib/tutoring-session-context";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { ProfileSettingsPanel } from "@/components/profile/ProfileSettingsPanel";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function ProfileSettingsPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            /* ignore */
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  let profile: { onboarding_completed?: boolean | null; full_name?: string | null } | null = null;
  const { data: profileData } = await supabase
    .from("profiles")
    .select("onboarding_completed, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profileData) {
    const { data: createdProfile } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        email: user.email ?? null,
        full_name: user.user_metadata?.full_name ?? null,
        onboarding_completed: false,
      })
      .select("onboarding_completed, full_name")
      .single();
    profile = createdProfile;
  } else {
    profile = profileData;
  }

  if (profile?.onboarding_completed !== true) {
    redirect("/onboarding");
  }

  const userForShell = {
    email: user.email,
    user_metadata: {
      ...user.user_metadata,
      full_name: profile?.full_name ?? user.user_metadata?.full_name,
    },
  };

  return (
    <TutoringSessionProvider>
      <DashboardShell user={userForShell} fullHeightContent>
        <div className="max-w-xl mx-auto px-5 sm:px-8 py-10" style={{ fontFamily: "var(--font-inter)" }}>
          <div className="mb-8">
            <Link
              href="/learn"
              className="text-[13px] font-medium text-[var(--base-500)] hover:text-[var(--base-700)]"
            >
              ← Back
            </Link>
            <h1 className="text-[22px] font-bold text-[var(--base-800)] mt-3 tracking-tight">Public profile</h1>
            <p className="text-[14px] text-[var(--base-500)] mt-1">
              Photo, bio, and who can see your learning stats.
            </p>
            <Link
              href={`/profile/${user.id}`}
              className="inline-block mt-3 text-[13px] font-semibold text-[var(--primary-500)] hover:underline"
            >
              Preview my profile
            </Link>
          </div>
          <ProfileSettingsPanel />
        </div>
      </DashboardShell>
    </TutoringSessionProvider>
  );
}
