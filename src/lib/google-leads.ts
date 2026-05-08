type LatLng = { lat: number; lng: number };

export type GoogleLead = {
  placeId: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  userRatingsTotal: number | null;
  mapsUrl: string;
  location: LatLng | null;
  emails: string[];
};

type TextSearchResponse = {
  status: string;
  error_message?: string;
  results?: {
    place_id: string;
  }[];
};

type PlaceDetailsResponse = {
  status: string;
  error_message?: string;
  result?: {
    place_id: string;
    name?: string;
    formatted_address?: string;
    formatted_phone_number?: string;
    international_phone_number?: string;
    website?: string;
    rating?: number;
    user_ratings_total?: number;
    geometry?: { location?: LatLng };
    url?: string;
  };
};

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

function sanitizeUrl(url: string) {
  try {
    return new URL(url).toString();
  } catch {
    return null;
  }
}

function uniq(values: string[]) {
  return Array.from(new Set(values));
}

export async function googleTextSearch(
  keyword: string,
  location: string,
  limit: number,
  apiKey: string
) {
  const q = `${keyword} in ${location}`;
  const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
  url.searchParams.set("query", q);
  url.searchParams.set("key", apiKey);
  const res = await fetch(url.toString(), { cache: "no-store" });
  const data = (await res.json()) as TextSearchResponse;
  if (!res.ok || data.status === "REQUEST_DENIED" || data.status === "INVALID_REQUEST") {
    throw new Error(data.error_message ?? `Google Text Search failed: ${data.status}`);
  }
  return (data.results ?? []).slice(0, limit).map((r) => r.place_id);
}

export async function googlePlaceDetails(placeId: string, apiKey: string) {
  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set(
    "fields",
    [
      "place_id",
      "name",
      "formatted_address",
      "formatted_phone_number",
      "international_phone_number",
      "website",
      "rating",
      "user_ratings_total",
      "geometry",
      "url",
    ].join(",")
  );
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString(), { cache: "no-store" });
  const data = (await res.json()) as PlaceDetailsResponse;
  if (!res.ok || data.status !== "OK" || !data.result) {
    throw new Error(data.error_message ?? `Google Place Details failed: ${data.status}`);
  }

  const phone = data.result.international_phone_number ?? data.result.formatted_phone_number ?? null;
  return {
    placeId: data.result.place_id,
    name: data.result.name ?? "Unknown",
    address: data.result.formatted_address ?? null,
    phone,
    website: data.result.website ?? null,
    rating: data.result.rating ?? null,
    userRatingsTotal: data.result.user_ratings_total ?? null,
    mapsUrl:
      data.result.url ??
      `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(data.result.place_id)}`,
    location: data.result.geometry?.location ?? null,
  };
}

async function fetchPublicEmails(websiteUrl: string, maxEmails: number) {
  const normalized = sanitizeUrl(websiteUrl);
  if (!normalized) return [];
  const root = new URL(normalized);
  const candidates = [
    root.toString(),
    new URL("/contact", root).toString(),
    new URL("/contact-us", root).toString(),
    new URL("/about", root).toString(),
  ];

  const found: string[] = [];
  for (const url of candidates) {
    try {
      const res = await fetch(url, { cache: "no-store", redirect: "follow" });
      if (!res.ok) continue;
      const html = await res.text();
      const matches = html.match(EMAIL_RE) ?? [];
      for (const m of matches) {
        found.push(m.toLowerCase());
      }
      if (found.length >= maxEmails) break;
    } catch {
      // Keep best effort behavior; website fetch failures are common.
    }
  }
  return uniq(found).slice(0, maxEmails);
}

export async function discoverGoogleLeads(input: {
  keyword: string;
  location: string;
  limit: number;
  includeEmails: boolean;
  maxEmailsPerLead: number;
  apiKey: string;
}) {
  const placeIds = await googleTextSearch(
    input.keyword,
    input.location,
    input.limit,
    input.apiKey
  );

  const leads = await Promise.all(
    placeIds.map(async (placeId) => {
      const core = await googlePlaceDetails(placeId, input.apiKey);
      const emails =
        input.includeEmails && core.website
          ? await fetchPublicEmails(core.website, input.maxEmailsPerLead)
          : [];
      return {
        ...core,
        emails,
      } satisfies GoogleLead;
    })
  );

  return leads;
}
