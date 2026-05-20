import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAdminOrNull } from "@/lib/social/friend-api-helpers";

type SocialEmbed = { display_name: string | null } | { display_name: string | null }[] | null;

function firstSocial(sp: SocialEmbed): { display_name: string | null } | null {
    if (!sp) return null;
    return Array.isArray(sp) ? sp[0] ?? null : sp;
}

/** GET — pending requests sent by current user */
export async function GET() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getAdminOrNull() ?? supabase;

    const { data, error } = await db
        .from("friend_requests")
        .select(
            `
      id,
      message,
      created_at,
      expires_at,
      recipient:profiles!friend_requests_recipient_id_fkey (
        id,
        full_name,
        email,
        grade,
        social_profiles (
          display_name
        )
      )
    `
        )
        .eq("sender_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("[friends/requests/outgoing] GET", error);
        return NextResponse.json({ error: "Failed to load" }, { status: 500 });
    }

    const rows = (data ?? []) as {
        id: string;
        message: string | null;
        created_at: string;
        expires_at: string;
        recipient:
            | {
                  id: string;
                  full_name: string | null;
                  email: string | null;
                  grade: string | number | null;
                  social_profiles: SocialEmbed;
              }
            | {
                  id: string;
                  full_name: string | null;
                  email: string | null;
                  grade: string | number | null;
                  social_profiles: SocialEmbed;
              }[]
            | null;
    }[];

    const requests = rows.map((r) => {
        const rc = Array.isArray(r.recipient) ? r.recipient[0] : r.recipient;
        const sp = rc ? firstSocial(rc.social_profiles) : null;
        const display =
            sp?.display_name?.trim() || rc?.full_name?.trim() || null;
        return {
            id: r.id,
            message: r.message,
            createdAt: r.created_at,
            expiresAt: r.expires_at,
            recipient: rc
                ? {
                      id: rc.id,
                      fullName: display,
                      email: rc.email,
                      grade: rc.grade,
                  }
                : null,
        };
    });

    return NextResponse.json({ requests });
}
