import { getSessionUser } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import AuthPageView from "@/components/auth/AuthPageView";

export default async function AuthPage() {
    // Use getSession (cookie-read, no auth-server round trip) — middleware guards
    // access so this is just a fast redirect gate for already-authed users.
    const { user } = await getSessionUser();
    if (user) redirect("/learn");

    return <AuthPageView />;
}
