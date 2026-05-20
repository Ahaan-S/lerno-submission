/**
 * Single-letter fallback when no profile photo: first letter of the user's first name.
 * Uses the first whitespace-delimited token from display name, then full name, then email local-part.
 */
export function firstNameInitial(
  displayName: string | null | undefined,
  fullName: string | null | undefined,
  email: string | null | undefined
): string {
  const pick = (raw: string | null | undefined): string => {
    const t = (raw ?? "").trim();
    if (!t) return "";
    const firstWord = t.split(/\s+/)[0] ?? "";
    const letter = firstWord.match(/[\p{L}\p{N}]/u)?.[0] ?? firstWord.charAt(0);
    return letter ? letter.toUpperCase() : "";
  };

  const fromDisplay = pick(displayName);
  if (fromDisplay) return fromDisplay;

  const fromFull = pick(fullName);
  if (fromFull) return fromFull;

  const local = (email ?? "").split("@")[0]?.trim() ?? "";
  const fromEmail = pick(local);
  if (fromEmail) return fromEmail;

  return "?";
}
