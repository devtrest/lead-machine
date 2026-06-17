import dnsPromises from "node:dns/promises";

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_RE = /(?:\+\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)\d{3,4}[\s-]?\d{3,4}/g;

const SPAM_EMAIL_PATTERNS = [
  /^example@/i,
  /^test@/i,
  /^name@/i,
  /^you@/i,
  /^email@/i,
  /^user@/i,
  /@example\.com$/i,
  /@domain\.com$/i,
  /@email\.com$/i,
  /@sentry\.io$/i,
  /@wixpress\.com$/i,
  /@cloudfront\.net$/i,
  /\.(png|jpe?g|gif|webp|svg|css|js|woff2?|ttf|ico)$/i,
];

// Sites built on a generic SaaS-ish stack (Wix, Squarespace, Shopify pages,
// Next.js apps with empty SSR) often serve a near-empty shell on first GET.
// We try to detect this so we can fall back to MX-validated pattern guessing.
const SPA_MARKERS = [
  /id\s*=\s*["']__next["']/i,
  /id\s*=\s*["']root["']/i,
  /id\s*=\s*["']app["']/i,
  /id\s*=\s*["']gatsby/i,
  /<meta\s+name\s*=\s*["']next-head/i,
  /<noscript>.{0,200}?(JavaScript|enable|disabled)/i,
];

// Patterns we'll try with MX-validation when the crawl returns zero emails.
// Ordered by likelihood for small businesses worldwide.
const GUESSED_LOCAL_PARTS = [
  "info",
  "contact",
  "support",
  "hello",
  "admin",
  "sales",
  "reservations",
  "bookings",
];

type EnrichedContact = {
  emails: string[];
  phones: string[];
  sourceUrls: string[];
};

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function normalizeUrl(value: string): string | null {
  try {
    return new URL(value).toString();
  } catch {
    return null;
  }
}

function isLikelyRealEmail(email: string): boolean {
  const e = email.toLowerCase();
  if (e.length > 100) return false;
  for (const p of SPAM_EMAIL_PATTERNS) {
    if (p.test(e)) return false;
  }
  return true;
}

function stripMarkup(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ");
}

function extractFromHrefs(html: string): { emails: string[]; phones: string[] } {
  const emails: string[] = [];
  const phones: string[] = [];
  const mailtoRe = /href\s*=\s*["']mailto:([^"'?#]+)/gi;
  const telRe = /href\s*=\s*["']tel:([^"']+)/gi;
  let m: RegExpExecArray | null;
  while ((m = mailtoRe.exec(html)) !== null) {
    emails.push(decodeURIComponent(m[1]).trim());
  }
  while ((m = telRe.exec(html)) !== null) {
    phones.push(decodeURIComponent(m[1]).trim());
  }
  return { emails, phones };
}

function unobfuscate(text: string): string {
  return text
    .replace(/\s*[\[(]?\s*at\s*[\])]?\s*/gi, "@")
    .replace(/\s*[\[(]?\s*dot\s*[\])]?\s*/gi, ".");
}

// Cloudflare's "Email Address Obfuscation" rewrites every mailto: and visible
// email on a page into <a class="__cf_email__" data-cfemail="HEX">[email&#160;protected]</a>.
// The real address is XOR-encoded in data-cfemail.
function decodeCfEmail(encoded: string): string | null {
  if (!/^[0-9a-f]+$/i.test(encoded)) return null;
  if (encoded.length < 4 || encoded.length % 2 !== 0) return null;
  const key = parseInt(encoded.slice(0, 2), 16);
  let decoded = "";
  for (let i = 2; i < encoded.length; i += 2) {
    decoded += String.fromCharCode(parseInt(encoded.slice(i, i + 2), 16) ^ key);
  }
  return decoded;
}

function extractCfEmails(html: string): string[] {
  const emails: string[] = [];
  const re = /data-cfemail\s*=\s*["']([0-9a-f]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const decoded = decodeCfEmail(m[1]);
    if (decoded && decoded.includes("@")) emails.push(decoded.toLowerCase());
  }
  return emails;
}

// Many business sites embed Schema.org JSON-LD with email + telephone at the
// top of the page. Even SPA-rendered sites often include this server-side
// for SEO. Cheapest win in the whole enrichment pipeline.
function extractJsonLdEmails(html: string): {
  emails: string[];
  phones: string[];
} {
  const emails: string[] = [];
  const phones: string[] = [];
  const re =
    /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    walkJsonLd(parsed, emails, phones);
  }
  return { emails: unique(emails), phones: unique(phones) };
}

function walkJsonLd(node: unknown, emails: string[], phones: string[]): void {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const item of node) walkJsonLd(item, emails, phones);
    return;
  }
  if (typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  // Common schema.org fields: "email", "telephone", "contactPoint".
  if (typeof obj.email === "string") emails.push(obj.email.toLowerCase());
  if (typeof obj.telephone === "string") phones.push(obj.telephone);
  for (const key of Object.keys(obj)) walkJsonLd(obj[key], emails, phones);
}

// Resolve MX records for a domain. Lookup is cached per process and short-
// circuited with a 3s timeout so a slow DNS resolver can't block the batch.
const mxCache = new Map<string, boolean>();
async function hasMxRecord(domain: string): Promise<boolean> {
  if (mxCache.has(domain)) return mxCache.get(domain)!;
  try {
    const timer = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("DNS timeout")), 3000)
    );
    const lookup = dnsPromises.resolveMx(domain).then((records) => records.length > 0);
    const result = await Promise.race([lookup, timer]);
    mxCache.set(domain, result);
    return result;
  } catch {
    mxCache.set(domain, false);
    return false;
  }
}

// Last-resort fallback: when scraping yields zero emails, guess common local
// parts against the lead's domain. Each guess is validated by checking the
// domain has MX records (i.e. it accepts mail at all). We don't try to verify
// the specific local part — that requires SMTP RCPT TO probing which is
// noisy and gets us blacklisted.
//
// Caveat: a domain having MX records doesn't prove "info@example.com" is a
// real mailbox — it just proves the domain accepts mail. False positives are
// possible. The caller can flag these as lower confidence if needed.
async function guessEmailsForDomain(domain: string): Promise<string[]> {
  if (!domain) return [];
  if (!(await hasMxRecord(domain))) return [];
  return GUESSED_LOCAL_PARTS.map((lp) => `${lp}@${domain}`);
}

// Restaurant/business sites often have /reservations, /menu, etc. The wider
// the path list, the higher the chance of hitting a static page where the
// email appears in HTML.
// Email lives in the homepage footer or on the contact/about page. We check
// the homepage first (footer/JSON-LD), then the common contact-page variants,
// and stop the moment we find a real email — so the typical site is 1–2
// fetches, but we still reliably reach the contact page when the footer has
// nothing (and don't fall back to guessed addresses prematurely).
const CONTACT_PATHS = ["", "/contact", "/contact-us", "/about", "/contact.html"];

// Cap fetches so a no-email site can't crawl forever, but high enough to reach
// the contact page even if a path 404s.
const MAX_FETCH_ATTEMPTS = 4;
const FETCH_TIMEOUT_MS = 7_000;

export async function enrichFromWebsite(
  websiteUrl: string,
  maxItems = 4
): Promise<EnrichedContact> {
  const root = normalizeUrl(websiteUrl);
  if (!root) return { emails: [], phones: [], sourceUrls: [] };

  const base = new URL(root);
  const candidates = unique(
    CONTACT_PATHS.map((path) => {
      try {
        return new URL(path || base.pathname, base).toString();
      } catch {
        return null;
      }
    }).filter((v): v is string => Boolean(v))
  );

  const emails: string[] = [];
  const phones: string[] = [];
  const sourceUrls: string[] = [];
  let sawSpaShell = false;
  let attempts = 0;

  for (const target of candidates) {
    if (attempts >= MAX_FETCH_ATTEMPTS) break;
    attempts++;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      const res = await fetch(target, {
        cache: "no-store",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9",
          // A Referer makes our request look like a normal in-app
          // navigation instead of a direct hit from a script.
          referer: `${base.origin}/`,
        },
      });
      clearTimeout(timeoutId);
      if (!res.ok) continue;
      const html = await res.text();

      // Detect SPA shells so we can fall back to pattern guessing later.
      if (
        html.length < 12_000 &&
        SPA_MARKERS.some((m) => m.test(html))
      ) {
        sawSpaShell = true;
      }

      // 1. mailto: / tel: hrefs — highest signal.
      const fromHrefs = extractFromHrefs(html);
      for (const e of fromHrefs.emails) emails.push(e.toLowerCase());
      for (const p of fromHrefs.phones) phones.push(p);

      // 2. Cloudflare-obfuscated emails (data-cfemail attrs).
      const cfEmails = extractCfEmails(html);
      for (const e of cfEmails) emails.push(e);

      // 3. JSON-LD structured data (Schema.org Restaurant/Organization/etc).
      const fromLd = extractJsonLdEmails(html);
      for (const e of fromLd.emails) emails.push(e);
      for (const p of fromLd.phones) phones.push(p);

      // 4. Plain text + unobfuscated regex pass.
      const text = unobfuscate(stripMarkup(html));
      const foundEmails = text.match(EMAIL_RE) ?? [];
      for (const email of foundEmails) emails.push(email.toLowerCase());

      const foundPhones = text.match(PHONE_RE) ?? [];
      for (const rawPhone of foundPhones) {
        const cleaned = rawPhone.replace(/[^\d+]/g, "");
        if (cleaned.length >= 8 && cleaned.length <= 16) phones.push(cleaned);
      }

      if (
        foundEmails.length > 0 ||
        fromHrefs.emails.length > 0 ||
        cfEmails.length > 0 ||
        fromLd.emails.length > 0
      ) {
        sourceUrls.push(target);
      }

      // Stop as soon as we have at least one real email — that's the goal for
      // a lead, and it keeps enrichment fast. (Phones mostly come from the
      // Places API already.)
      if (unique(emails).filter(isLikelyRealEmail).length >= 1) break;
    } catch {
      /* network errors and timeouts are expected on a fraction of sites */
    }
  }

  // 5. Last-resort fallback: if we found nothing AND the domain accepts mail,
  // guess common local parts. Either the scrape failed entirely (SPA shell,
  // anti-bot, network) or the site just doesn't list an email publicly.
  if (
    unique(emails).filter(isLikelyRealEmail).length === 0 &&
    (sawSpaShell || sourceUrls.length === 0)
  ) {
    const guessed = await guessEmailsForDomain(base.hostname.replace(/^www\./, ""));
    for (const e of guessed) emails.push(e);
  }

  return {
    emails: unique(emails).filter(isLikelyRealEmail).slice(0, maxItems),
    phones: unique(phones).slice(0, maxItems),
    sourceUrls: unique(sourceUrls),
  };
}
