"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { MicDevice } from "@/lib/use-mic-devices";

// ── Shared mic picker dropdown ────────────────────────────────────────────────

function MicPickerDropdown({
  devices,
  selectedDeviceId,
  onDeviceChange,
  onClose,
}: {
  devices: MicDevice[];
  selectedDeviceId: string | undefined;
  onDeviceChange: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.97 }}
      transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
      className="absolute bottom-full right-0 mb-2 w-56 rounded-2xl bg-white border border-[var(--base-200)] shadow-[0_8px_32px_-4px_rgba(0,0,0,0.14)] overflow-hidden z-[9999]"
      style={{ fontFamily: "var(--font-inter)" }}
    >
      <div className="px-3 py-2 border-b border-[var(--base-100)]">
        <p className="text-[11px] font-semibold text-[var(--base-400)] uppercase tracking-wider">Microphone</p>
      </div>
      {devices.length === 0 ? (
        <div className="px-3 py-3 text-[13px] text-[var(--base-400)]">No microphones found</div>
      ) : (
        <ul className="py-1.5">
          {devices.map((d) => {
            const active = d.deviceId === selectedDeviceId || (!selectedDeviceId && d.deviceId === "default");
            return (
              <li key={d.deviceId}>
                <button
                  type="button"
                  onClick={() => { onDeviceChange(d.deviceId); onClose(); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-[13px] hover:bg-[var(--base-50)] transition-colors cursor-pointer"
                  style={{ color: active ? "var(--primary-500)" : "var(--base-700)" }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className={`w-3.5 h-3.5 shrink-0 ${active ? "opacity-100" : "opacity-0"}`}>
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  <span className="truncate">{d.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </motion.div>
  );
}

// ── Audio analyser hook (no React state — uses direct DOM manipulation) ───────

function useAudioBars(
  stream: MediaStream | null,
  bar1Ref: React.RefObject<HTMLSpanElement | null>,
  bar2Ref: React.RefObject<HTMLSpanElement | null>,
  bar3Ref: React.RefObject<HTMLSpanElement | null>,
) {
  useEffect(() => {
    if (!stream) return;

    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.7;
    src.connect(analyser);

    const buf = new Uint8Array(analyser.frequencyBinCount);
    let raf: number;

    // Min/max heights in px for the bars
    const MIN_H = 4;
    const MAX_H = 22;

    function tick() {
      analyser.getByteFrequencyData(buf);
      // Use lower-frequency bins (speech lives in 80–3000 Hz range)
      const speechBins = buf.slice(0, 20);
      const avg = speechBins.reduce((s, v) => s + v, 0) / speechBins.length;
      const level = Math.min(avg / 70, 1); // 0–1

      const t = performance.now() / 1000;
      // Each bar oscillates with a phase offset; height grows with audio level
      const h1 = MIN_H + (MAX_H - MIN_H) * Math.max(0, level * (0.75 + 0.25 * Math.sin(t * 8.0)));
      const h2 = MIN_H + (MAX_H - MIN_H) * Math.max(0, level * (0.75 + 0.25 * Math.sin(t * 8.0 + 1.2)));
      const h3 = MIN_H + (MAX_H - MIN_H) * Math.max(0, level * (0.75 + 0.25 * Math.sin(t * 8.0 + 2.4)));

      // Idle gentle bob when no audio
      const idleH = MIN_H + 2 * (0.5 + 0.5 * Math.sin(t * 3.5));
      const idleH2 = MIN_H + 2 * (0.5 + 0.5 * Math.sin(t * 3.5 + 1.1));
      const idleH3 = MIN_H + 2 * (0.5 + 0.5 * Math.sin(t * 3.5 + 2.2));

      if (bar1Ref.current) bar1Ref.current.style.height = `${Math.max(level > 0.04 ? h1 : idleH, MIN_H).toFixed(1)}px`;
      if (bar2Ref.current) bar2Ref.current.style.height = `${Math.max(level > 0.04 ? h2 : idleH2, MIN_H).toFixed(1)}px`;
      if (bar3Ref.current) bar3Ref.current.style.height = `${Math.max(level > 0.04 ? h3 : idleH3, MIN_H).toFixed(1)}px`;

      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      src.disconnect();
      void ctx.close();
    };
  }, [stream, bar1Ref, bar2Ref, bar3Ref]);
}

// ── VoiceRecordingBar ─────────────────────────────────────────────────────────

interface VoiceRecordingBarProps {
  stream: MediaStream | null;
  isTranscribing: boolean;
  onStop: () => void;
  onCancel: () => void;
  devices: MicDevice[];
  selectedDeviceId: string | undefined;
  onDeviceChange: (id: string) => void;
  onPickerOpen: () => void;
}

export function VoiceRecordingBar({
  stream,
  isTranscribing,
  onStop,
  onCancel,
  devices,
  selectedDeviceId,
  onDeviceChange,
  onPickerOpen,
}: VoiceRecordingBarProps) {
  const bar1Ref = useRef<HTMLSpanElement>(null);
  const bar2Ref = useRef<HTMLSpanElement>(null);
  const bar3Ref = useRef<HTMLSpanElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const micBtnRef = useRef<HTMLButtonElement>(null);

  useAudioBars(stream, bar1Ref, bar2Ref, bar3Ref);

  // Close picker on outside click
  useEffect(() => {
    if (!pickerOpen) return;
    function onDown(e: PointerEvent) {
      if (
        pickerRef.current && !pickerRef.current.contains(e.target as Node) &&
        micBtnRef.current && !micBtnRef.current.contains(e.target as Node)
      ) setPickerOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [pickerOpen]);

  if (isTranscribing) {
    return (
      <div className="flex items-center justify-center gap-2.5 py-3 px-4" style={{ fontFamily: "var(--font-inter)" }}>
        <div className="w-4 h-4 rounded-full border-2 border-[var(--primary-300)] border-t-[var(--primary-500)] animate-spin" />
        <span className="text-[14px] font-medium text-[var(--base-400)]">Transcribing…</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 py-3 px-2.5" style={{ fontFamily: "var(--font-inter)" }}>

      {/* Cancel */}
      <button
        type="button"
        onClick={onCancel}
        className="size-9 shrink-0 rounded-full flex items-center justify-center text-[var(--base-400)] hover:bg-slate-100 hover:text-slate-600 transition-colors active:scale-95 cursor-pointer"
        aria-label="Cancel recording"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>

      {/* Mic icon + ▼ — unified pill, two separate click zones */}
      <div className="relative shrink-0">
        <div className="flex items-center rounded-full border border-[var(--base-200)] overflow-hidden bg-white">
          {/* Mic side — starts recording or just acts as visual indicator */}
          <div className="flex items-center justify-center size-9 text-[var(--base-500)]">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className="w-4.5 h-4.5 w-[18px] h-[18px]">
              <path d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
            </svg>
          </div>
          {/* Divider — hidden on mobile */}
          <div className="hidden sm:block w-px h-5 bg-[var(--base-150,#e8eaed)]" />
          {/* Arrow side — opens mic picker, hidden on mobile */}
          <button
            ref={micBtnRef}
            type="button"
            onClick={() => { if (!pickerOpen) onPickerOpen(); setPickerOpen(v => !v); }}
            className="hidden sm:flex items-center justify-center h-9 px-2 text-[var(--base-400)] hover:bg-slate-100 hover:text-[var(--base-600)] transition-colors cursor-pointer"
            aria-label="Change microphone"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>

        {/* Mic picker dropdown */}
        <AnimatePresence>
          {pickerOpen && (
            <div ref={pickerRef}>
              <MicPickerDropdown
                devices={devices}
                selectedDeviceId={selectedDeviceId}
                onDeviceChange={onDeviceChange}
                onClose={() => setPickerOpen(false)}
              />
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Bars + Stop — dark pill */}
      <button
        type="button"
        onClick={onStop}
        className="flex-1 flex items-center gap-2.5 px-4 h-10 rounded-full cursor-pointer transition-opacity duration-150 hover:opacity-90 active:scale-[0.98]"
        style={{ backgroundColor: "#1e2d40" }}
        aria-label="Stop recording"
      >
        {/* Animated equalizer bars */}
        <div className="flex items-end gap-[3px]" style={{ height: 22 }}>
          <span
            ref={bar1Ref}
            className="inline-block w-[3px] rounded-full"
            style={{ height: 4, backgroundColor: "rgba(147,165,207,0.9)", willChange: "height" }}
          />
          <span
            ref={bar2Ref}
            className="inline-block w-[3px] rounded-full"
            style={{ height: 4, backgroundColor: "rgba(147,165,207,0.9)", willChange: "height" }}
          />
          <span
            ref={bar3Ref}
            className="inline-block w-[3px] rounded-full"
            style={{ height: 4, backgroundColor: "rgba(147,165,207,0.9)", willChange: "height" }}
          />
        </div>
        <span className="text-[14px] font-semibold text-white">Stop</span>
      </button>

    </div>
  );
}

// ── DictateButton — mic + arrow unified pill ──────────────────────────────────

interface DictateButtonProps {
  isRecording: boolean;
  isTranscribing: boolean;
  onDictate: () => void;
  devices: MicDevice[];
  selectedDeviceId: string | undefined;
  onDeviceChange: (id: string) => void;
  onPickerOpen: () => void;
}

export function DictateButton({
  isRecording,
  isTranscribing,
  onDictate,
  devices,
  selectedDeviceId,
  onDeviceChange,
  onPickerOpen,
}: DictateButtonProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    function onDown(e: PointerEvent) {
      if (
        pickerRef.current && !pickerRef.current.contains(e.target as Node) &&
        containerRef.current && !containerRef.current.contains(e.target as Node)
      ) setPickerOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [pickerOpen]);

  return (
    <div ref={containerRef} className="relative flex items-center">
      {/* Unified pill containing mic button + divider + arrow */}
      <div className="flex items-center rounded-full overflow-visible bg-transparent">
        {/* Mic button */}
        <button
          type="button"
          onClick={onDictate}
          disabled={isTranscribing}
          className={`size-9 shrink-0 flex items-center justify-center rounded-full sm:rounded-tr-none sm:rounded-br-none transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
            isRecording
              ? "text-red-500 hover:bg-red-50"
              : "text-[var(--base-500)] hover:bg-slate-100 hover:text-[var(--base-700)]"
          }`}
          aria-label={isRecording ? "Stop recording" : "Dictate"}
        >
          {isTranscribing ? (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-[18px] h-[18px]" style={{ animation: "spin 1s linear infinite" }}>
              <path strokeLinecap="round" d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={`w-[18px] h-[18px] ${isRecording ? "animate-pulse" : ""}`}>
              <path d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
            </svg>
          )}
        </button>

        {/* Arrow button — only shown when idle, hidden on mobile */}
        {!isRecording && !isTranscribing && (
          <>
            <div className="hidden sm:block w-px h-4 bg-[var(--base-200)] shrink-0" />
            <button
              ref={arrowRef}
              type="button"
              onClick={() => { if (!pickerOpen) onPickerOpen(); setPickerOpen(v => !v); }}
              className="hidden sm:flex items-center justify-center h-9 px-1.5 text-[var(--base-400)] hover:bg-slate-100 hover:text-[var(--base-600)] transition-colors rounded-r-full cursor-pointer"
              aria-label="Change microphone"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Picker dropdown */}
      <AnimatePresence>
        {pickerOpen && (
          <div ref={pickerRef} className="absolute bottom-full right-0 mb-2 z-[9999]">
            <MicPickerDropdown
              devices={devices}
              selectedDeviceId={selectedDeviceId}
              onDeviceChange={onDeviceChange}
              onClose={() => setPickerOpen(false)}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
