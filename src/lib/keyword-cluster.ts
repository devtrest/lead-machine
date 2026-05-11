/**
 * Niche keyword expansion. When the user asks for N leads but the first
 * keyword only yields M < N, we expand to a related-niche cluster and merge
 * results (the scraper dedupes by title+placeUrl).
 *
 * Two strategies, picked in this order:
 *   1. Mistral API if MISTRAL_API_KEY is set — returns AI-generated related
 *      niches with proper synonym/category coverage.
 *   2. Hardcoded niche map — fast, free, no external dep. Covers the common
 *      verticals (dental, fitness, food, beauty, automotive, etc.). Falls
 *      back to a generic "$keyword near me" + "best $keyword" prefix
 *      expansion for niches we don't have curated entries for.
 */

const STATIC_CLUSTERS: Record<string, string[]> = {
  // Dental
  dentist: [
    "orthodontist",
    "oral surgeon",
    "dental clinic",
    "cosmetic dentist",
    "pediatric dentist",
    "dental implants",
    "endodontist",
  ],
  // Beauty / personal care
  "beauty salon": [
    "hair salon",
    "nail salon",
    "spa",
    "barbershop",
    "makeup artist",
    "eyebrow threading",
    "lash studio",
  ],
  salon: ["beauty salon", "hair salon", "nail salon", "barbershop", "spa"],
  // Fitness
  gym: [
    "fitness center",
    "personal trainer",
    "yoga studio",
    "pilates studio",
    "crossfit",
    "boxing gym",
    "martial arts",
  ],
  // Food
  restaurant: [
    "cafe",
    "bistro",
    "diner",
    "fast food",
    "fine dining",
    "bar and grill",
    "pizzeria",
  ],
  cafe: ["coffee shop", "bakery", "tea house", "bistro", "patisserie"],
  // Health
  doctor: [
    "physician",
    "medical clinic",
    "family doctor",
    "internist",
    "urgent care",
  ],
  hospital: ["medical center", "clinic", "urgent care", "emergency room"],
  pharmacy: ["chemist", "drugstore", "medical store", "compounding pharmacy"],
  // Automotive
  "car dealership": [
    "used car dealer",
    "auto dealer",
    "car showroom",
    "luxury car dealer",
  ],
  "auto repair": [
    "mechanic",
    "car repair shop",
    "auto body shop",
    "tire shop",
    "oil change",
  ],
  // Real estate
  "real estate agent": [
    "real estate agency",
    "realtor",
    "property dealer",
    "property consultant",
  ],
  // Legal
  lawyer: [
    "attorney",
    "law firm",
    "legal services",
    "corporate lawyer",
    "family lawyer",
  ],
  // Education
  school: [
    "private school",
    "academy",
    "preschool",
    "tutoring center",
    "coaching center",
  ],
  // Retail
  "clothing store": ["boutique", "fashion store", "apparel shop", "menswear", "womenswear"],
  // Services
  "cleaning service": [
    "house cleaning",
    "office cleaning",
    "commercial cleaning",
    "carpet cleaning",
  ],
  photographer: [
    "wedding photographer",
    "portrait photographer",
    "photo studio",
    "event photographer",
  ],
  // Hospitality
  hotel: ["guest house", "boutique hotel", "bed and breakfast", "serviced apartment"],
};

/** Add lightweight prefix variants to any seed keyword. */
function genericVariants(keyword: string): string[] {
  const k = keyword.toLowerCase().trim();
  return [`best ${k}`, `top ${k}`, `${k} near me`];
}

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

async function tryMistral(keyword: string, max: number): Promise<string[]> {
  const apiKey = process.env.MISTRAL_API_KEY?.trim();
  if (!apiKey) return [];

  try {
    const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        messages: [
          {
            role: "system",
            content:
              "You return only a JSON array of short business-category keywords. No prose, no markdown.",
          },
          {
            role: "user",
            content: `Give me ${max} closely related business niche keywords for "${keyword}". Each should be a short business category that someone would search on Google Maps. Don't repeat the input. Return only a JSON array of strings.`,
          },
        ],
        temperature: 0.3,
        max_tokens: 200,
      }),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const text: string = json?.choices?.[0]?.message?.content ?? "";
    // Tolerant parse — strip code fences if present
    const cleaned = text.replace(/```(?:json)?\s*/g, "").replace(/```$/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v: unknown): v is string => typeof v === "string")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, max);
  } catch {
    return [];
  }
}

/**
 * Return up to `max` related niche keywords, never including the input.
 * Tries Mistral first (if configured), then hardcoded clusters, then
 * lightweight prefix variants as a final fallback.
 */
export async function expandKeyword(
  keyword: string,
  max = 6
): Promise<string[]> {
  const seed = normalize(keyword);
  const out = new Set<string>();

  // 1. AI-driven expansion
  const ai = await tryMistral(keyword, max);
  for (const k of ai) {
    const n = normalize(k);
    if (n && n !== seed) out.add(n);
  }

  // 2. Static curated clusters
  if (out.size < max) {
    const direct = STATIC_CLUSTERS[seed];
    if (direct) {
      for (const k of direct) {
        if (out.size >= max) break;
        const n = normalize(k);
        if (n && n !== seed) out.add(n);
      }
    } else {
      // Fuzzy match: does the seed appear in any cluster key or values?
      for (const [head, related] of Object.entries(STATIC_CLUSTERS)) {
        if (head.includes(seed) || seed.includes(head)) {
          for (const k of related) {
            if (out.size >= max) break;
            const n = normalize(k);
            if (n && n !== seed) out.add(n);
          }
        }
      }
    }
  }

  // 3. Generic prefix fallback
  if (out.size < max) {
    for (const v of genericVariants(keyword)) {
      if (out.size >= max) break;
      const n = normalize(v);
      if (n && n !== seed) out.add(n);
    }
  }

  return Array.from(out).slice(0, max);
}
