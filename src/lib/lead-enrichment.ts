import { findEmailViaApollo } from "./apollo-enrich";

// Email + phone enrichment.
//
// Simple step-by-step pipeline. For every lead's website we try a small
// ordered list of pages, inspect the raw HTML of each, and stop at the
// first page that yields a real email. If ALL pages fail to surface an
// email, we hit Apollo's organizations/enrich endpoint as a Layer 2
// fallback — but only if APOLLO_API_KEY is set in the worker env.
//
// Order:
//   1. Homepage (also covers the footer — most small-business sites publish
//      their email in the footer, visible on every page)
//   2. /contact-us  (English contact page)
//   3. /contact     (alternate)
//   4. /about-us    (often has the team / corporate email)
//   5. /about
//   6. /terms-and-conditions (legally required to display an email in many
//      jurisdictions for e-commerce / financial sites)
//   7. /terms
//
// If none of these surface a real email, the lead saves with no email.
// We DO NOT guess (no info@domain.com fallback, no DNS lookups, no AI).
// Whatever email we report came directly out of the HTML source of one of
// the pages above.

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_RE = /(?:\+\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)\d{3,4}[\s-]?\d{3,4}/g;

// Spam / placeholder / asset-file patterns we reject from the extractor
// output. Sites pollute their HTML with example@example.com,
// font.woff@1x.woff URL hashes that look like emails, sentry / wix dummies.
const SPAM_EMAIL_PATTERNS = [
  /^example@/i,
  /^test@/i,
  /^name@/i,
  /^you@/i,
  /^email@/i,
  /^user@/i,
  /^domain@/i,
  /^your@/i,
  /^firstname/i,
  /^lastname/i,
  /^john\.?doe@/i,
  /^jane\.?doe@/i,
  /@example\.(com|net|org)$/i,
  /@domain\.com$/i,
  /@email\.com$/i,
  /@yourdomain\./i,
  /@sentry\.io$/i,
  /@wixpress\.com$/i,
  /@cloudfront\.net$/i,
  /@(2x|3x|x2|x3)\./i,
  /\.(png|jpe?g|gif|webp|svg|css|js|woff2?|ttf|ico)$/i,
];

const PATHS_TO_TRY = [
  "",                       // homepage (includes footer)
  "/contact-us",
  "/contact",
  "/about-us",
  "/about",
  "/terms-and-conditions",
  "/terms",
];

const FETCH_TIMEOUT_MS = 5_000;
// Maximum bytes of HTML body we'll inspect per page. Some Shopify /
// Squarespace pages serve 2-5 MB of inline JSON, CSS, and tracker scripts;
// running regex over that blocks the event loop. We keep a HEAD slice
// (where the meta + nav usually live) AND a TAIL slice (where the footer
// always lives) — total budget stays bounded.
const MAX_HTML_BYTES = 250_000;
const HEAD_SLICE_RATIO = 0.55;

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
  if (e.length < 6) return false;
  if (!e.includes("@")) return false;
  const [local, domain] = e.split("@", 2);
  if (!local || !domain) return false;
  if (!domain.includes(".")) return false;
  for (const p of SPAM_EMAIL_PATTERNS) {
    if (p.test(e)) return false;
  }
  return true;
}

