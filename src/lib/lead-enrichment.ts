const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_RE = /(?:\+\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)\d{3,4}[\s-]?\d{3,4}/g;

// Decode the HTML entities that commonly hide @ . - in email addresses so
// regex can still match them. Without this we miss emails like
// "info&#64;example.com" or "info&commat;example.com" that some Squarespace,
// Wix, and Wordpress themes generate as basic obfuscation.
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

// Email lives in the homepage footer, on the contact page, OR (common for
// spa/salon/restaurant) on the booking-platform page linked from the
// homepage. We add 2 retail-coverage paths because UK/US chain retailers
// (shoe stores, clothing stores, electronics) often put corporate email
// only on /help or /customer-service, never the homepage. Booking-platform
// fallback still covers spas/salons.
const CONTACT_PATHS = [
  "",
  "/contact",
  "/contact-us",
  "/help",
  "/customer-service",
];

// Cap fetches so a no-email site can't crawl forever, but high enough to reach
// the contact + a booking-platform link if neither has the email on the
// homepage directly.
//
// FETCH_TIMEOUT_MS is per-attempt; the caller in scrape-job.ts ALSO applies a
// hard ~8 s per-lead deadline via Promise.race, so the worst case stays
// bounded even if multiple attempts straggle simultaneously.
const MAX_FETCH_ATTEMPTS = 5;
const FETCH_TIMEOUT_MS = 4_000;

// Hard cap on the HTML body we'll keep per fetch. Some Shopify/Squarespace
// pages serve 2-5 MB of inline JSON, CSS, and tracker scripts. EVERY
// regex extractor below runs on the full string; 800 KB × 6 extractors ×
// 20 concurrent workers was burying the Node event loop in CPU work,
// which delayed the per-lead Promise.race timeout from firing on time
// (Promise.race CAN'T preempt sync work). 200 KB is more than enough —
// the footer email + JSON-LD + og:email meta all live in the first
// ~100 KB of DOM order for every real-world site we've checked.
const MAX_HTML_BYTES = 200_000;

// Booking platforms small businesses use INSTEAD of their own contact page.
// If the homepage links to one of these, we follow ONE such link as a
// last-resort fetch — the booking widget usually has the email/phone in
// the embedded business profile.
const BOOKING_HOST_PATTERNS = [
  /\.setmore\.com/i,
  /\.square\.site/i,
  /\.squarespace-cdn\.com/i,
  /squareup\.com\//i,
  /book\.acuityscheduling\.com/i,
  /calendly\.com/i,
  /booksy\.com/i,
  /fresha\.com/i,
  /\.simplybook\./i,
  /\.appointy\.com/i,
];

function findBookingLinks(html: string): string[] {
  const out: string[] = [];
  const re = /href\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = m[1].trim();
    if (!/^https?:/i.test(href)) continue;
    for (const pat of BOOKING_HOST_PATTERNS) {
      if (pat.test(href)) {
        out.push(href);
        break;
      }
    }
  }
  return unique(out);
}

// Many widgets embed business contact info as inline JSON in <script> tags
// without using JSON-LD. Setmore in particular includes the business email
// inside `window.__INITIAL_STATE__` / config blobs. A loose regex over the
// raw HTML catches these.
function extractInlineJsonEmails(html: string): string[] {
  const out: string[] = [];
  const re = /"email"\s*:\s*"([^"]{3,100})"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const candidate = m[1].trim().toLowerCase();
    if (candidate.includes("@")) out.push(candidate);
  }
  return unique(out);
}

function extractMetaEmails(html: string): string[] {
  const out: string[] = [];
  // <meta property="og:email" content="..."> or
  // <meta name="contact:email" content="...">
  const re =
    /<meta[^>]+(?:property|name)\s*=\s*["'](?:og:email|email|contact:email|business:email)["'][^>]+content\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const v = m[1].trim().toLowerCase();
    if (v.includes("@")) out.push(v);
  }
  return unique(out);
}

