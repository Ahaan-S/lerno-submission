"use client";

import { useCallback, useEffect, useState } from "react";
import imageCompression from "browser-image-compression";
import { motion, useReducedMotion } from "framer-motion";
import { AvatarCropDialog } from "@/components/profile/AvatarCropDialog";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import {
  AVATAR_ACCEPT_ATTR,
  AVATAR_MAX_ORIGINAL_PICK_BYTES,
  AVATAR_MAX_UPLOAD_BYTES,
  formatBytes,
} from "@/lib/profile-avatar-limits";
import { useProfileMe, invalidateProfileMe } from "@/hooks/use-profile-me";

const PICK_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export function ProfileSettingsPanel() {
  const reduceMotion = useReducedMotion();

  // SWR-backed — deduped with sidebar avatar; zero round-trip on mount when already cached.
  const { data: me, isLoading, error: swrError } = useProfileMe();

  const [bio, setBio] = useState("");
  const [privacy, setPrivacy] = useState<string>("public");
  const [displayName, setDisplayName] = useState("");
  // Local avatar URL tracks the optimistic update after a successful upload.
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  // Guard so we only seed form state once per loaded profile.
  const [seeded, setSeeded] = useState(false);

  // Seed form fields when SWR delivers profile data for the first time.
  useEffect(() => {
    if (!me || seeded) return;
    setBio(me.bio ?? "");
    setPrivacy(me.profile_privacy ?? "public");
    setDisplayName((me.display_name ?? "").trim());
    setAvatarUrl(me.avatar_url);
    setSeeded(true);
  }, [me, seeded]);

  // Keep local avatarUrl in sync if SWR revalidation brings a newer avatar (e.g. from another tab).
  useEffect(() => {
    if (me?.avatar_url) setAvatarUrl(me.avatar_url);
  }, [me?.avatar_url]);

  const save = useCallback(async () => {
    setSaving(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/profile/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          bio: bio.trim() || null,
          profile_privacy: privacy,
          display_name: displayName.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(data.error ?? "Save failed");
        return;
      }
      setMsg("Saved");
      // invalidateProfileMe triggers one SWR revalidation that refreshes every
      // subscriber (sidebar avatar, this panel, AccountSettingsModal) together.
      void invalidateProfileMe();
    } catch {
      setErr("Network error");
    } finally {
      setSaving(false);
    }
  }, [bio, privacy, displayName]);

  const closeCrop = useCallback(() => {
    setCropSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const onPickAvatar = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErr(null);
    setMsg(null);
    const mime = (file.type || "").toLowerCase();
    if (!PICK_MIME.has(mime)) {
      setErr("Use a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > AVATAR_MAX_ORIGINAL_PICK_BYTES) {
      setErr(`Choose a photo under ${formatBytes(AVATAR_MAX_ORIGINAL_PICK_BYTES)} before cropping.`);
      return;
    }
    setCropSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }, []);

  const uploadCroppedBlob = useCallback(
    async (blob: Blob): Promise<boolean> => {
      setUploading(true);
      setErr(null);
      try {
        let file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
        file = await imageCompression(file, {
          maxWidthOrHeight: 1024,
          useWebWorker: true,
          maxSizeMB: Math.min(1.95, AVATAR_MAX_UPLOAD_BYTES / (1024 * 1024) - 0.05),
        });
        if (file.size > AVATAR_MAX_UPLOAD_BYTES) {
          setErr(
            `Cropped image is still over ${formatBytes(AVATAR_MAX_UPLOAD_BYTES)}. Try a simpler photo or lower zoom.`
          );
          return false;
        }
        const fd = new FormData();
        fd.append("file", file, file.name || "avatar.jpg");
        const res = await fetch("/api/profile/avatar", { method: "POST", body: fd, credentials: "include" });
        const data = (await res.json()) as { avatar_url?: string; error?: string };
        if (!res.ok) {
          setErr(data.error ?? "Upload failed");
          return false;
        }
        if (data.avatar_url) setAvatarUrl(data.avatar_url);
        setMsg("Photo updated");
        // Refetch so sidebar and any other SWR consumer gets the new avatar_url.
        void invalidateProfileMe();
        return true;
      } catch {
        setErr("Could not upload photo");
        return false;
      } finally {
        setUploading(false);
      }
    },
    []
  );

  if (isLoading || !me) {
    return (
      <div className="py-8 text-[14px] text-[var(--base-500)]" style={{ fontFamily: "var(--font-inter)" }}>
        {swrError ? "Failed to load profile" : "Loading…"}
      </div>
    );
  }

  const showName = displayName || me.full_name || "You";

  return (
    <motion.div
      className="max-w-lg space-y-6"
      style={{ fontFamily: "var(--font-inter)" }}
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={reduceMotion ? false : { opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      {cropSrc && (
        <AvatarCropDialog
          imageSrc={cropSrc}
          onClose={closeCrop}
          onCropped={(blob) => uploadCroppedBlob(blob)}
        />
      )}
      <div className="flex flex-col sm:flex-row sm:items-start gap-5 rounded-2xl border border-[var(--base-200)] bg-[var(--base-50)]/60 p-5 transition-[border-color,box-shadow] duration-200 hover:border-[var(--base-300)]">
        <ProfileAvatar
          avatarUrl={avatarUrl}
          displayName={showName}
          fullName={me.full_name}
          email={me.email}
          size={80}
          className="shrink-0 ring-2 ring-white shadow-[0_1px_3px_rgba(15,23,42,0.08)]"
        />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-[13px] font-semibold text-[var(--base-800)]">Profile photo</p>
            <p className="text-[12px] text-[var(--base-500)] mt-1 leading-snug">
              JPEG, PNG, or WebP · {formatBytes(AVATAR_MAX_ORIGINAL_PICK_BYTES)} max ·{" "}
              {formatBytes(AVATAR_MAX_UPLOAD_BYTES)} saved file max
            </p>
          </div>
          <div>
            <input
              id="profile-avatar-file"
              type="file"
              accept={AVATAR_ACCEPT_ATTR}
              className="sr-only"
              onChange={onPickAvatar}
              disabled={uploading}
            />
            <label
              htmlFor="profile-avatar-file"
              className={`inline-flex cursor-pointer items-center justify-center rounded-xl bg-[var(--primary-400)] px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-[opacity,transform] duration-200 hover:opacity-95 active:scale-[0.98] ${
                uploading ? "pointer-events-none opacity-50" : ""
              }`}
            >
              {uploading ? "Uploading…" : "Upload photo"}
            </label>
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="prof-display" className="text-[14px] font-medium text-[var(--base-800)] block mb-1">
          Display name
        </label>
        <p className="text-[12px] text-[var(--base-500)] mb-2">
          Shown to friends on your public profile (max 40 characters).
        </p>
        <input
          id="prof-display"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value.slice(0, 40))}
          className="w-full rounded-xl border border-[var(--base-200)] bg-white px-3 py-2.5 text-[14px] text-[var(--base-800)] outline-none transition-[border-color,box-shadow] duration-200 focus:border-[var(--primary-300)] focus:ring-2 focus:ring-[var(--primary-400)]/20"
          placeholder={me.full_name ?? "Your name"}
        />
      </div>

      <div>
        <label htmlFor="prof-bio" className="text-[14px] font-medium text-[var(--base-800)] block mb-1">
          Bio
        </label>
        <textarea
          id="prof-bio"
          value={bio}
          onChange={(e) => setBio(e.target.value.slice(0, 500))}
          rows={3}
          className="w-full rounded-xl border border-[var(--base-200)] bg-white px-3 py-2.5 text-[14px] text-[var(--base-800)] outline-none transition-[border-color,box-shadow] duration-200 focus:border-[var(--primary-300)] focus:ring-2 focus:ring-[var(--primary-400)]/20 resize-y min-h-[88px]"
          placeholder="A short line about your learning goals…"
        />
        <p className="text-[11px] text-[var(--base-400)] mt-1">{bio.length}/500</p>
      </div>

      <div>
        <p className="text-[14px] font-medium text-[var(--base-800)] mb-2">Profile visibility</p>
        <div className="flex flex-col gap-2.5">
          {(
            [
              ["public", "Public — anyone with your link can see stats"],
              ["friends_only", "Friends only — full profile for friends only"],
              ["private", "Private — only your name and photo are shown"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className="flex items-start gap-2.5 cursor-pointer rounded-xl border border-transparent px-2 py-1.5 -mx-2 transition-colors duration-150 hover:bg-[var(--base-50)] has-[:focus-visible]:border-[var(--primary-200)]"
            >
              <input
                type="radio"
                name="profile_privacy"
                value={value}
                checked={privacy === value}
                onChange={() => setPrivacy(value)}
                className="mt-1 accent-[var(--primary-400)]"
              />
              <span className="text-[13px] text-[var(--base-700)] leading-snug">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {msg && <p className="text-[13px] text-emerald-600">{msg}</p>}
      {err && <p className="text-[13px] text-[var(--red-100)]">{err}</p>}

      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="px-4 py-2.5 rounded-xl text-[14px] font-semibold bg-[var(--primary-400)] text-white transition-[transform,opacity,box-shadow] duration-200 ease-out hover:opacity-95 hover:shadow-md active:scale-[0.98] disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
      >
        {saving ? "Saving…" : "Save profile"}
      </button>
    </motion.div>
  );
}
