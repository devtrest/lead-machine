import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
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

// If the Python subprocess can't even start (binary missing, script missing),
// EVERY lead silently returns empty and the whole harvest looks like it found
// nothing. That's invisible without a log, so we surface the first failure
// loudly (once) — the signature symptom of a Railway image that didn't install
// python3. checkPython() (below, surfaced on /health) is the proactive version.
let spawnFailureLogged = false;
function logSpawnFailureOnce(detail: string) {
  if (spawnFailureLogged) return;
  spawnFailureLogged = true;
  console.error(
    `[enrichment] python subprocess failed to start (${detail}). ` +
      `bin=${PYTHON_BIN} script=${SCRIPT_PATH}. ` +
      `Every email lookup will return empty until this is fixed — is python3 ` +
      `installed in the image and is find_emails.py present?`
  );
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
    } catch (err) {
      logSpawnFailureOnce(err instanceof Error ? err.message : "spawn threw");
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
    child.on("error", (err) => {
      clearTimeout(timer);
      logSpawnFailureOnce(err instanceof Error ? err.message : "error event");
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

export type PythonHealth = {
  ok: boolean;
  bin: string;
  version?: string;
  scriptPresent: boolean;
  scriptPath: string;
  error?: string;
};

// Proactive self-check used by /health: can we actually run the scraper in
// this environment? Confirms the interpreter launches (`python3 --version`)
// and that find_emails.py shipped into the image. Lets us diagnose a broken
// production harvest from a single curl instead of guessing.
export async function checkPython(): Promise<PythonHealth> {
  const scriptPresent = existsSync(SCRIPT_PATH);
  return new Promise<PythonHealth>((resolve) => {
    let settled = false;
    const done = (h: PythonHealth) => {
      if (settled) return;
      settled = true;
      resolve(h);
    };

    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(PYTHON_BIN, ["--version"], {
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (err) {
      done({
        ok: false,
        bin: PYTHON_BIN,
        scriptPresent,
        scriptPath: SCRIPT_PATH,
        error: err instanceof Error ? err.message : "spawn threw",
      });
      return;
    }

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      done({
        ok: false,
        bin: PYTHON_BIN,
        scriptPresent,
        scriptPath: SCRIPT_PATH,
        error: "timeout",
      });
    }, 5_000);

    let out = "";
    child.stdout?.on("data", (c) => (out += c.toString()));
    child.stderr?.on("data", (c) => (out += c.toString())); // some pythons print version to stderr
    child.on("error", (err) => {
      clearTimeout(timer);
      done({
        ok: false,
        bin: PYTHON_BIN,
        scriptPresent,
        scriptPath: SCRIPT_PATH,
        error: err instanceof Error ? err.message : "error event",
      });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const version = out.trim() || undefined;
      done({
        ok: code === 0 && scriptPresent,
        bin: PYTHON_BIN,
        version,
        scriptPresent,
        scriptPath: SCRIPT_PATH,
        error:
          code === 0
            ? scriptPresent
              ? undefined
              : "find_emails.py missing"
            : `python exited ${code}`,
      });
    });
  });
}
