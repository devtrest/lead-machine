export type GeoHit = {
  name: string;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
};

const UA =
  "LocationsHub/1.0 (+https://example.com/contact; developer stack OpenStreetMap contributor)";

export async function geocodeLocation(
  query: string
): Promise<{ lat: number; lon: number; displayName: string } | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", query);

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": UA },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    lat: string;
    lon: string;
    display_name: string;
  }[];
  const first = data[0];
  if (!first) return null;
  return {
    lat: parseFloat(first.lat),
    lon: parseFloat(first.lon),
    displayName: first.display_name,
  };
}

function escapeOverpassRegex(s: string) {
  return s.replace(/[\\^$|[\]()?*+]/g, "\\$&").replace(/"/g, "");
}

function amenityFragments(keyword: string, radius: number, lat: number, lon: number) {
  const k = keyword.trim().toLowerCase();
  const parts: string[] = [];

  const push = (key: string, val: string) => {
    parts.push(
      `node["${key}"="${val}"](around:${radius},${lat},${lon});`,
      `way["${key}"="${val}"](around:${radius},${lat},${lon});`
    );
  };

  if (k.includes("dentist") || k.includes("dental")) {
    push("amenity", "dentist");
    push("healthcare", "dentist");
  }
  if (k.includes("cafe") || k.includes("coffee")) push("amenity", "cafe");
  if (k.includes("restaurant") || k.includes("food")) push("amenity", "restaurant");
  if (k.includes("pharmacy") || k.includes("drug")) push("amenity", "pharmacy");
  if (k.includes("hospital") || k.includes("clinic")) {
    push("amenity", "hospital");
    push("amenity", "clinic");
  }
  if (k.includes("gym") || k.includes("fitness")) {
    push("amenity", "gym");
    push("leisure", "fitness_centre");
  }
  if (k.includes("hotel")) push("tourism", "hotel");

  if (parts.length === 0) {
    const safe = escapeOverpassRegex(keyword.trim());
    if (safe.length < 2) return null;
    parts.push(
      `node(around:${radius},${lat},${lon})["name"~"${safe}",i];`,
      `way(around:${radius},${lat},${lon})["name"~"${safe}",i];`
    );
  }

  return parts.join("\n");
}

export async function searchPlaces(
  keyword: string,
  lat: number,
  lon: number,
  limit: number
): Promise<GeoHit[]> {
  const radius = 18000;
  const body = amenityFragments(keyword, radius, lat, lon);
  if (!body) return [];

  const query = `[out:json][timeout:25];
(
${body}
);
out center tags ${Math.min(limit + 10, 40)};`;

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ data: query }),
  });

  if (!res.ok) return [];
  const json = (await res.json()) as {
    elements?: {
      type: string;
      lat?: number;
      lon?: number;
      center?: { lat: number; lon: number };
      tags?: Record<string, string>;
    }[];
  };

  const hits: GeoHit[] = [];
  for (const el of json.elements ?? []) {
    const plat = el.type === "node" ? el.lat : el.center?.lat;
    const plon = el.type === "node" ? el.lon : el.center?.lon;
    if (plat == null || plon == null) continue;
    const name =
      el.tags?.name ??
      el.tags?.["name:en"] ??
      el.tags?.brand ??
      keyword;
    hits.push({
      name,
      lat: plat,
      lon: plon,
      tags: el.tags,
    });
    if (hits.length >= limit) break;
  }
  return hits;
}
