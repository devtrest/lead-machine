import puppeteer, { Browser, Page } from "puppeteer";

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
  | { phase: "enriching"; count: number; target: number }
  | { phase: "complete"; count: number };

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const DETAIL_CONCURRENCY = Math.max(
  2,
  Math.min(10, Number(process.env.PUPPETEER_DETAIL_CONCURRENCY) || 4)
);

function resolveHeadless(): boolean {
  const v = process.env.PUPPETEER_HEADLESS?.trim().toLowerCase();
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return process.env.NODE_ENV === "production";
}

function launchOptions(headless: boolean): Parameters<typeof puppeteer.launch>[0] {
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
  const args = headless
    ? [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--window-size=1400,900",
      ]
    : ["--window-size=1400,900"];
  return {
    headless,
    executablePath: executablePath || undefined,
    args,
    defaultViewport: headless ? { width: 1400, height: 900 } : null,
  };
}

async function blockHeavyResources(page: Page) {
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const type = req.resourceType();
    if (
      type === "image" ||
      type === "font" ||
      type === "media" ||
      type === "stylesheet"
    ) {
      req.abort().catch(() => undefined);
    } else {
      req.continue().catch(() => undefined);
    }
  });
}

async function preparePage(page: Page) {
  await blockHeavyResources(page);
  await page.setUserAgent(USER_AGENT);
  await page.setViewport({ width: 1400, height: 900 });
}

async function dismissConsent(page: Page) {
  try {
    const consent = await page.$('button[aria-label*="Accept"]');
    if (consent) await consent.click({ delay: 30 });
  } catch {
    /* no consent UI */
  }
}

/**
 * Feed scrape: title + rating + reviews + placeUrl only. Category and address
 * come from the detail page where they are structured cleanly. Trying to parse
 * them out of the feed's blob text produces garbage.
 */
