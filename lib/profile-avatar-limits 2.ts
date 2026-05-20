/** Max size of the file sent to POST /api/profile/avatar (must match server). */
export const AVATAR_MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

/** Max original file size before cropping (client-only guard). */
export const AVATAR_MAX_ORIGINAL_PICK_BYTES = 8 * 1024 * 1024;

export const AVATAR_ACCEPT_ATTR = "image/jpeg,image/png,image/webp";

export function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${Math.round(n / (1024 * 1024))}MB`;
  if (n >= 1024) return `${Math.round(n / 1024)}KB`;
  return `${n} B`;
}