// Try one host variant of a fetch. Pulls every email signal out of the
// returned HTML and pushes them onto the shared accumulators. Returns the
// raw HTML so callers can inspect it further (e.g. look for booking links).
//
// timeoutMs lets callers give the homepage a longer budget than fallback
// paths — Squarespace/Wix sites can take 4-6 s to respond.
async function fetchAndExtract(
  target: string,
  refererOrigin: string,
  emails: string[],
  phones: string[],
  sourceUrls: string[],
  timeoutMs: number = FETCH_TIMEOUT_MS
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
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
        referer: `${refererOrigin}/`,
      },
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    // Truncate massive HTML bodies before doing any string work. Shopify
    // pages routinely serve 2-5 MB of inline JSON/CSS; running ten regex
    // passes over that on a 16-wide harvest queue blocks the event loop
    // long enough to stall the per-lead Promise.race timeout. The footer +
    // header (where every email signal lives in practice) are always within
    // the first 500-800 KB of DOM order, so we lose nothing useful.
    let rawHtml = await res.text();
    if (rawHtml.length > MAX_HTML_BYTES) {
      rawHtml = rawHtml.slice(0, MAX_HTML_BYTES);
    }
    // Decode the common HTML entities BEFORE running any extractors so
    // entity-obfuscated emails ("info&#64;example.com" → "info@example.com")
    // surface in the regex / inline-JSON passes. Doing this on the raw HTML
    // means mailto/cfemail/JSON-LD all see the normalized form too.
    const html = decodeHtmlEntities(rawHtml);

    const before = emails.length;

    // EARLY-EXIT pipeline: run extractors in order of CPU cost (cheap →
    // expensive) and bail the moment we have a real email. Most sites
    // land the email in the mailto: pass; running the other 5 extractors
    // for nothing was burning event-loop budget for every single fetch.
    //
    // We also yield to the event loop (await new Promise(setImmediate))
    // between heavy extractors so the per-lead Promise.race deadline can
    // actually fire on time. setTimeout WILL NOT preempt a long
    // synchronous regex pass; the scheduler only runs queued callbacks
    // when the call stack is empty. Without these yields, 20 parallel
    // harvest workers burying the event loop in regex work could push
    // the 8 s deadline out by tens of seconds.

    // 1. mailto: / tel: hrefs — fastest + highest-signal. Always run.
    const fromHrefs = extractFromHrefs(html);
    for (const e of fromHrefs.emails) emails.push(e.toLowerCase());
    for (const p of fromHrefs.phones) phones.push(p);

    if (hasGoodEmail(emails)) {
      if (emails.length > before) sourceUrls.push(target);
      return html;
    }
    await new Promise((r) => setImmediate(r));

    // 2. Cloudflare-obfuscated emails (data-cfemail attrs). Cheap regex.
    const cfEmails = extractCfEmails(html);
    for (const e of cfEmails) emails.push(e);
    if (hasGoodEmail(emails)) {
      if (emails.length > before) sourceUrls.push(target);
      return html;
    }
    await new Promise((r) => setImmediate(r));

    // 3. og:email / business:email / contact:email meta tags. Cheap.
    for (const e of extractMetaEmails(html)) emails.push(e);
    if (hasGoodEmail(emails)) {
      if (emails.length > before) sourceUrls.push(target);
      return html;
    }
    await new Promise((r) => setImmediate(r));

    // 4. JSON-LD structured data. Medium cost — has to JSON.parse every
    //    <script type="application/ld+json"> block.
    const fromLd = extractJsonLdEmails(html);
    for (const e of fromLd.emails) emails.push(e);
    for (const p of fromLd.phones) phones.push(p);
    if (hasGoodEmail(emails)) {
      if (emails.length > before) sourceUrls.push(target);
      return html;
    }
    await new Promise((r) => setImmediate(r));

    // 5. Inline JSON config blobs ("email":"..." in <script> tags).
    //    Medium cost — large regex over the full body.
    for (const e of extractInlineJsonEmails(html)) emails.push(e);
    if (hasGoodEmail(emails)) {
      if (emails.length > before) sourceUrls.push(target);
      return html;
    }
    await new Promise((r) => setImmediate(r));

    // 6. Plain text + unobfuscated regex pass. Most expensive — strips
    //    every tag, decodes obfuscation, runs two full-body regexes.
    const text = unobfuscate(stripMarkup(html));
    const foundEmails = text.match(EMAIL_RE) ?? [];
    for (const email of foundEmails) emails.push(email.toLowerCase());

    const foundPhones = text.match(PHONE_RE) ?? [];
    for (const rawPhone of foundPhones) {
      const cleaned = rawPhone.replace(/[^\d+]/g, "");
      if (cleaned.length >= 8 && cleaned.length <= 16) phones.push(cleaned);
    }

    if (emails.length > before) sourceUrls.push(target);
    return html;
  } catch {
    /* network errors and timeouts are expected on a fraction of sites */
    return null;
  }
}

