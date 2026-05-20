"use client";

import "react-easy-crop/react-easy-crop.css";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Cropper, { type Area, type MediaSize } from "react-easy-crop";
import { motion, useReducedMotion } from "framer-motion";
import { getCroppedImageBlob } from "@/lib/avatar-crop-export";

type Props = {
  imageSrc: string;
  onClose: () => void;
  /** Return true when the cropped image was saved successfully (dialog will close). */
  onCropped: (blob: Blob) => boolean | Promise<boolean>;
};

export function AvatarCropDialog({ imageSrc, onClose, onCropped }: Props) {
  const reduceMotion = useReducedMotion();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pixels, setPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const minZoom = 0.45;
  const maxZoom = 4;

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setPixels(areaPixels);
  }, []);

  const onMediaLoaded = useCallback((media: MediaSize) => {
    const { naturalWidth, naturalHeight } = media;
    if (!naturalWidth || !naturalHeight) return;
    const portrait = naturalHeight > naturalWidth * 1.12;
    setZoom(portrait ? Math.min(maxZoom, 1.12) : Math.min(maxZoom, 1.04));
    setCrop({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    setZoom(1);
    setCrop({ x: 0, y: 0 });
    setPixels(null);
  }, [imageSrc]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const apply = useCallback(async () => {
    if (!pixels) return;
    setBusy(true);
    setErr(null);
    try {
      const blob = await getCroppedImageBlob(imageSrc, pixels, 0.93);
      const ok = await onCropped(blob);
      if (ok) onClose();
    } catch {
      setErr("Could not crop this image. Try another photo.");
    } finally {
      setBusy(false);
    }
  }, [imageSrc, pixels, onCropped, onClose]);

  const node = (
    <div
      className="fixed inset-0 z-[12000] flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px]"
      role="presentation"
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal
        aria-label="Crop profile photo"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-[var(--base-200)] bg-white shadow-[0_24px_64px_rgba(15,23,42,0.18)]"
        style={{ fontFamily: "var(--font-inter)" }}
        initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: 10 }}
        animate={reduceMotion ? false : { opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[var(--base-200)] px-4 py-3">
          <p className="text-[15px] font-semibold text-[var(--base-800)]">Adjust photo</p>
          <p className="text-[12px] text-[var(--base-500)] mt-0.5 leading-relaxed">
            Drag to move, scroll or pinch to zoom, then save when the circle frames you the way you want.
          </p>
        </div>

        <div className="relative h-[min(58vh,400px)] w-full bg-[var(--base-100)]">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            minZoom={minZoom}
            maxZoom={maxZoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            roundCropAreaPixels
            restrictPosition
            objectFit="contain"
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            onMediaLoaded={onMediaLoaded}
            style={{
              cropAreaStyle: {
                boxShadow:
                  "0 0 0 3px rgba(255,255,255,0.95), 0 0 0 1px rgba(15,23,42,0.12), 0 12px 40px rgba(15,23,42,0.12)",
              },
            }}
          />
        </div>

        <div className="space-y-3 px-4 py-3 border-t border-[var(--base-200)]">
          <label className="flex items-center gap-3 text-[12px] text-[var(--base-600)]">
            <span className="shrink-0 w-12 font-medium">Zoom</span>
            <input
              type="range"
              min={minZoom}
              max={maxZoom}
              step={0.02}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-[var(--primary-400)]"
            />
          </label>
          {err && <p className="text-[12px] text-[var(--red-100)]">{err}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-xl px-4 py-2 text-[13px] font-medium text-[var(--base-600)] hover:bg-[var(--base-100)] transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void apply()}
              disabled={busy || !pixels}
              className="rounded-xl px-4 py-2 text-[13px] font-semibold bg-[var(--primary-400)] text-white transition-[opacity,transform] duration-200 hover:opacity-95 active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? "Saving…" : "Use photo"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(node, document.body);
}
