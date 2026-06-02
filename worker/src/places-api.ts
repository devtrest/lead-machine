/**
 * Google Places API (New) — Text Search client.
 *
 * Why we use this instead of Puppeteer:
 *   - Google blocks cloud-server IPs from Maps. Puppeteer-on-Railway gets a
 *     consent wall / empty page; selectors never resolve; scrape times out.
 *   - Places API works from any IP, no fingerprinting, no CAPTCHAs.
 *   - Returns structured business data (name, address, phone, website,
 *     rating, types) in one HTTP call.
 *
 * Cost: ~$2.25 per 1,000 leads with full contact data, BUT Google gives every
 * account a monthly free quota. Practical usage stays at $0/month for typical
 * SaaS scale.
 *
 * Limits we have to work around:
 *   - Hard cap of 60 results per text query (3 pages × 20). For higher
 *     targets we rely on keyword clustering (worker/src/keywords.ts) to
 *     vary the search and merge.
 *   - `nextPageToken` requires a ~1 s settling delay before it's accepted
 *     by Google (we wait 1.5 s to be safe).
 */

export type PlacesPlace = {
  title: string;
  rating?: string;
  reviews?: string;
  category?: string;
  address?: string;
  placeUrl?: string;
  websiteUrl?: string;
  phone?: string;
};

// Field mask tells Google which response fields to bill us for + return.
// All of these together put us in the Enterprise SKU (contact data) — the
// most expensive tier, but still inside the monthly free quota for small scale.
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.primaryType",
  "places.googleMapsUri",
  "nextPageToken",
].join(",");

function prettifyType(t?: string): string | undefined {
  if (!t) return undefined;
  // "dental_clinic" → "Dental clinic"
  return t
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

type ApiPlace = {
  id?: string;
  displayName?: { text?: string; languageCode?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  primaryType?: string;
  googleMapsUri?: string;
};

type ApiResponse = {
  places?: ApiPlace[];
  nextPageToken?: string;
};

export async function searchPlaces(opts: {
  keyword: string;
  location: string;
  maxResults: number;
  onPage?: (collectedCount: number) => void;
}): Promise<PlacesPlace[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "GOOGLE_MAPS_API_KEY is not set. Add it to the worker's env vars."
    );
  }

  const query = `${opts.keyword} ${opts.location}`.trim();
  if (query.length < 2) return [];

  const collected: PlacesPlace[] = [];
  const seenIds = new Set<string>();
  let pageToken: string | undefined;

  // Google caps Text Search at 60 results total (3 pages × 20).
  for (let page = 0; page < 3 && collected.length < opts.maxResults; page++) {
    const body: Record<string, unknown> = {
      textQuery: query,
      pageSize: Math.min(20, opts.maxResults - collected.length),
      languageCode: "en",
    };
    if (pageToken) {
      body.pageToken = pageToken;
    }

    let res: Response;
    try {
      res = await fetch(
        "https://places.googleapis.com/v1/places:searchText",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": FIELD_MASK,
          },
          body: JSON.stringify(body),
        }
      );
    } catch (err) {
      throw new Error(
        `Places API network error: ${err instanceof Error ? err.message : "unknown"}`
      );
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      // Friendlier error for the common setup issues
      if (res.status === 403) {
        throw new Error(
          "Places API rejected the key (403). Confirm Places API (New) is enabled in Google Cloud Console for this project, and the key has API access enabled."
        );
      }
      if (res.status === 400 && /API key not valid/i.test(text)) {
        throw new Error(
          "GOOGLE_MAPS_API_KEY is invalid. Check it on Google Cloud Console → APIs & Services → Credentials."
        );
      }
      throw new Error(`Places API ${res.status}: ${text.slice(0, 240)}`);
    }

    const json = (await res.json()) as ApiResponse;
    const places = json.places ?? [];

    for (const p of places) {
      if (p.id && seenIds.has(p.id)) continue;
      const title = p.displayName?.text?.trim();
      if (!title) continue;
      if (p.id) seenIds.add(p.id);

      collected.push({
        title,
        address: p.formattedAddress,
        phone: p.nationalPhoneNumber ?? p.internationalPhoneNumber,
        websiteUrl: p.websiteUri,
        rating: p.rating !== undefined ? String(p.rating) : undefined,
        reviews:
          p.userRatingCount !== undefined ? String(p.userRatingCount) : undefined,
        category: prettifyType(p.primaryType),
        placeUrl: p.googleMapsUri,
      });

      if (collected.length >= opts.maxResults) break;
    }

    opts.onPage?.(collected.length);

    pageToken = json.nextPageToken;
    if (!pageToken) break;

    // Google needs a moment to make the next-page token valid.
    if (page < 2 && collected.length < opts.maxResults) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  return collected.slice(0, opts.maxResults);
}
