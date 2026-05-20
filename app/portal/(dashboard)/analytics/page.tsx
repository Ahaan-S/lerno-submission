import AnalyticsContentWrapper from "@/components/analytics/AnalyticsContentWrapper";
import { DashboardBreadcrumbSetter } from "@/lib/dashboard-header-context";

/**
 * Analytics — auth/profile/subjects provided by the (dashboard) layout.
 * No server fetch needed here: grade + selectedSubjects come from layout context.
 */
export default function AnalyticsPage() {
    return (
        <>
            <DashboardBreadcrumbSetter crumbs={[{ label: "Analytics" }]} />
            <AnalyticsContentWrapper />
        </>
    );
}
