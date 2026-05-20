import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import OnboardingFlow from "@/components/onboarding/OnboardingFlow";

export default async function OnboardingPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect("/auth");

    let { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed, full_name")
        .eq("id", user.id)
        .maybeSingle();

    if (!profile) {
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
    }

    if (profile?.onboarding_completed) redirect("/learn");

    return <OnboardingFlow />;
}
