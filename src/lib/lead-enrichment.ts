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
  return (
    text
      // " [at] " / " (at) " / " {at} " / " at " when bracketed
      .replace(/\s*[\[({]\s*at\s*[\])}]\s*/gi, "@")
      .replace(/\s+at\s+(?=\w+\s*[.])/gi, "@") // " name at example.com"
      // " [dot] " / " (dot) " / " {dot} "
      .replace(/\s*[\[({]\s*dot\s*[\])}]\s*/gi, ".")
      .replace(/\s+dot\s+(?=[a-z]{2,})/gi, ".") // " example dot com"
      // Less common: "@" written as "AT" or "(AT)" without brackets
      .replace(/\s*\bAT\b\s*/g, "@")
      // Single quotes / smart quotes that some sites use to break the @
      .replace(/['']\s*at\s*['']/gi, "@")
      .replace(/['']\s*\.\s*['']/g, ".")
      // Some sites split with HTML comments to defeat scrapers
      .replace(/<!--[^>]*?-->/g, "")
  );
}

// Score and return the most promising INTERNAL links from a homepage by
// the text they expose. Instead of guessing /contact /contact-us, we look
// at the actual navigation and follow whatever the SITE OWNER labeled as
// 'Contact', 'About', 'Get in touch', etc. Catches unconventional URLs
// like /reach-us, /about/contact, /the-team, /staff-directory.
//
// Multi-language coverage matters because a London-based currency
// exchange might be labeled in Arabic, Polish, or Hindi for an immigrant
// audience even when the URL is .co.uk. Same for European restaurants,
// Asian salons, etc. The SIGNAL_WORDS list now covers the 15+ most
// common languages we see in international scrapes.
function findContactCandidateLinks(
  html: string,
  baseUrl: URL
): string[] {
  // Words that indicate "this link will probably have an email"
  const SIGNAL_WORDS = [
    // English
    /contact/i,
    /reach\s*us/i,
    /get\s*in\s*touch/i,
    /get\s*touch/i,
    /talk\s*to\s*us/i,
    /about\b/i,
    /about\s*us/i,
    /our\s*team/i,
    /team\b/i,
    /staff/i,
    /people\b/i,
    /our\s*story/i,
    /who\s*we\s*are/i,
    /support/i,
    /help\b/i,
    /info\b/i,
    /find\s*us/i,
    /visit\s*us/i,
    /imprint/i, // German legal page
    // German
    /kontakt/i,
    /impressum/i,
    /uber\s*uns/i,
    /über\s*uns/i,
    // Spanish
    /contacto/i,
    /contáctenos/i,
    /sobre\s*nosotros/i,
    /quienes\s*somos/i,
    // French
    /contactez/i,
    /a\s*propos/i,
    /à\s*propos/i,
    /qui\s*sommes\s*nous/i,
    /mentions\s*l[eé]gales/i,
    // Italian
    /contatti/i,
    /chi\s*siamo/i,
    // Portuguese
    /contato/i,
    /sobre/i,
    // Dutch
    /over\s*ons/i,
    // Polish / Czech / Slovak
    /kontakt/i, // also Polish
    /o\s*nas/i,
    // Arabic (transliterated link slugs)
    /ittisaal/i,
    // Russian (transliterated slugs)
    /kontakty/i,
  ];

  const out: { url: string; score: number }[] = [];
  // Capture <a href="..." ...>text</a> with the link text exposed.
  const re = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = m[1].trim();
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
      continue;
    }
    // Strip HTML out of the anchor text so signal-word matches don't
    // catch text inside nested tags.
    const text = m[2].replace(/<[^>]+>/g, " ").trim();
    if (!text) continue;

    let score = 0;
    for (let i = 0; i < SIGNAL_WORDS.length; i++) {
      if (SIGNAL_WORDS[i].test(text)) {
        // Front of the list (contact, reach us, etc.) gets the highest
        // score; about/team get lower.
        score += Math.max(1, 10 - i);
      }
    }
    if (score === 0) continue;

    let absolute: string;
    try {
      absolute = new URL(href, baseUrl).toString();
    } catch {
      continue;
    }
    // Reject cross-domain links — only follow internal pages.
    try {
      const u = new URL(absolute);
      if (u.host !== baseUrl.host) continue;
    } catch {
      continue;
    }
    out.push({ url: absolute, score });
  }

  // Sort by score desc, dedup by URL, take top 3.
  const seen = new Set<string>();
  return out
    .sort((a, b) => b.score - a.score)
    .filter((x) => {
      if (seen.has(x.url)) return false;
      seen.add(x.url);
      return true;
    })
    .slice(0, 3)
    .map((x) => x.url);
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
// homepage. We add retail-coverage paths because chain retailers put
// corporate email only on /help or /customer-service, never the homepage.
// EU legal-page paths are added because German (Impressum) and French
// (Mentions légales) sites are LEGALLY REQUIRED to display an email here.
// Booking-platform fallback still covers spas/salons.
const CONTACT_PATHS = [
  "",
  "/contact",
  "/contact-us",
  "/help",
  "/customer-service",
  "/impressum", // German legal page — email is mandatory by law
  "/imprint",   // English version of Impressum
  "/legal-notice", // French 'Mentions légales'
];

