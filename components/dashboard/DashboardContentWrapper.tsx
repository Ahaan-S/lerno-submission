"use client";

import DashboardContent from "@/components/dashboard/DashboardContent";
import { useDashboardGrade } from "@/lib/dashboard-context";

/**
 * Thin client wrapper that reads grade + selectedSubjects from the shared
 * DashboardGradeContext (set by the (dashboard) route group layout) and passes
 * them to DashboardContent — eliminating the redundant Supabase profiles query
 * that DashboardContent used to run on every mount.
 *
 * This exists because Next.js App Router layouts cannot pass props directly to
 * page children — a client context bridge is the standard solution.
 */
export default function DashboardContentWrapper() {
    const { grade, selectedSubjects } = useDashboardGrade();
    return <DashboardContent grade={grade} selectedSubjects={selectedSubjects} />;
}
