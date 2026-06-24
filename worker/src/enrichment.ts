import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Email + phone enrichment.
//
// The actual crawl lives in a standalone Python script (find_emails.py) — this
// module is a thin wrapper that spawns it as a subprocess (one call per lead)
// and parses its JSON. There is NO third-party API fallback anymore (Apollo
// was removed); whatever email we report came directly out of the HTML source
// of one of the lead's own pages. NO GUESSING.
//
// Keeping the crawl in Python (stdlib only) means the scraping logic lives in
// one place and the Docker image just needs `python3`, no pip deps.

type Socials = {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  linkedin?: string;
};

type EnrichedContact = {
  emails: string[];
  phones: string[];
  sourceUrls: string[];
  socials: Socials;
};

// find_emails.py sits at the worker root (/app in the Docker image). This file
// compiles to dist/enrichment.js, so the script is one level up from dist/.
const SCRIPT_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "find_emails.py"
);

// `python3` on Linux/Docker, `python` on Windows. Override with PYTHON_BIN.
const PYTHON_BIN =
  process.env.PYTHON_BIN ||
  (process.platform === "win32" ? "python" : "python3");

// Hard ceiling on the subprocess. The Python script caps its own page walk at
// ~16 s; we give it a little headroom then SIGKILL so a hung child can't
// linger. Callers (scrape-job, reenrich) still apply their own per-lead race.
const SUBPROCESS_TIMEOUT_MS = 25_000;

const EMPTY: EnrichedContact = {
  emails: [],
  phones: [],
  sourceUrls: [],
  socials: {},
};

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

const SOCIAL_KEYS = ["facebook", "instagram", "twitter", "linkedin"] as const;

function toSocials(value: unknown): Socials {
  if (!value || typeof value !== "object") return {};
  const src = value as Record<string, unknown>;
  const out: Socials = {};
  for (const key of SOCIAL_KEYS) {
    const v = src[key];
    if (typeof v === "string" && v) out[key] = v;
  }
  return out;
}

export type LeadSocialColumns = {
  facebook_url?: string;
  instagram_url?: string;
  twitter_url?: string;
  linkedin_url?: string;
};

// Map the harvested socials onto the `leads` table columns. Returns null when
// nothing was found, so callers can skip a no-op UPDATE.
export function socialColumns(socials: Socials): LeadSocialColumns | null {
  const out: LeadSocialColumns = {};
  if (socials.facebook) out.facebook_url = socials.facebook;
  if (socials.instagram) out.instagram_url = socials.instagram;
  if (socials.twitter) out.twitter_url = socials.twitter;
  if (socials.linkedin) out.linkedin_url = socials.linkedin;
  return Object.keys(out).length > 0 ? out : null;
}

// Main entrypoint. Hands the website URL to find_emails.py and returns its
// {emails, phones, sourceUrls} result. Resolves to an empty result on any
// failure (bad URL, missing python, crash, timeout) — enrichment is always
// best-effort and must never throw into the harvest loop.
export async function enrichFromWebsite(
  websiteUrl: string,
  maxItems = 4
): Promise<EnrichedContact> {
  if (!websiteUrl) return EMPTY;

  return new Promise<EnrichedContact>((resolve) => {
    let settled = false;
    const finish = (result: EnrichedContact) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(PYTHON_BIN, [SCRIPT_PATH, websiteUrl, String(maxItems)], {
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch {
      finish(EMPTY);
      return;
    }

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(EMPTY);
    }, SUBPROCESS_TIMEOUT_MS);

    let out = "";
    child.stdout?.on("data", (chunk) => {
      out += chunk.toString();
    });
    child.on("error", () => {
      clearTimeout(timer);
      finish(EMPTY);
    });
    child.on("close", () => {
      clearTimeout(timer);
      try {
        const parsed = JSON.parse(out) as Record<string, unknown>;
        finish({
          emails: toStringArray(parsed.emails).slice(0, maxItems),
          phones: toStringArray(parsed.phones).slice(0, maxItems),
          sourceUrls: toStringArray(parsed.sourceUrls),
          socials: toSocials(parsed.socials),
        });
      } catch {
        finish(EMPTY);
      }
    });
  });
}
