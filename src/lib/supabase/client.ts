import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (
    typeof window !== "undefined" &&
    key &&
    !key.startsWith("eyJ") &&
    process.env.NODE_ENV === "development"
  ) {
    console.warn(
      "Use the JWT anon key (starts with eyJ) from Supabase → Settings → API, not sb_publishable_…"
    );
  }
  return createBrowserClient(url, key);
}
