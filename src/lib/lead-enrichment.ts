const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_RE = /(?:\+\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)\d{3,4}[\s-]?\d{3,4}/g;

type EnrichedContact = {
  emails: string[];
  phones: string[];
  sourceUrls: string[];
};

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function normalizeUrl(value: string) {
  try {
    return new URL(value).toString();
  } catch {
    return null;
  }
}

function stripMarkup(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

export async function enrichFromWebsite(
  websiteUrl: string,
  maxItems = 4
): Promise<EnrichedContact> {
  const root = normalizeUrl(websiteUrl);
  if (!root) {
    return { emails: [], phones: [], sourceUrls: [] };
  }

  const base = new URL(root);
  const candidates = unique([
    base.toString(),
    new URL("/contact", base).toString(),
    new URL("/contact-us", base).toString(),
    new URL("/about", base).toString(),
  ]);

  const emails: string[] = [];
  const phones: string[] = [];
  const sourceUrls: string[] = [];

  for (const target of candidates) {
    try {
      const res = await fetch(target, { cache: "no-store", redirect: "follow" });
      if (!res.ok) continue;
      const html = await res.text();
      const text = stripMarkup(html);

      const foundEmails = text.match(EMAIL_RE) ?? [];
      for (const email of foundEmails) emails.push(email.toLowerCase());

      const foundPhones = text.match(PHONE_RE) ?? [];
      for (const rawPhone of foundPhones) {
        const cleaned = rawPhone.replace(/[^\d+]/g, "");
        if (cleaned.length >= 8) phones.push(cleaned);
      }

      if (foundEmails.length > 0 || foundPhones.length > 0) {
        sourceUrls.push(target);
      }
      if (emails.length >= maxItems && phones.length >= maxItems) break;
    } catch {
      // Keep best-effort behavior; crawl failures are expected.
    }
  }

  return {
    emails: unique(emails).slice(0, maxItems),
    phones: unique(phones).slice(0, maxItems),
    sourceUrls: unique(sourceUrls),
  };
}
