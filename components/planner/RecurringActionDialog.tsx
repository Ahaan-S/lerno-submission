"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";

export type RecurringScope = "this" | "following" | "all";

interface Props {
  open: boolean;
  mode: "edit" | "delete";
  onClose: () => void;
  onConfirm: (scope: RecurringScope) => void;
}

export default function RecurringActionDialog({ open, mode, onClose, onConfirm }: Props) {
  const [scope, setScope] = useState<RecurringScope>("this");

  if (typeof document === "undefined") return null;

  const title = mode === "delete" ? "Delete recurring event" : "Edit recurring event";

  const handleConfirm = () => {
    onConfirm(scope);
    setScope("this");
  };

  const handleClose = () => {
    onClose();
    setScope("this");
  };

  const options: { value: RecurringScope; label: string }[] = [
    { value: "this", label: "This event" },
    { value: "following", label: "This and following events" },
    { value: "all", label: "All events" },
  ];

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center p-4"
          style={{ fontFamily: "var(--font-inter)" }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0"
            style={{ backgroundColor: "rgba(15,23,42,0.45)", backdropFilter: "blur(3px)" }}
            onClick={handleClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-[360px] bg-white rounded-3xl"
            style={{ boxShadow: "0 24px 64px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.06)" }}
          >
            <div className="px-6 pt-6 pb-5">
              <h2 className="text-[16px] font-semibold text-[var(--base-800)] mb-5">{title}</h2>

              <div className="flex flex-col gap-3">
                {options.map(opt => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-3 cursor-pointer group"
                    onClick={() => setScope(opt.value)}
                  >
                    <div
                      className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
                      style={{
                        borderColor: scope === opt.value ? "var(--primary-400)" : "var(--base-300)",
                        backgroundColor: scope === opt.value ? "var(--primary-400)" : "white",
                      }}
                    >
                      {scope === opt.value && (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>
                    <span
                      className="text-[14px] select-none"
                      style={{
                        color: scope === opt.value ? "var(--base-800)" : "var(--base-600)",
                        fontWeight: scope === opt.value ? 500 : 400,
                      }}
                    >
                      {opt.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div
              className="flex items-center justify-end gap-2 px-6 py-4 border-t"
              style={{ borderColor: "var(--base-200)" }}
            >
              <button
                type="button"
                onClick={handleClose}
                className="h-9 px-4 rounded-full text-[14px] text-[var(--base-600)] border border-[var(--base-200)] hover:bg-[var(--base-100)] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="h-9 px-5 rounded-full text-[14px] font-medium text-white transition-opacity hover:opacity-90 cursor-pointer"
                style={{
                  backgroundColor: mode === "delete" ? "var(--red-100, #ef4444)" : "var(--primary-400)",
                }}
              >
                OK
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