async function scrapeFeed(
  page: Page,
  target: number,
  onProgress?: (e: ProgressEvent) => void
): Promise<MapsPlace[]> {
  await page.waitForSelector('div[role="feed"]', { timeout: 30_000 });

  // Aggressively scroll until we hit the target OR Google's "You've reached
  // the end of the list" marker appears OR scrolling stops yielding new
  // items for many iterations in a row.
  let lastCount = 0;
  let stable = 0;
  for (let i = 0; i < 200; i++) {
    const { count, atEnd } = (await page.evaluate(() => {
      const feed = document.querySelector('div[role="feed"]');
      if (!feed) return { count: 0, atEnd: false };
      const articles = feed.querySelectorAll('div[role="article"]').length;
      // Google appends this exact string when the list is exhausted.
      const tail = feed.textContent ?? "";
      const atEnd = /reached the end of the list/i.test(tail);
      return { count: articles, atEnd };
    })) as { count: number; atEnd: boolean };

    onProgress?.({ phase: "discovering", count, target });

    if (count >= target) break;
    if (atEnd) break;
    if (count === lastCount) {
      stable += 1;
      // 12 consecutive stable iterations ≈ 2.4s of "nothing new" — feed is
      // exhausted even without the marker.
      if (stable >= 12) break;
    } else {
      stable = 0;
    }
    lastCount = count;

    await page.evaluate(() => {
      const el = document.querySelector('div[role="feed"]');
      if (el) el.scrollBy(0, 2800);
    });
    await new Promise((r) => setTimeout(r, 200));
  }

  const raw: MapsPlace[] = await page.evaluate((max: number) => {
    const feed = document.querySelector('div[role="feed"]');
    if (!feed) return [];
    const articles = Array.from(
      feed.querySelectorAll('div[role="article"]')
    ).slice(0, max);

    const out: MapsPlace[] = [];
    for (const article of articles) {
      const link = article.querySelector(
        'a[href*="/maps/place"]'
      ) as HTMLAnchorElement | null;

      const titleHeadline =
        article.querySelector(".fontHeadlineSmall")?.textContent?.trim() ||
        article
          .querySelector('[class*="fontHeadlineSmall"]')
          ?.textContent?.trim();
      const titleAria = link?.getAttribute("aria-label")?.trim();
      const title =
        titleHeadline || titleAria?.split(/[,·]/)[0]?.trim() || "";
      if (!title || title.length < 2) continue;

      let rating: string | undefined;
      let reviews: string | undefined;
      const ratingNode = article.querySelector('[role="img"][aria-label*="star"]');
      const ariaR = ratingNode?.getAttribute("aria-label") ?? "";
      const ratingMatch = ariaR.match(/([\d.,]+)\s*star/i);
      if (ratingMatch) rating = ratingMatch[1].replace(",", ".");
      const reviewsMatch = ariaR.match(/([\d,]+)\s*review/i);
      if (reviewsMatch) reviews = reviewsMatch[1].replace(/,/g, "");

      out.push({
        title,
        rating,
        reviews,
        placeUrl: link?.href,
      });
    }
    return out;
  }, target);

  const seen = new Set<string>();
  const deduped: MapsPlace[] = [];
  for (const row of raw) {
    const key = `${row.title.toLowerCase()}|${row.placeUrl ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }
  return deduped.slice(0, target);
}

/**
 * Detail page scrape: pulls category/address/website/phone from Google Maps'
 * structured side-panel buttons. Waits for the panel to actually render (lazy)
 * before evaluating selectors — without that, websites/phones are missed.
 */
async function scrapePlaceDetail(
  page: Page,
  placeUrl: string
): Promise<Pick<MapsPlace, "websiteUrl" | "phone" | "address" | "category">> {
  // Force English UI so our text selectors match.
  let urlWithLocale = placeUrl;
  try {
    const u = new URL(placeUrl);
    u.searchParams.set("hl", "en");
    urlWithLocale = u.toString();
  } catch {
    /* keep original */
  }

  await page.goto(urlWithLocale, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });

  // Wait for the side panel to start rendering: title + any one info button.
  // Google Maps lazy-loads website/phone/address — they appear in different
  // orders across page loads.
  await page
    .waitForFunction(
      () => {
        if (!document.querySelector("h1")) return false;
        return (
          !!document.querySelector('a[data-item-id="authority"]') ||
          !!document.querySelector('a[data-item-id^="authority"]') ||
          !!document.querySelector('button[data-item-id^="phone:tel:"]') ||
          !!document.querySelector('button[data-item-id^="phone"]') ||
          !!document.querySelector('button[data-item-id="address"]') ||
          !!document.querySelector('button[aria-label^="Address:"]')
        );
      },
      { timeout: 12_000 }
    )
    .catch(() => undefined);

  // The website link often renders 500-1500ms AFTER address/phone. Wait
  // explicitly for it so we don't return prematurely. Best-effort: if the
  // place legitimately has no website, we move on after the timeout.
  await page
    .waitForSelector(
      'a[data-item-id="authority"], a[data-item-id^="authority"]',
      { timeout: 4000 }
    )
    .catch(() => undefined);

  // Final grace period for any in-flight rendering.
  await new Promise((r) => setTimeout(r, 500));

  return page.evaluate(() => {
    // Website — try multiple selector variants Google has shipped over time.
    const websiteEl = (document.querySelector('a[data-item-id="authority"]') ||
      document.querySelector('a[data-item-id^="authority"]') ||
      document.querySelector(
        'a.CsEnBe[href^="http"]:not([href*="google.com"])'
      )) as HTMLAnchorElement | null;
    const websiteUrl =
      websiteEl?.href && !websiteEl.href.includes("google.com/maps")
        ? websiteEl.href
        : undefined;

    // Phone — data-item-id="phone:tel:+92..." gives us the number directly.
    const phoneBtn = (document.querySelector(
      'button[data-item-id^="phone:tel:"]'
    ) ||
      document.querySelector('button[data-item-id^="phone"]') ||
      document.querySelector(
        'button[aria-label^="Phone:"]'
      )) as HTMLElement | null;
    const phoneFromAttr =
      phoneBtn
        ?.getAttribute("data-item-id")
        ?.replace(/^phone:tel:/, "")
        .trim() || undefined;
    const phoneFromAria =
      phoneBtn
        ?.getAttribute("aria-label")
        ?.replace(/^Phone:\s*/i, "")
        .trim() || undefined;
    const phone = phoneFromAttr || phoneFromAria;

    // Address — button[data-item-id="address"] wraps the full street address.
    const addressBtn = (document.querySelector(
      'button[data-item-id="address"]'
    ) ||
      document.querySelector(
        'button[aria-label^="Address:"]'
      )) as HTMLElement | null;
    const addressFromAria = addressBtn
      ?.getAttribute("aria-label")
      ?.replace(/^Address:\s*/i, "")
      .trim();
    const addressFromText = addressBtn?.textContent?.trim();
    const address = addressFromAria || addressFromText || undefined;

    // Category — typically the button next to the title with class DkEaL,
    // or an anchor next to the rating line.
    const categoryEl = (document.querySelector("button.DkEaL") ||
      document.querySelector('button[jsaction*="category"]') ||
      document.querySelector(
        'div[jsaction] button[role="button"][aria-label]:not([data-item-id])'
      )) as HTMLElement | null;
    const category = categoryEl?.textContent?.trim() || undefined;

    return { websiteUrl, phone, address, category };
  });
}

async function enrichInParallel(
  browser: Browser,
  places: MapsPlace[],
  onProgress?: (e: ProgressEvent) => void
): Promise<MapsPlace[]> {
  const result = [...places];
  const concurrency = Math.min(DETAIL_CONCURRENCY, places.length);
  if (concurrency === 0) return result;

  const workers = await Promise.all(
    Array.from({ length: concurrency }).map(() => browser.newPage())
  );
  await Promise.all(workers.map((p) => preparePage(p)));

  let cursor = 0;
  let done = 0;

  await Promise.all(
    workers.map(async (worker) => {
      while (true) {
        const idx = cursor++;
        if (idx >= places.length) break;
        const place = places[idx];
        if (place.placeUrl) {
          try {
            const detail = await scrapePlaceDetail(worker, place.placeUrl);
            result[idx] = {
              ...place,
              websiteUrl: detail.websiteUrl ?? place.websiteUrl,
              phone: detail.phone ?? place.phone,
              address: detail.address ?? place.address,
              category: detail.category ?? place.category,
            };
          } catch {
            /* keep original feed data */
          }
        }
        done += 1;
        onProgress?.({ phase: "enriching", count: done, target: places.length });
      }
      await worker.close().catch(() => undefined);
    })
  );

  return result;
}

export async function scrapeGoogleMaps(opts: {
  keyword: string;
  location: string;
  maxResults: number;
  onProgress?: (event: ProgressEvent) => void;
}): Promise<MapsPlace[]> {
  const query = `${opts.keyword} ${opts.location}`.trim();
  const onProgress = opts.onProgress;

  onProgress?.({ phase: "launching" });
  const headless = resolveHeadless();
  const browser = await puppeteer.launch(launchOptions(headless));

  try {
    const page = await browser.newPage();
    await preparePage(page);

    onProgress?.({ phase: "searching", query });
    const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}/?hl=en`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await dismissConsent(page);

    const feedResults = await scrapeFeed(page, opts.maxResults, onProgress);
    onProgress?.({
      phase: "extracting",
      count: feedResults.length,
      target: opts.maxResults,
    });

    await page.close().catch(() => undefined);

    const enriched = await enrichInParallel(browser, feedResults, onProgress);

    onProgress?.({ phase: "complete", count: enriched.length });
    return enriched;
  } finally {
    await browser.close().catch(() => undefined);
  }
}