function hasGoodEmail(emails: string[]): boolean {
  return unique(emails).filter(isLikelyRealEmail).length >= 1;
}

export async function enrichFromWebsite(
  websiteUrl: string,
  maxItems = 4
): Promise<EnrichedContact> {
  const root = normalizeUrl(websiteUrl);
  if (!root) return { emails: [], phones: [], sourceUrls: [] };

  const base = new URL(root);
  // ALWAYS hit the domain root as the first candidate, regardless of whatever
  // path Google Places stored against the lead (which can be a deep product
  // page where the footer-email lives but harder to parse). Previously when
  // path = "" we substituted base.pathname which meant a lead stored as
  // "https://x.com/garden-supplies" would never crawl "https://x.com/".
  // Footer + JSON-LD live on the root for almost every small-business site.
  const candidates = unique(
    CONTACT_PATHS.map((path) => {
      try {
        return new URL(path || "/", base).toString();
      } catch {
        return null;
      }
    }).filter((v): v is string => Boolean(v))
  );

  const emails: string[] = [];
  const phones: string[] = [];
  const sourceUrls: string[] = [];
  let attempts = 0;
  let homepageHtml: string | null = null;

  for (const target of candidates) {
    if (attempts >= MAX_FETCH_ATTEMPTS) break;
    attempts++;
    // First fetch (homepage) gets a slightly bigger timeout — Squarespace,
    // Wix, and WordPress hosts routinely take 3-5 s for the initial render.
    // Fallback paths after the first stay at the tighter 4 s default.
    const fetchTimeout = attempts === 1 ? 5_000 : FETCH_TIMEOUT_MS;
    const html = await fetchAndExtract(
      target,
      base.origin,
      emails,
      phones,
      sourceUrls,
      fetchTimeout
    );
    // Cache the first successful homepage response so we can mine it for
    // booking-platform links if every contact path fails to surface an email.
    if (target === candidates[0] && html) homepageHtml = html;
    if (hasGoodEmail(emails)) break;
  }

  // Fallback A — if the apex domain didn't yield an email, try the www
  // subdomain variant (or vice versa). Many small sites only configure SSL
  // on one host.
  if (!hasGoodEmail(emails) && attempts < MAX_FETCH_ATTEMPTS) {
    const altHost = base.host.startsWith("www.")
      ? base.host.slice(4)
      : `www.${base.host}`;
    const altUrl = `${base.protocol}//${altHost}${base.pathname}`;
    attempts++;
    const html = await fetchAndExtract(
      altUrl,
      `${base.protocol}//${altHost}`,
      emails,
      phones,
      sourceUrls
    );
    if (!homepageHtml && html) homepageHtml = html;
  }

  // Fallback B — many spas/salons/restaurants have a one-page marketing site
  // that punts to a booking platform (Setmore, Square, Booksy, etc.) for
  // everything. If the homepage links to such a platform AND we still don't
  // have an email, crawl ONE such link.
  if (
    !hasGoodEmail(emails) &&
    attempts < MAX_FETCH_ATTEMPTS &&
    homepageHtml
  ) {
    const bookingLinks = findBookingLinks(homepageHtml);
    if (bookingLinks.length > 0) {
      attempts++;
      await fetchAndExtract(
        bookingLinks[0],
        base.origin,
        emails,
        phones,
        sourceUrls
      );
    }
  }

  // No guessing: if no real email was found on the site, the lead simply has
  // no email.
  return {
    emails: unique(emails).filter(isLikelyRealEmail).slice(0, maxItems),
    phones: unique(phones).slice(0, maxItems),
    sourceUrls: unique(sourceUrls),
  };
}
