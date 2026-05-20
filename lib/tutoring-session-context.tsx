"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const TutoringSessionContext = createContext<{
  sessionId: string | null;
  setSessionId: (id: string | null) => void;
  endSession: (sid?: string | null) => void;
  learnSidebarOpen: boolean;
  setLearnSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  toggleLearnSidebar: () => void;
} | null>(null);

function doEndSession(sid: string): void {
  fetch("/api/tutor/session/end", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ session_id: sid }),
  }).catch(() => {});
}

export function TutoringSessionProvider({ children }: { children: React.ReactNode }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [learnSidebarOpen, setLearnSidebarOpen] = useState(true);
  const sentRef = useRef<Set<string>>(new Set());

  const toggleLearnSidebar = useCallback(() => {
    setLearnSidebarOpen((prev) => !prev);
  }, []);

  const endSession = useCallback((sid?: string | null) => {
    const id = sid ?? sessionId;
    if (!id || sentRef.current.has(id)) return;
    sentRef.current.add(id);
    doEndSession(id);
  }, [sessionId]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (sessionId) {
        try {
          const blob = new Blob([JSON.stringify({ session_id: sessionId })], {
            type: "application/json",
          });
          navigator.sendBeacon("/api/tutor/session/end", blob);
        } catch {}
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [sessionId, endSession]);

  return (
    <TutoringSessionContext.Provider
      value={{ sessionId, setSessionId, endSession, learnSidebarOpen, setLearnSidebarOpen, toggleLearnSidebar }}
    >
      {children}
    </TutoringSessionContext.Provider>
  );
}

export function useTutoringSession() {
  const ctx = useContext(TutoringSessionContext);
  if (!ctx) throw new Error("useTutoringSession must be used within TutoringSessionProvider");
  return ctx;
}