// Cap fetches so a no-email site can't crawl forever, but high enough to reach
// the contact + a booking-platform link if neither has the email on the
// homepage directly.
//
// FETCH_TIMEOUT_MS is per-attempt; the caller in scrape-job.ts ALSO applies a
// hard ~8 s per-lead deadline via Promise.race, so the worst case stays
// bounded even if multiple attempts straggle simultaneously.
const MAX_FETCH_ATTEMPTS = 8;
const FETCH_TIMEOUT_MS = 4_000;

// Hard cap on the HTML body we'll keep per fetch. Some Shopify/Squarespace
// pages serve 2-5 MB of inline JSON, CSS, and tracker scripts. EVERY
// regex extractor below runs on the full string; running them on the full
// body × 6 extractors × 20 concurrent workers was burying the Node event
// loop in CPU work and delaying the per-lead Promise.race deadline.
//
// We preserve a HEAD slice AND a TAIL slice (see sliceHtml below) so the
// document footer — where small-business contact emails almost always
// live — is never truncated away even on huge pages.
const MAX_HTML_BYTES = 300_000;
const HEAD_SLICE_RATIO = 0.6; // 60% of the cap goes to the start of the doc
                              // (head / nav / start-of-content), 40% to the
                              // tail (footer / contact / bottom scripts).

// On a Victoria Street FX-style site, the footer holds the only published
// email but sits well past 200 KB into the body (because the site precedes
// it with inline tracker JS and a Bootstrap CSS bundle). A naive
// html.slice(0, MAX_HTML_BYTES) drops the footer entirely and we miss the
// email. Concatenating the head + tail keeps the regex cost the same as a
// single-slice truncation while guaranteeing the footer is always in scope.
function sliceHtml(raw: string): string {
  if (raw.length <= MAX_HTML_BYTES) return raw;
  const headBytes = Math.floor(MAX_HTML_BYTES * HEAD_SLICE_RATIO);
  const tailBytes = MAX_HTML_BYTES - headBytes;
  // The newline separator stops a regex match from straddling the slice
  // boundary (e.g. a half-mailto: anchor pasted to a half-href= attribute).
  return raw.slice(0, headBytes) + "\n" + raw.slice(-tailBytes);
}

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

