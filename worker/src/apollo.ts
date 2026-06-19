// Apollo.io fallback — runs ONLY when our scraper has already failed to
// find an email on the lead's website. Apollo has a database of ~250M
// business contacts harvested from LinkedIn, partnerships, and email
// signatures, so it sometimes has emails for businesses that don't
// publish any contact info on their own site.
//
// FREE TIER REALITY: Apollo's most useful endpoint (api/v1/people/match,
// which returns specific person emails) is gated behind paid plans. On
// the free tier we have access to:
//   - api/v1/organizations/enrich   (1 credit per call)
//   - api/v1/mixed_people/organization_top_people (1 credit + per person)
//
// We try organizations/enrich first because it's cheaper. If it returns
// nothing useful, we DON'T fall through to top_people — that would burn
// 2 credits per lead and the free tier only has 75 credits/month.
//
// Realistic hit rate for chain retailers: 10-30% of misses recovered.
// For independent businesses (which we already get from the scraper):
// negligible improvement.

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

// Find an email for a business domain via Apollo. Returns null on:
//   - No APOLLO_API_KEY env var set
//   - Apollo returns no org match
//   - Apollo returns only placeholder/locked emails (free tier limitation)
//   - Any network error or 4xx/5xx response
//
// Apollo only ever charges credits for SUCCESSFUL lookups, so a domain
// they don't have data on is free.
export async function findEmailViaApollo(
  domain: string
): Promise<string | null> {
  const apiKey = process.env.APOLLO_API_KEY?.trim();
  if (!apiKey) return null;

  // Strip leading 'www.' so we hit Apollo's canonical org record.
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

    // Apollo's response can carry email signal in several different shapes
    // across endpoints. Try each in priority order.
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
