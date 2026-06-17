import dnsPromises from "node:dns/promises";

// Email & phone extraction from business websites.
// Strategy chain (each step runs in order, results pooled):
//   1. mailto: / tel: href attrs
//   2. Cloudflare obfuscated data-cfemail
//   3. Schema.org JSON-LD structured data
//   4. Plain text + (at)/(dot) unobfuscation regex
//   5. Common-pattern guessing (info@, contact@, etc.) with MX validation
//      — only when steps 1-4 returned nothing.

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

const SPA_MARKERS = [
  /id\s*=\s*["']__next["']/i,
  /id\s*=\s*["']root["']/i,
  /id\s*=\s*["']app["']/i,
  /id\s*=\s*["']gatsby/i,
  /<meta\s+name\s*=\s*["']next-head/i,
  /<noscript>.{0,200}?(JavaScript|enable|disabled)/i,
];

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

/** Strip HTML markup before applying regex. Keeps mailto/tel hrefs visible. */
function stripMarkup(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ");
}

/** Pull `mailto:` and `tel:` href values directly — most reliable signal. */
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

/**
 * Unobfuscate common email patterns:
 *   "foo (at) bar (dot) com"
 *   "foo [at] bar [dot] com"
 */
function unobfuscate(text: string): string {
  return text
    .replace(/\s*[\[(]?\s*at\s*[\])]?\s*/gi, "@")
    .replace(/\s*[\[(]?\s*dot\s*[\])]?\s*/gi, ".");
}

// Cloudflare's "Email Address Obfuscation" rewrites every mailto: link and
// visible email into <a class="__cf_email__" data-cfemail="HEX">[email&#160;protected]</a>.
// The address is XOR-encoded in data-cfemail with a per-page key.
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

// Schema.org JSON-LD often carries email + telephone at the top of the
// page — present even on SPA-rendered sites for SEO.
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
  if (typeof obj.email === "string") emails.push(obj.email.toLowerCase());
  if (typeof obj.telephone === "string") phones.push(obj.telephone);
  for (const key of Object.keys(obj)) walkJsonLd(obj[key], emails, phones);
}

// MX lookup cache + 3s timeout. Domain having MX records doesn't prove a
// specific mailbox exists, only that the domain accepts mail — caller
// treats these as lower confidence than scraped emails.
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

async function guessEmailsForDomain(domain: string): Promise<string[]> {
  if (!domain) return [];
  if (!(await hasMxRecord(domain))) return [];
  return GUESSED_LOCAL_PARTS.map((lp) => `${lp}@${domain}`);
}

// Almost every site lists its email in the homepage footer or on the contact
// page — so we only check the homepage, then the contact page, and stop on the
// first email. No deep crawling.
const CONTACT_PATHS = ["", "/contact", "/contact-us"];

// Hard caps that keep a single lead's enrichment fast: at most the homepage +
// contact page.
const MAX_FETCH_ATTEMPTS = 2;
const FETCH_TIMEOUT_MS = 6_000;

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
          referer: `${base.origin}/`,
        },
      });
      clearTimeout(timeoutId);

      if (!res.ok) continue;
      const html = await res.text();

      if (
        html.length < 12_000 &&
        SPA_MARKERS.some((m) => m.test(html))
      ) {
        sawSpaShell = true;
      }

      // 1. mailto: / tel: hrefs — highest signal
      const fromHrefs = extractFromHrefs(html);
      for (const e of fromHrefs.emails) emails.push(e.toLowerCase());
      for (const p of fromHrefs.phones) phones.push(p);

      // 2. Cloudflare-obfuscated emails (data-cfemail attrs)
      const cfEmails = extractCfEmails(html);
      for (const e of cfEmails) emails.push(e);

      // 3. JSON-LD structured data
      const fromLd = extractJsonLdEmails(html);
      for (const e of fromLd.emails) emails.push(e);
      for (const p of fromLd.phones) phones.push(p);

      // 4. Plain text + unobfuscated regex
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

      // Stop early if we already have enough.
      // Stop as soon as we have at least one real email — that's the goal for
      // a lead, and it keeps enrichment fast. (Phones mostly come from the
      // Places API already.)
      if (unique(emails).filter(isLikelyRealEmail).length >= 1) break;
    } catch {
      // Network errors / timeouts are expected on a fraction of sites.
    }
  }

  // 5. Last-resort fallback: scrape returned nothing AND either the site
  //    looked like a JS shell or no path responded at all. Guess common
  //    addresses against the domain (after MX validation).
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