// Specifically target the <footer> section of the HTML — that's where 80%
// of small-business contact emails actually live. By isolating the footer
// first we run a smaller, faster regex on the densest signal area, and
// we sidestep the case where a busy header / nav / hero section eats up
// the budget before we get to the contact info.
function extractFooterEmails(html: string): string[] {
  // Be liberal about matching — <footer>, <div class="footer">, role="contentinfo"
  const footerOpen = html.search(
    /<footer\b|<div[^>]+(?:class|id)\s*=\s*["'][^"']*footer|<address\b|role\s*=\s*["']contentinfo["']/i
  );
  if (footerOpen < 0) return [];
  const footerSlice = html.slice(footerOpen);
  const out: string[] = [];
  // Mailto first
  const mailtoRe = /href\s*=\s*["']mailto:([^"'?#]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = mailtoRe.exec(footerSlice)) !== null) {
    out.push(decodeURIComponent(m[1]).trim().toLowerCase());
  }
  // Then any plain-text email pattern in this region
  const matches = footerSlice.match(EMAIL_RE) ?? [];
  for (const e of matches) out.push(e.toLowerCase());
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
    // Truncate massive HTML bodies before doing any string work. Big CMS
    // pages routinely serve 2-5 MB of inline JSON/CSS; running multiple
    // regex passes over that on a 20-wide harvest queue blocks the event
    // loop long enough to stall the per-lead Promise.race timeout.
    //
    // sliceHtml() keeps a head slice AND a tail slice — the footer (where
    // small-business contact emails almost always live) is always in scope
    // even on heavyweight Bootstrap/CMS sites where it sits past 200 KB.
    const rawHtml = sliceHtml(await res.text());

    // Detect bot-protection challenge pages (Cloudflare "Just a moment...",
    // Imperva, Akamai, DataDome). They return 200 OK with a JS challenge
    // shell instead of the real site, so all our extractors run on garbage
    // and waste budget. Bail immediately and let the next path / sitemap
    // /www-variant try a different angle.
    if (isBotProtectionChallenge(rawHtml)) {
      return rawHtml;
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

    // 1b. <footer> / <address> targeted scan. Small-business sites where
    //     the email is plain text in the footer (no mailto:, no JSON-LD)
    //     get caught here cheap — we only regex the footer slice, not the
    //     whole body. Victoria Street FX style sites land here.
    for (const e of extractFooterEmails(html)) emails.push(e);
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

// Anti-bot challenge pages return 200 OK with a tiny JS shell instead of
// the real site. Cloudflare's "Just a moment..." is by far the most common
// (~20% of UK/EU finance + retail), but Akamai, Imperva (Incapsula),
// DataDome, and PerimeterX all use the same pattern. Running our 6
// extractors over the challenge HTML is wasted CPU and can even false-
// positive on script-src host strings. Bail at the door instead.
function isBotProtectionChallenge(html: string): boolean {
  // Cheap check first — the challenge pages are always < 10 KB.
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

// SITEMAP DISCOVERY — many CMS sites publish sitemap.xml listing every
// public URL. We pull it, filter to URLs that contain contact/about/team-
// signal words in the path, and return the top candidates. Way better hit
// rate than path-guessing for sites with unusual URL structures (e.g.
// /pages/our-team-and-mission, /info/legal/contact-form). Single fetch,
// cheap regex, only runs as a fallback when the homepage + smart-link
// discovery both failed.
//
// Each sitemap-style fetch has a tight 3 s timeout because the file is
// rarely worth waiting for if it's slow — most sites that have it serve
// it quickly. A failed sitemap fetch is a no-op, never bubbles an error.
async function discoverSitemapContactUrls(
  base: URL,
  refererOrigin: string
): Promise<string[]> {
  const sitemapCandidates = [
    `${base.origin}/sitemap.xml`,
    `${base.origin}/sitemap_index.xml`,
    `${base.origin}/sitemap-index.xml`,
    `${base.origin}/wp-sitemap.xml`,
  ];

  for (const sitemapUrl of sitemapCandidates) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3_000);
      const res = await fetch(sitemapUrl, {
        cache: "no-store",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          accept: "application/xml,text/xml,*/*;q=0.9",
          referer: `${refererOrigin}/`,
        },
      });
      clearTimeout(timeoutId);
      if (!res.ok) continue;
      const xml = await res.text();

      const urls: { url: string; score: number }[] = [];
      const re = /<loc>([^<]+)<\/loc>/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(xml)) !== null) {
        const url = m[1].trim();
        // Only same-host URLs; reject cross-domain entries.
        try {
          if (new URL(url).host !== base.host) continue;
        } catch {
          continue;
        }
        // Score by signal words in the path. Higher score = more likely to
        // surface an email when fetched.
        let score = 0;
        if (/contact|kontakt|contacto|contatti/i.test(url)) score += 10;
        if (/about|uber-uns|sobre|chi-siamo/i.test(url)) score += 5;
        if (/team|staff|people|our-team/i.test(url)) score += 4;
        if (/impressum|imprint|mentions-legales|legal-notice/i.test(url))
          score += 6;
        if (/reach|touch|help|support/i.test(url)) score += 3;
        if (score === 0) continue;
        urls.push({ url, score });
      }

      // Top 3, sorted by score desc.
      return urls
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((u) => u.url);
    } catch {
      /* try next sitemap candidate */
    }
  }
  return [];
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

  // SMART CONTACT-PAGE DISCOVERY — if our common-path guesses didn't land
  // an email but we have the homepage HTML, parse its navigation to find
  // whatever the site OWNER labeled 'Contact', 'About', 'Reach us', etc.
  // (in any of 15+ languages) and follow up to 2 of those links. Way
  // better hit rate than guessing /contact-us for a site that uses
  // /get-in-touch or /the-team.
  let lastSmartHtml: string | null = null;
  if (!hasGoodEmail(emails) && homepageHtml && attempts < MAX_FETCH_ATTEMPTS) {
    const smartLinks = findContactCandidateLinks(homepageHtml, base);
    // Filter out paths we already tried.
    const triedSet = new Set(candidates);
    const fresh = smartLinks.filter((u) => !triedSet.has(u));
    for (const link of fresh.slice(0, 2)) {
      if (attempts >= MAX_FETCH_ATTEMPTS) break;
      attempts++;
      const html = await fetchAndExtract(
        link,
        base.origin,
        emails,
        phones,
        sourceUrls
      );
      if (html) lastSmartHtml = html;
      if (hasGoodEmail(emails)) break;
    }
  }

  // DEPTH-2 — if the contact page we landed on had its OWN nav linking to
  // a deeper sub-page (e.g. /contact links to /staff or /branches), follow
  // ONE more level. Catches multi-location businesses (currency exchanges
  // with branch pages, restaurant chains with location pages) and
  // service businesses with a separate /team page.
  if (
    !hasGoodEmail(emails) &&
    lastSmartHtml &&
    attempts < MAX_FETCH_ATTEMPTS
  ) {
    const deeperLinks = findContactCandidateLinks(lastSmartHtml, base);
    const tried = new Set(candidates);
    const fresh = deeperLinks.filter((u) => !tried.has(u));
    if (fresh.length > 0) {
      attempts++;
      await fetchAndExtract(
        fresh[0],
        base.origin,
        emails,
        phones,
        sourceUrls
      );
    }
  }

  // SITEMAP FALLBACK — last-resort discovery. Many CMS sites publish
  // sitemap.xml with every URL on the site. We pull it, filter to URLs
  // with contact/about/team signal words in the PATH itself, and follow
  // the top 1-2. Catches sites with unconventional URL structures like
  // /pages/our-team-and-mission or /info/legal/contact-form that neither
  // path-guessing nor link-parsing would surface.
  if (!hasGoodEmail(emails) && attempts < MAX_FETCH_ATTEMPTS) {
    const sitemapUrls = await discoverSitemapContactUrls(base, base.origin);
    const tried = new Set(candidates);
    const fresh = sitemapUrls.filter((u) => !tried.has(u));
    for (const link of fresh.slice(0, 2)) {
      if (attempts >= MAX_FETCH_ATTEMPTS) break;
      attempts++;
      await fetchAndExtract(
        link,
        base.origin,
        emails,
        phones,
        sourceUrls
      );
      if (hasGoodEmail(emails)) break;
    }
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
