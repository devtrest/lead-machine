/** Generates a stable DiceBear avatar URL from a seed string (name, email, etc). */
export function avatarUrl(seed: string): string {
  const encoded = encodeURIComponent(seed || "anonymous");
  return `https://api.dicebear.com/9.x/notionists-neutral/svg?seed=${encoded}&backgroundColor=c7d2fe,bae6fd,e0e7ff,e0f2fe&radius=50`;
}
