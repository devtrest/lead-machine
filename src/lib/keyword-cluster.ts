const STATIC_CLUSTERS: Record<string, string[]> = {
  dentist: [
    "orthodontist",
    "oral surgeon",
    "dental clinic",
    "cosmetic dentist",
    "pediatric dentist",
    "dental implants",
    "endodontist",
  ],
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
  gym: [
    "fitness center",
    "personal trainer",
    "yoga studio",
    "pilates studio",
    "crossfit",
    "boxing gym",
    "martial arts",
  ],
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
  doctor: [
    "physician",
    "medical clinic",
    "family doctor",
    "internist",
    "urgent care",
  ],
  hospital: ["medical center", "clinic", "urgent care", "emergency room"],
  pharmacy: ["chemist", "drugstore", "medical store", "compounding pharmacy"],
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
  "real estate agent": [
    "real estate agency",
    "realtor",
    "property dealer",
    "property consultant",
  ],
  lawyer: [
    "attorney",
    "law firm",
    "legal services",
    "corporate lawyer",
    "family lawyer",
  ],
  school: [
    "private school",
    "academy",
    "preschool",
    "tutoring center",
    "coaching center",
  ],
  "clothing store": ["boutique", "fashion store", "apparel shop", "menswear", "womenswear"],
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
  hotel: ["guest house", "boutique hotel", "bed and breakfast", "serviced apartment"],
};

function genericVariants(keyword: string): string[] {
  const k = keyword.toLowerCase().trim();
  return [`best ${k}`, `top ${k}`, `${k} near me`];
}

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

// Shared prompt used by both AI providers — same system + user messages
// regardless of provider so cluster quality is consistent if you swap keys.
function clusterPrompt(keyword: string, max: number) {
  return {
    system:
      "You return only a JSON array of short business-category keywords. No prose, no markdown.",
    user: `Give me ${max} closely related business niche keywords for "${keyword}". Each should be a short business category that someone would search on Google Maps. Don't repeat the input. Return only a JSON array of strings.`,
  };
}

function parseJsonArrayKeywords(text: string, max: number): string[] {
  const cleaned = text
    .replace(/```(?:json)?\s*/g, "")
    .replace(/```$/g, "")
    .trim();
  try {
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

async function tryOpenAI(keyword: string, max: number): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return [];
  const { system, user } = clusterPrompt(keyword, max);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // gpt-4o-mini — cheap, fast, strong at structured JSON output.
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.3,
        max_tokens: 200,
        // Force JSON-mode so the model can't wander into prose. The user
        // message already asks for a JSON array; this guarantees it.
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const text: string = json?.choices?.[0]?.message?.content ?? "";
    // json_object mode returns an object with the keys we ask for. The
    // prompt asks for an array directly, so the model often wraps it like
    // { "keywords": [...] }. Parse defensively — accept either shape.
    let arr: string[] = parseJsonArrayKeywords(text, max);
    if (arr.length === 0) {
      try {
        const obj = JSON.parse(text);
        for (const key of Object.keys(obj ?? {})) {
          if (Array.isArray(obj[key])) {
            arr = obj[key]
              .filter((v: unknown): v is string => typeof v === "string")
              .map((s: string) => s.trim())
              .filter(Boolean)
              .slice(0, max);
            if (arr.length > 0) break;
          }
        }
      } catch {
        /* already tried JSON.parse — give up gracefully */
      }
    }
    return arr;
  } catch {
    return [];
  }
}

async function tryMistral(keyword: string, max: number): Promise<string[]> {
  const apiKey = process.env.MISTRAL_API_KEY?.trim();
  if (!apiKey) return [];
  const { system, user } = clusterPrompt(keyword, max);
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
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.3,
        max_tokens: 200,
      }),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const text: string = json?.choices?.[0]?.message?.content ?? "";
    return parseJsonArrayKeywords(text, max);
  } catch {
    return [];
  }
}

