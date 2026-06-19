// Dev-mode mirror of worker/src/apollo.ts. See that file for full docs.
// Kept as a sibling module so src/lib/lead-enrichment.ts (the in-process
// dev-mode scraper) has the same Apollo Layer-2 fallback as production.

const APOLLO_BASE = "https://api.apollo.io/v1";
const APOLLO_TIMEOUT_MS = 5_000;

const APOLLO_PLACEHOLDER_PATTERNS = [
  /email_not_unlocked/i,
  /not_unlocked/i,
  /domain_email_locked/i,
  /__email_not_unlocked__/i,
];

function isLockedPlaceholder(email: string): boolean {
  const e = email.toLowerCase();
  return APOLLO_PLACEHOLDER_PATTERNS.some((p) => p.test(e));
}

export async function findEmailViaApollo(
  domain: string
): Promise<string | null> {
  const apiKey = process.env.APOLLO_API_KEY?.trim();
  if (!apiKey) return null;

  const cleanDomain = domain.replace(/^www\./i, "").toLowerCase().trim();
  if (!cleanDomain || !cleanDomain.includes(".")) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), APOLLO_TIMEOUT_MS);
    const res = await fetch(
      `${APOLLO_BASE}/organizations/enrich?domain=${encodeURIComponent(
        cleanDomain
      )}`,
      {
        method: "GET",
        signal: controller.signal,
        headers: {
          "X-Api-Key": apiKey,
          "Cache-Control": "no-cache",
          "Content-Type": "application/json",
          accept: "application/json",
        },
      }
    );
    clearTimeout(timeoutId);
    if (!res.ok) return null;

    const data = (await res.json().catch(() => null)) as
      | {
          organization?: {
            email?: string;
            contact_email?: string;
            primary_email?: string;
            emails?: unknown;
            contact_emails?: unknown;
          };
        }
      | null;

    const org = data?.organization;
    if (!org) return null;

    const candidates: string[] = [];
    if (typeof org.email === "string") candidates.push(org.email);
    if (typeof org.contact_email === "string") candidates.push(org.contact_email);
    if (typeof org.primary_email === "string") candidates.push(org.primary_email);

    if (Array.isArray(org.emails)) {
      for (const e of org.emails) {
        if (typeof e === "string") candidates.push(e);
        else if (e && typeof (e as { email?: unknown }).email === "string") {
          candidates.push((e as { email: string }).email);
        }
      }
    }
    if (Array.isArray(org.contact_emails)) {
      for (const e of org.contact_emails) {
        if (typeof e === "string") candidates.push(e);
      }
    }

    for (const raw of candidates) {
      const email = raw.toLowerCase().trim();
      if (!email || !email.includes("@") || !email.includes(".")) continue;
      if (isLockedPlaceholder(email)) continue;
      return email;
    }
    return null;
  } catch {
    return null;
  }
}
