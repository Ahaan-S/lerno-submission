"use client";

import { createContext, useContext, useState, useEffect } from "react";

export type BreadcrumbItem = { label: string; href?: string };

interface DashboardHeaderContextValue {
    breadcrumb: BreadcrumbItem[] | null;
    setBreadcrumb: (crumbs: BreadcrumbItem[] | null) => void;
}

const DashboardHeaderContext = createContext<DashboardHeaderContextValue>({
    breadcrumb: null,
    setBreadcrumb: () => {},
});

export function DashboardHeaderProvider({ children }: { children: React.ReactNode }) {
    const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[] | null>(null);
    return (
        <DashboardHeaderContext.Provider value={{ breadcrumb, setBreadcrumb }}>
            {children}
        </DashboardHeaderContext.Provider>
    );
}

export function useDashboardHeader(): DashboardHeaderContextValue {
    return useContext(DashboardHeaderContext);
}

/**
 * Drop this inside any page under `(dashboard)` to set a per-page breadcrumb
 * in the shared DashboardShell header. Clears automatically on unmount.
 *
 * Usage:
 *   <DashboardBreadcrumbSetter crumbs={[{ label: "Physics" }]} />
 */
export function DashboardBreadcrumbSetter({ crumbs }: { crumbs: BreadcrumbItem[] }) {
    const { setBreadcrumb } = useDashboardHeader();
    useEffect(() => {
        setBreadcrumb(crumbs);
        return () => setBreadcrumb(null);
    // crumbs is constructed inline in JSX so stringify to stable-compare
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(crumbs)]);
    return null;
}
