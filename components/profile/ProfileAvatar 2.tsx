"use client";

import Image from "next/image";
import { firstNameInitial } from "@/lib/profile-initial";

export function ProfileAvatar({
  avatarUrl,
  displayName,
  fullName,
  email,
  size = 80,
  className = "",
}: {
  avatarUrl: string | null | undefined;
  displayName: string | null | undefined;
  /** Legal / account full name — used for first-name initial when display name is empty */
  fullName?: string | null | undefined;
  /** For initial fallback from email local-part */
  email?: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const initial = firstNameInitial(displayName, fullName, email);

  const altLabel =
    (displayName?.trim() || fullName?.trim() || "Profile") + " photo";

  if (avatarUrl) {
    return (
      <div
        className={`relative shrink-0 overflow-hidden rounded-full bg-[var(--base-100)] border border-[var(--base-200)] transition-transform duration-200 ease-out ${className}`}
        style={{ width: size, height: size }}
      >
        <Image
          key={avatarUrl}
          src={avatarUrl}
          alt={altLabel}
          fill
          className="object-cover"
          sizes={`${size}px`}
          unoptimized
        />
      </div>
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full border border-[var(--base-200)] bg-[var(--primary-50)] text-[var(--primary-600)] font-bold transition-[background-color,border-color,transform] duration-200 ease-out ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      aria-label={altLabel}
      role="img"
    >
      {initial}
    </div>
  );
}
