import { Suspense } from "react";
import { FriendsListPage } from "@/components/social/FriendsListPage";

/**
 * Friends — auth/profile provided by the (dashboard) layout.
 * Shell stays mounted when navigating from any other (dashboard) route.
 */
export default function FriendsPage() {
    return (
        <Suspense
            fallback={
                <div
                    className="flex flex-1 items-center justify-center p-8 text-[14px] text-(--base-500)"
                    style={{ fontFamily: "var(--font-inter)" }}
                >
                    Loading friends…
                </div>
            }
        >
            <FriendsListPage />
        </Suspense>
    );
}
