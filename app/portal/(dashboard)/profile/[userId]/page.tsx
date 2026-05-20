import { ProfilePageClient } from "@/components/profile/ProfilePageClient";

/**
 * Public user profile — auth provided by the (dashboard) layout.
 * ProfilePageClient fetches the target user's public data itself (client-side),
 * protected by Supabase RLS — only public-profile rows are visible.
 */
export default async function PublicProfilePage({
    params,
}: {
    params: Promise<{ userId: string }>;
}) {
    const { userId } = await params;
    return <ProfilePageClient userId={userId} />;
}
