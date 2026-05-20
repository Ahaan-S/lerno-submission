import { Suspense } from "react";
import StudyFeed from "@/components/study/StudyFeed";

/** Study Feed — auth/profile/shell provided by the (dashboard) layout. */
export default function StudyPage() {
    return (
        <Suspense
            fallback={
                <div
                    className="flex flex-1 items-center justify-center p-8 text-[14px] text-(--base-500)"
                    style={{ fontFamily: "var(--font-inter)" }}
                >
                    Loading study feed…
                </div>
            }
        >
            <StudyFeed />
        </Suspense>
    );
}
