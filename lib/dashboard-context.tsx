"use client";

import { createContext, useContext } from "react";

interface DashboardGradeContextValue {
    grade: number;
    selectedSubjects: string[];
}

const DashboardGradeContext = createContext<DashboardGradeContextValue>({
    grade: 9,
    selectedSubjects: [],
});

export function DashboardGradeProvider({
    grade,
    selectedSubjects,
    children,
}: {
    grade: number;
    selectedSubjects: string[];
    children: React.ReactNode;
}) {
    return (
        <DashboardGradeContext.Provider value={{ grade, selectedSubjects }}>
            {children}
        </DashboardGradeContext.Provider>
    );
}

export function useDashboardGrade(): DashboardGradeContextValue {
    return useContext(DashboardGradeContext);
}
