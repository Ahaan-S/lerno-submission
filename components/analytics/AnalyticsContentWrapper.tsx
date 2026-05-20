"use client";

import { AnalyticsShell } from "@/components/analytics/AnalyticsShell";
import { useDashboardGrade } from "@/lib/dashboard-context";

/**
 * Reads grade + selectedSubjects from the shared DashboardGradeContext
 * (provided by the (dashboard) route group layout) and renders AnalyticsShell.
 * No server fetch needed — all data was resolved by the layout.
 */
export default function AnalyticsContentWrapper() {
    const { grade, selectedSubjects } = useDashboardGrade();
    const safeSubjects = selectedSubjects.length > 0 ? selectedSubjects : ["science"];
    return <AnalyticsShell grade={grade} subjectIds={safeSubjects} />;
}
