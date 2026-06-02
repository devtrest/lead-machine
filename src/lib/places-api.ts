/**
 * Google Places API (New) — Text Search client (dev-mode mirror of worker/).
 *
 * Used by src/lib/google-maps-scraper.ts when WORKER_URL is unset (local dev
 * or any deploy without the Railway worker). Production through Railway uses
 * the matching client in worker/src/places-api.ts — keep them in sync.
 *
 * See worker/src/places-api.ts for the design rationale.
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
      "GOOGLE_MAPS_API_KEY is not set. Add it to .env.local (dev) or your hosting env vars."
    );
  }

  const query = `${opts.keyword} ${opts.location}`.trim();
  if (query.length < 2) return [];

  const collected: PlacesPlace[] = [];
  const seenIds = new Set<string>();
  let pageToken: string | undefined;

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
      if (res.status === 403) {
        throw new Error(
          "Places API rejected the key (403). Confirm Places API (New) is enabled and the key has API access."
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

    if (page < 2 && collected.length < opts.maxResults) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  return collected.slice(0, opts.maxResults);
}
