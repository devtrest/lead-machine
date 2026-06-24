import puppeteer, { type Browser } from "puppeteer-core";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Layer 2 of email harvesting: a headless Chromium pass for sites whose email
// is injected by JavaScript and therefore absent from the static HTML that the
// fast Python HTTP scraper (find_emails.py) sees. Runs ONLY on leads Layer 1
// couldn't crack (gated by opts.useBrowser in enrichment.ts).
//
// Design notes:
//   - ONE shared browser instance, reused across calls (launch is expensive).
//   - A hard concurrency cap (BROWSER_CONCURRENCY) so a big campaign can't open
//     20 Chromium tabs and OOM the box.
//   - Rendering only — extraction is delegated to find_emails.py's --html stdin
//     mode, so all the email/dedup/social logic stays in one place.
//   - If Chromium can't launch (missing binary / not enough RAM), we disable
//     the layer after the first failure and fall back to empty, so we never
//     pay a doomed launch per-lead. browserStatus() surfaces this on /health.

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

const EMPTY: EnrichedContact = {
  emails: [],
  phones: [],
  sourceUrls: [],
  socials: {},
};

const SCRIPT_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "find_emails.py"
);

const PYTHON_BIN =
  process.env.PYTHON_BIN ||
  (process.platform === "win32" ? "python" : "python3");

// puppeteer-core ships no browser — it must be told where Chromium is. The
// Dockerfile installs the system chromium and sets CHROMIUM_PATH.
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || "/usr/bin/chromium";

const BROWSER_CONCURRENCY = Number(process.env.BROWSER_CONCURRENCY) || 3;
const NAV_TIMEOUT_MS = 15_000;
const RENDER_SETTLE_MS = 1_500;
const EXTRACT_TIMEOUT_MS = 10_000;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// ---- shared browser singleton -------------------------------------------
let browserPromise: Promise<Browser> | null = null;
let browserDisabled = false;
let disableReason = "";

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = puppeteer
      .launch({
        executablePath: CHROMIUM_PATH,
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage", // use /tmp not /dev/shm (small in Docker)
          "--disable-gpu",
          "--no-zygote",
          "--disable-extensions",
          "--disable-background-networking",
          "--mute-audio",
        ],
      })
      .catch((err) => {
        browserPromise = null;
        throw err;
      });
  }
  return browserPromise;
}

// ---- concurrency semaphore ----------------------------------------------
let active = 0;
const waiters: Array<() => void> = [];

function acquire(): Promise<void> {
  if (active < BROWSER_CONCURRENCY) {
    active += 1;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => waiters.push(resolve));
}

function release(): void {
  const next = waiters.shift();
  if (next) next(); // hand the slot straight to the next waiter
  else active -= 1;
}

// ---- helpers -------------------------------------------------------------
const SOCIAL_KEYS = ["facebook", "instagram", "twitter", "linkedin"] as const;

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

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

// Hand the rendered DOM HTML to find_emails.py --html for extraction, reusing
// every filter/dedup/social rule the HTTP path already implements.
function extractWithPython(
  html: string,
  baseUrl: string,
  maxItems: number
): Promise<EnrichedContact> {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(
        PYTHON_BIN,
        [SCRIPT_PATH, "--html", baseUrl, String(maxItems)],
        { stdio: ["pipe", "pipe", "ignore"] }
      );
    } catch {
      resolve(EMPTY);
      return;
    }
    let out = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), EXTRACT_TIMEOUT_MS);
    child.stdout?.on("data", (c) => (out += c.toString()));
    child.on("error", () => {
      clearTimeout(timer);
      resolve(EMPTY);
    });
    child.on("close", () => {
      clearTimeout(timer);
      try {
        const p = JSON.parse(out) as Record<string, unknown>;
        resolve({
          emails: toStringArray(p.emails).slice(0, maxItems),
          phones: toStringArray(p.phones).slice(0, maxItems),
          sourceUrls: toStringArray(p.sourceUrls),
          socials: toSocials(p.socials),
        });
      } catch {
        resolve(EMPTY);
      }
    });
    child.stdin?.on("error", () => {});
    child.stdin?.end(html);
  });
}

// ---- public API ----------------------------------------------------------

// Render `url` in headless Chromium (running its JS), then extract contacts
// from the resulting DOM. Returns empty on any failure — never throws into the
// harvest loop. No-ops instantly if the browser layer is disabled.
export async function browserScrape(
  url: string,
  maxItems = 4
): Promise<EnrichedContact> {
  if (browserDisabled || !url) return EMPTY;

  let browser: Browser;
  try {
    browser = await getBrowser();
  } catch (err) {
    browserDisabled = true;
    disableReason = err instanceof Error ? err.message : "launch failed";
    console.error(
      `[browser-scrape] Chromium launch failed — disabling Layer 2. ${disableReason}`
    );
    return EMPTY;
  }

  await acquire();
  let page;
  try {
    page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.setViewport({ width: 1280, height: 900 });
    // Skip images/media/fonts: faster renders, less memory; we only need text.
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const t = req.resourceType();
      if (t === "image" || t === "media" || t === "font") {
        req.abort().catch(() => {});
      } else {
        req.continue().catch(() => {});
      }
    });
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: NAV_TIMEOUT_MS,
    });
    await new Promise((r) => setTimeout(r, RENDER_SETTLE_MS));
    const html = await page.content();
    return await extractWithPython(html, url, maxItems);
  } catch {
    return EMPTY; // per-site failure (nav timeout, etc.) — don't disable layer
  } finally {
    if (page) await page.close().catch(() => {});
    release();
  }
}

export type BrowserStatus = {
  ok: boolean;
  executablePath: string;
  concurrency: number;
  disabled: boolean;
  version?: string;
  error?: string;
};

// Used by /health: try to launch (or reuse) the browser so a single curl shows
// whether Layer 2 is actually operational in this container.
export async function browserStatus(): Promise<BrowserStatus> {
  const base = {
    executablePath: CHROMIUM_PATH,
    concurrency: BROWSER_CONCURRENCY,
    disabled: browserDisabled,
  };
  if (browserDisabled) {
    return { ok: false, ...base, error: disableReason };
  }
  try {
    const b = await getBrowser();
    const version = await b.version();
    return { ok: true, ...base, version };
  } catch (err) {
    browserDisabled = true;
    disableReason = err instanceof Error ? err.message : "launch failed";
    return { ok: false, ...base, disabled: true, error: disableReason };
  }
}
