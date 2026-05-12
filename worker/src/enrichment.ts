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

const CONTACT_PATHS = [
  "",
  "/contact",
  "/contact-us",
  "/contactus",
  "/get-in-touch",
  "/about",
  "/about-us",
  "/team",
  "/imprint",
  "/legal/imprint",
];

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

  for (const target of candidates) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(target, {
        cache: "no-store",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "user-agent":
            "Mozilla/5.0 (compatible; LeadMachineBot/1.0) Chrome/122.0",
          accept: "text/html,application/xhtml+xml",
        },
      });
      clearTimeout(timeoutId);
      if (!res.ok) continue;
      const html = await res.text();

      const fromHrefs = extractFromHrefs(html);
      for (const e of fromHrefs.emails) emails.push(e.toLowerCase());
      for (const p of fromHrefs.phones) phones.push(p);

      const text = unobfuscate(stripMarkup(html));
      const foundEmails = text.match(EMAIL_RE) ?? [];
      for (const email of foundEmails) emails.push(email.toLowerCase());

      const foundPhones = text.match(PHONE_RE) ?? [];
      for (const rawPhone of foundPhones) {
        const cleaned = rawPhone.replace(/[^\d+]/g, "");
        if (cleaned.length >= 8 && cleaned.length <= 16) phones.push(cleaned);
      }

      if (foundEmails.length > 0 || fromHrefs.emails.length > 0) {
        sourceUrls.push(target);
      }

      const realCount = unique(emails).filter(isLikelyRealEmail).length;
      if (realCount >= maxItems && unique(phones).length >= maxItems) break;
    } catch {}
  }

  return {
    emails: unique(emails).filter(isLikelyRealEmail).slice(0, maxItems),
    phones: unique(phones).slice(0, maxItems),
    sourceUrls: unique(sourceUrls),
  };
}
