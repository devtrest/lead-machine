/**
 * Place-lookup pipeline for the dev-mode/embedded path (when WORKER_URL is
 * unset). Used to be Puppeteer-on-Google-Maps; now backed by the official
 * Google Places API (New).
 *
 * The file name is kept (`google-maps-scraper.ts`) so the API route's import
 * doesn't have to change. The exported types and `scrapeGoogleMaps` signature
 * are also unchanged, so callers compile without edits.
 */

import { searchPlaces, type PlacesPlace } from "./places-api";

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
  return p;
}

export async function scrapeGoogleMaps(opts: {
  keyword: string;
  location: string;
  maxResults: number;
  onProgress?: (event: ProgressEvent) => void;
}): Promise<MapsPlace[]> {
  const { keyword, location, maxResults, onProgress } = opts;
  const query = `${keyword} ${location}`.trim();

  onProgress?.({ phase: "launching" });
  onProgress?.({ phase: "searching", query });

  const places = await searchPlaces({
    keyword,
    location,
    maxResults,
    onPage: (collectedCount) => {
      onProgress?.({
        phase: "discovering",
        count: collectedCount,
        target: maxResults,
      });
    },
  });

  const results = places.map(placeToMapsPlace);

  onProgress?.({
    phase: "extracting",
    count: results.length,
    target: maxResults,
  });

  onProgress?.({
    phase: "enriching",
    count: results.length,
    target: results.length,
  });

  return results;
}