// Decode the HTML entities that commonly hide @ and . in email addresses
// so the regex can still match them. Without this we miss emails like
// "info&#64;example.com" or "info&commat;example.com" that some
// Squarespace / Wix / WordPress themes generate as basic obfuscation.
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&commat;/gi, "@")
    .replace(/&#0*64;/g, "@")
    .replace(/&#x0*40;/gi, "@")
    .replace(/&period;/gi, ".")
    .replace(/&#0*46;/g, ".")
    .replace(/&#x0*2e;/gi, ".")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lowbar;/gi, "_")
    .replace(/&#0*45;/g, "-")
    .replace(/&hyphen;/gi, "-");
}

function stripMarkup(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ");
}

// Slice a long HTML body to ~250 KB while keeping BOTH the head section
// (meta tags, nav, top-of-content) AND the tail section (footer + closing
// scripts). Footer-only emails on Bootstrap/CMS sites would be cut off by
// a naive slice(0, MAX_HTML_BYTES).
function sliceHtml(raw: string): string {
  if (raw.length <= MAX_HTML_BYTES) return raw;
  const headBytes = Math.floor(MAX_HTML_BYTES * HEAD_SLICE_RATIO);
  const tailBytes = MAX_HTML_BYTES - headBytes;
  return raw.slice(0, headBytes) + "\n" + raw.slice(-tailBytes);
}

// Cloudflare "Just a moment..." and friends. Detect early so we don't waste
// budget running 6 extractors over a JavaScript challenge shell. We can't
// bypass them with plain fetch — that needs ScrapingBee or similar.
function isBotProtectionChallenge(html: string): boolean {
  if (html.length > 50_000) return false;
  return (
    /Just a moment\.\.\./i.test(html) ||
    /challenges\.cloudflare\.com/i.test(html) ||
    /cf-challenge-running/i.test(html) ||
    /_Incapsula_Resource/i.test(html) ||
    /datadome-captcha/i.test(html) ||
    /perimeterx/i.test(html) ||
    /Akamai\s+Bot\s+Manager/i.test(html) ||
    /Checking your browser before accessing/i.test(html)
  );
}

// mailto: hrefs are the strongest possible signal — the site OWNER put the
// link there explicitly. We also pull tel: links because we get phones too.
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

// Strip tags + decode obfuscation + run the email regex over what's left.
// Catches plain-text emails sitting in footers, contact-page paragraphs,
// terms-and-conditions blocks.
function extractFromText(html: string): { emails: string[]; phones: string[] } {
  const text = stripMarkup(html);
  const emails = text.match(EMAIL_RE) ?? [];
  const phones: string[] = [];
  for (const raw of text.match(PHONE_RE) ?? []) {
    const cleaned = raw.replace(/[^\d+]/g, "");
    if (cleaned.length >= 8 && cleaned.length <= 16) phones.push(cleaned);
  }
  return { emails: emails.map((e) => e.toLowerCase()), phones };
}

// Inspect ONE page's HTML — return any real emails + phones found there.
// Combines mailto:/tel: href extraction with a plain-text regex pass.
// Returns null if the page is a bot-protection challenge.
function inspectPage(html: string): { emails: string[]; phones: string[] } | null {
  if (isBotProtectionChallenge(html)) return null;
  const fromHrefs = extractFromHrefs(html);
  const fromText = extractFromText(html);
  const emails = unique([
    ...fromHrefs.emails.map((e) => e.toLowerCase()),
    ...fromText.emails,
  ]).filter(isLikelyRealEmail);
  const phones = unique([...fromHrefs.phones, ...fromText.phones]);
  return { emails, phones };
}

async function fetchHtml(url: string, refererOrigin: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        referer: `${refererOrigin}/`,
      },
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const raw = sliceHtml(await res.text());
    return decodeHtmlEntities(raw);
  } catch {
    return null;
  }
}

// Main entrypoint. Walk PATHS_TO_TRY in order. Inspect each page's HTML.
// Return the moment we find a real email on any one of them.
export async function enrichFromWebsite(
  websiteUrl: string,
  maxItems = 4
): Promise<EnrichedContact> {
  const root = normalizeUrl(websiteUrl);
  if (!root) return { emails: [], phones: [], sourceUrls: [] };

  const base = new URL(root);
  const allPhones: string[] = [];
  const sourceUrls: string[] = [];

  for (const path of PATHS_TO_TRY) {
    const target = (() => {
      try {
        return new URL(path || "/", base).toString();
      } catch {
        return null;
      }
    })();
    if (!target) continue;

    const html = await fetchHtml(target, base.origin);
    if (!html) continue;

    // Yield to the event loop between heavy regex passes so the per-lead
    // deadline in scrape-job.ts can fire on time. setTimeout WILL NOT
    // preempt a long synchronous regex pass; without this yield, 20 parallel
    // harvest workers burying the event loop in regex work could push the
    // deadline out by tens of seconds.
    await new Promise((r) => setImmediate(r));

    const result = inspectPage(html);
    if (!result) continue; // bot-protection challenge, move on

    if (result.phones.length > 0) {
      allPhones.push(...result.phones);
    }

    if (result.emails.length > 0) {
      // FOUND. Return the first real email + every phone we've collected
      // along the way. We do NOT keep crawling additional paths once an
      // email is in hand — first hit wins.
      return {
        emails: result.emails.slice(0, maxItems),
        phones: unique(allPhones).slice(0, maxItems),
        sourceUrls: [target],
      };
    }

    sourceUrls.push(target);
  }

  // LAYER 2 — Apollo fallback. Only runs if all 7 site paths failed to
  // surface an email AND APOLLO_API_KEY is set in the worker env. We pay
  // 1 Apollo credit per call but ONLY for the leads our scraper couldn't
  // help — leads that landed an email above never touch Apollo, so credit
  // burn stays bounded by the number of difficult sites in a campaign.
  // Apollo's organization/enrich endpoint returns generic corporate
  // emails (info@brand.com, support@brand.com) when it has data on the
  // domain; null otherwise. Free tier hit rate is ~15-30% on the
  // difficult niches (chain retail, finance) and lower on niches our
  // scraper already handles well.
  const apolloEmail = await findEmailViaApollo(base.host);
  if (apolloEmail) {
    return {
      emails: [apolloEmail],
      phones: unique(allPhones).slice(0, maxItems),
      sourceUrls: ["apollo.io"],
    };
  }

  // No email found anywhere — return whatever phones we picked up.
  // NO GUESSING. The lead saves with phone-only contact info.
  return {
    emails: [],
    phones: unique(allPhones).slice(0, maxItems),
    sourceUrls: unique(sourceUrls),
  };
}
