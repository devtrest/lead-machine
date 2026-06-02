/**
 * Place-lookup pipeline. Used to be Puppeteer-on-Google-Maps; now backed by
 * the official Google Places API (New).
 *
 * The exported interface (`MapsPlace`, `ProgressEvent`, `scrapeGoogleMaps`)
 * is kept identical so the orchestrator (scrape-job.ts), the API route, and
 * the UI need zero changes.
 */

import { searchPlaces, type PlacesPlace } from "./places-api.js";

export type MapsPlace = {
  title: string;
  rating?: string;
  reviews?: string;
  category?: string;
  address?: string;
  placeUrl?: string;
  websiteUrl?: string;
  phone?: string;
};

export type ProgressEvent =
  | { phase: "launching" }
  | { phase: "searching"; query: string }
  | { phase: "discovering"; count: number; target: number }
  | { phase: "extracting"; count: number; target: number }
  | { phase: "enriching"; count: number; target: number };

function placeToMapsPlace(p: PlacesPlace): MapsPlace {
  // Same shape — PlacesPlace is structurally identical to MapsPlace.
  return p;
}

export async function scrapeGoogleMaps(opts: {
  keyword: string;
  location: string;
  maxResults: number;
  onProgress: (event: ProgressEvent) => void;
}): Promise<MapsPlace[]> {
  const { keyword, location, maxResults, onProgress } = opts;
  const query = `${keyword} ${location}`.trim();

  // Emit the same step ladder the UI knows about, just compressed since
  // Places API is fast (each call ~300-600 ms instead of ~5 s Puppeteer).
  onProgress({ phase: "launching" });
  onProgress({ phase: "searching", query });

  const places = await searchPlaces({
    keyword,
    location,
    maxResults,
    onPage: (collectedCount) => {
      onProgress({
        phase: "discovering",
        count: collectedCount,
        target: maxResults,
      });
    },
  });

  const results = places.map(placeToMapsPlace);

  onProgress({
    phase: "extracting",
    count: results.length,
    target: maxResults,
  });

  // Places API already returned phone + website + address inline, so there's
  // no separate per-place detail navigation step (which Puppeteer needed).
  // Emit `enriching` once with the full count for UI continuity.
  onProgress({
    phase: "enriching",
    count: results.length,
    target: results.length,
  });

  return results;
}