// Google Places Text Search caps at ~60 results per query and a broad query
// ("X united states") just returns the top 60 nationally. To reach large
// targets we re-run the search across many cities of the requested country —
// geographic spread yields mostly NEW (non-overlapping) businesses. Only used
// when the location is (essentially) a whole country.
const COUNTRY_CITIES: Record<string, string[]> = {
  "united states": [
    "New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia",
    "San Antonio", "San Diego", "Dallas", "Austin", "San Jose", "Jacksonville",
    "Columbus", "Charlotte", "Indianapolis", "San Francisco", "Seattle",
    "Denver", "Boston", "Nashville", "Las Vegas", "Atlanta", "Miami",
    "Minneapolis", "Portland", "Detroit", "Tampa", "Orlando", "Sacramento",
    "Kansas City", "St. Louis", "Pittsburgh", "Cincinnati", "Cleveland",
  ],
  canada: [
    "Toronto", "Montreal", "Vancouver", "Calgary", "Edmonton", "Ottawa",
    "Winnipeg", "Quebec City", "Hamilton", "Kitchener", "London", "Victoria",
    "Halifax", "Mississauga", "Brampton", "Surrey",
  ],
  "united kingdom": [
    "London", "Birmingham", "Manchester", "Glasgow", "Liverpool", "Leeds",
    "Sheffield", "Edinburgh", "Bristol", "Cardiff", "Leicester", "Coventry",
    "Nottingham", "Newcastle", "Brighton", "Belfast",
  ],
  australia: [
    "Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Gold Coast",
    "Canberra", "Newcastle", "Wollongong", "Hobart", "Geelong", "Townsville",
  ],
  india: [
    "Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Chennai", "Kolkata", "Pune",
    "Ahmedabad", "Jaipur", "Surat", "Lucknow", "Kanpur", "Nagpur", "Indore",
    "Chandigarh", "Coimbatore",
  ],
  pakistan: [
    "Karachi", "Lahore", "Islamabad", "Rawalpindi", "Faisalabad", "Multan",
    "Peshawar", "Quetta", "Sialkot", "Gujranwala", "Hyderabad", "Bahawalpur",
  ],
  "united arab emirates": [
    "Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Ras Al Khaimah", "Fujairah",
  ],
  germany: [
    "Berlin", "Munich", "Hamburg", "Cologne", "Frankfurt", "Stuttgart",
    "Dusseldorf", "Dortmund", "Essen", "Leipzig", "Bremen", "Hanover",
  ],
  france: [
    "Paris", "Marseille", "Lyon", "Toulouse", "Nice", "Nantes", "Strasbourg",
    "Montpellier", "Bordeaux", "Lille", "Rennes", "Toulon",
  ],
};

const COUNTRY_ALIASES: Record<string, string> = {
  usa: "united states",
  us: "united states",
  "u.s.": "united states",
  "u.s.a.": "united states",
  america: "united states",
  "united states of america": "united states",
  uk: "united kingdom",
  "u.k.": "united kingdom",
  britain: "united kingdom",
  "great britain": "united kingdom",
  england: "united kingdom",
  uae: "united arab emirates",
};

/**
 * If the location is essentially a whole country, return that country's major
 * cities (as "City, Country") to spread the search geographically. For a
 * specific city/state we return [] and rely on keyword variation instead.
 */
export function expandLocation(location: string): string[] {
  const norm = location.toLowerCase().trim().replace(/[.\s]+$/, "");
  const canonical = COUNTRY_ALIASES[norm] ?? norm;
  const cities = COUNTRY_CITIES[canonical];
  if (!cities) return [];
  return cities.map((c) => `${c}, ${canonical}`);
}

export async function expandKeyword(
  keyword: string,
  max = 6
): Promise<string[]> {
  const seed = normalize(keyword);
  const out = new Set<string>();

  // Provider preference: OpenAI (gpt-4o-mini) → Mistral → static cluster
  // table → generic 'best X / top X / X near me' suffixes. Each provider's
  // tryX() returns [] when its key isn't set, so we just walk the chain
  // until something lands keywords or we exhaust the options.
  let ai = await tryOpenAI(keyword, max);
  if (ai.length === 0) {
    ai = await tryMistral(keyword, max);
  }
  for (const k of ai) {
    const n = normalize(k);
    if (n && n !== seed) out.add(n);
  }

  if (out.size < max) {
    const direct = STATIC_CLUSTERS[seed];
    if (direct) {
      for (const k of direct) {
        if (out.size >= max) break;
        const n = normalize(k);
        if (n && n !== seed) out.add(n);
      }
    } else {
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

  if (out.size < max) {
    for (const v of genericVariants(keyword)) {
      if (out.size >= max) break;
      const n = normalize(v);
      if (n && n !== seed) out.add(n);
    }
  }

  return Array.from(out).slice(0, max);
}
