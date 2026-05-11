/** Compute initials from a name or email. */
export function initialsFor(seed: string | null | undefined): string {
  const source = (seed ?? "").trim();
  if (!source) return "?";
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const initials = parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return initials || "?";
}

/**
 * Real portrait URL helper — used only for marketing testimonials, where we
 * want actual photos. App user avatars use initials, not generated images.
 */
export function avatarUrl(seed: string): string {
  const encoded = encodeURIComponent(seed || "anonymous");
  return `https://api.dicebear.com/9.x/notionists-neutral/svg?seed=${encoded}&backgroundColor=c7d2fe,bae6fd,e0e7ff,e0f2fe&radius=50`;
}
