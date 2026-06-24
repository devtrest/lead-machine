#!/usr/bin/env python3
"""Website email + phone harvester.

This is the ONLY email-finding mechanism in Lead Machine. There is NO
third-party API fallback (Apollo and friends were removed) — everything we
report came directly out of the HTML source of one of the pages below.

The Node worker (worker/src/enrichment.ts) and the dev-mode mirror
(src/lib/lead-enrichment.ts) both invoke this script as a subprocess, one
call per lead:

    python3 find_emails.py <website_url> [max_items]

It prints a single JSON object to stdout:

    {"emails": [...], "phones": [...], "sourceUrls": [...]}

Pipeline: for the lead's website we try a small ordered list of pages,
inspect the raw HTML of each, and stop at the first page that yields a real
email. If ALL pages fail, the lead saves with no email — we DO NOT guess
(no info@domain.com fallback, no DNS lookups, no AI).

Order:
  1. Homepage (also covers the footer — most small-business sites publish
     their email in the footer, visible on every page)
  2. /contact-us  (English contact page)
  3. /contact     (alternate)
  4. /about-us    (often has the team / corporate email)
  5. /about
  6. /terms-and-conditions (legally required to display an email in many
     jurisdictions for e-commerce / financial sites)
  7. /terms

Standard library only — no pip dependencies — so the Docker image just needs
`python3`, no `pip install`.
"""

import json
import re
import sys
import time
from urllib.parse import unquote, urljoin, urlsplit
from urllib.request import Request, urlopen

EMAIL_RE = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
PHONE_RE = re.compile(
    r"(?:\+\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)\d{3,4}[\s-]?\d{3,4}"
)

# Spam / placeholder / asset-file patterns we reject from the extractor
# output. Sites pollute their HTML with example@example.com,
# font.woff@1x.woff URL hashes that look like emails, sentry / wix dummies.
SPAM_EMAIL_PATTERNS = [
    re.compile(p, re.IGNORECASE)
    for p in (
        r"^example@",
        r"^test@",
        r"^name@",
        r"^you@",
        r"^email@",
        r"^user@",
        r"^domain@",
        r"^your@",
        r"^firstname",
        r"^lastname",
        r"^john\.?doe@",
        r"^jane\.?doe@",
        r"@example\.(com|net|org)$",
        r"@domain\.com$",
        r"@email\.com$",
        r"@yourdomain\.",
        r"@sentry\.io$",
        r"@wixpress\.com$",
        r"@cloudfront\.net$",
        r"@(2x|3x|x2|x3)\.",
        r"\.(png|jpe?g|gif|webp|svg|css|js|woff2?|ttf|ico)$",
    )
]

PATHS_TO_TRY = [
    "",  # homepage (includes footer)
    "/contact-us",
    "/contact",
    "/about-us",
    "/about",
    "/terms-and-conditions",
    "/terms",
]

FETCH_TIMEOUT_S = 5.0
# Overall wall-clock budget across the whole page walk. The Node side abandons
# the call after its own per-lead deadline; we cap ourselves here so an
# orphaned subprocess can't hang around chewing through all 7 paths on a slow
# site. Once we're out of time we stop starting new fetches.
GLOBAL_BUDGET_S = 16.0

# Maximum bytes of HTML body we'll inspect per page. Some Shopify /
# Squarespace pages serve 2-5 MB of inline JSON, CSS, and tracker scripts;
# running regex over that is wasteful. We keep a HEAD slice (where the meta +
# nav usually live) AND a TAIL slice (where the footer always lives).
MAX_HTML_BYTES = 250_000
HEAD_SLICE_RATIO = 0.55

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)


def unique(values):
    """De-dupe while preserving insertion order (matches JS Set semantics)."""
    return list(dict.fromkeys(values))


def is_likely_real_email(email):
    e = email.lower()
    if len(e) > 100 or len(e) < 6:
        return False
    if "@" not in e:
        return False
    local, _, domain = e.partition("@")
    if not local or not domain:
        return False
    if "." not in domain:
        return False
    for p in SPAM_EMAIL_PATTERNS:
        if p.search(e):
            return False
    return True


def decode_html_entities(s):
    """Decode the HTML entities that commonly hide @ and . in email addresses
    so the regex can still match them (info&#64;example.com etc.)."""
    replacements = [
        (re.compile(r"&commat;", re.IGNORECASE), "@"),
        (re.compile(r"&#0*64;"), "@"),
        (re.compile(r"&#x0*40;", re.IGNORECASE), "@"),
        (re.compile(r"&period;", re.IGNORECASE), "."),
        (re.compile(r"&#0*46;"), "."),
        (re.compile(r"&#x0*2e;", re.IGNORECASE), "."),
        (re.compile(r"&nbsp;", re.IGNORECASE), " "),
        (re.compile(r"&amp;", re.IGNORECASE), "&"),
        (re.compile(r"&lowbar;", re.IGNORECASE), "_"),
        (re.compile(r"&#0*45;"), "-"),
        (re.compile(r"&hyphen;", re.IGNORECASE), "-"),
    ]
    for pattern, repl in replacements:
        s = pattern.sub(repl, s)
    return s


_SCRIPT_RE = re.compile(r"<script[\s\S]*?</script>", re.IGNORECASE)
_STYLE_RE = re.compile(r"<style[\s\S]*?</style>", re.IGNORECASE)
_NOSCRIPT_RE = re.compile(r"<noscript[\s\S]*?</noscript>", re.IGNORECASE)
_COMMENT_RE = re.compile(r"<!--[\s\S]*?-->")
_TAG_RE = re.compile(r"<[^>]+>")


def strip_markup(html):
    html = _SCRIPT_RE.sub(" ", html)
    html = _STYLE_RE.sub(" ", html)
    html = _NOSCRIPT_RE.sub(" ", html)
    html = _COMMENT_RE.sub(" ", html)
    html = _TAG_RE.sub(" ", html)
    return html


def slice_html(raw):
    """Trim a long HTML body to ~250 KB, keeping BOTH the head section (meta,
    nav) AND the tail (footer + closing scripts). Footer-only emails would be
    cut off by a naive raw[:MAX_HTML_BYTES]."""
    if len(raw) <= MAX_HTML_BYTES:
        return raw
    head_bytes = int(MAX_HTML_BYTES * HEAD_SLICE_RATIO)
    tail_bytes = MAX_HTML_BYTES - head_bytes
    return raw[:head_bytes] + "\n" + raw[-tail_bytes:]


_BOT_PATTERNS = [
    re.compile(r"Just a moment\.\.\.", re.IGNORECASE),
    re.compile(r"challenges\.cloudflare\.com", re.IGNORECASE),
    re.compile(r"cf-challenge-running", re.IGNORECASE),
    re.compile(r"_Incapsula_Resource", re.IGNORECASE),
    re.compile(r"datadome-captcha", re.IGNORECASE),
    re.compile(r"perimeterx", re.IGNORECASE),
    re.compile(r"Akamai\s+Bot\s+Manager", re.IGNORECASE),
    re.compile(r"Checking your browser before accessing", re.IGNORECASE),
]


def is_bot_protection_challenge(html):
    """Cloudflare "Just a moment..." and friends. Detect early so we don't
    waste budget on a JS challenge shell — plain fetch can't bypass it."""
    if len(html) > 50_000:
        return False
    return any(p.search(html) for p in _BOT_PATTERNS)


_MAILTO_RE = re.compile(r"""href\s*=\s*["']mailto:([^"'?#]+)""", re.IGNORECASE)
_TEL_RE = re.compile(r"""href\s*=\s*["']tel:([^"']+)""", re.IGNORECASE)


def extract_from_hrefs(html):
    """mailto: hrefs are the strongest possible signal — the site OWNER put
    the link there explicitly. tel: links give us phones too."""
    emails = [unquote(m).strip() for m in _MAILTO_RE.findall(html)]
    phones = [unquote(m).strip() for m in _TEL_RE.findall(html)]
    return emails, phones


def extract_from_text(html):
    """Strip tags + run the email/phone regex over the plain text. Catches
    emails sitting in footers, contact-page paragraphs, terms blocks."""
    text = strip_markup(html)
    emails = [e.lower() for e in EMAIL_RE.findall(text)]
    phones = []
    for raw in PHONE_RE.findall(text):
        cleaned = re.sub(r"[^\d+]", "", raw)
        if 8 <= len(cleaned) <= 16:
            phones.append(cleaned)
    return emails, phones


def inspect_page(html):
    """Inspect ONE page's HTML — return (emails, phones) found there, or None
    if the page is a bot-protection challenge."""
    if is_bot_protection_challenge(html):
        return None
    href_emails, href_phones = extract_from_hrefs(html)
    text_emails, text_phones = extract_from_text(html)
    emails = [
        e
        for e in unique([x.lower() for x in href_emails] + text_emails)
        if is_likely_real_email(e)
    ]
    phones = unique(href_phones + text_phones)
    return emails, phones


def fetch_html(url, referer_origin):
    try:
        req = Request(
            url,
            headers={
                "User-Agent": USER_AGENT,
                "Accept": "text/html,application/xhtml+xml,application/xml;"
                "q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
                "Referer": referer_origin + "/",
            },
        )
        with urlopen(req, timeout=FETCH_TIMEOUT_S) as res:
            if getattr(res, "status", 200) and res.status >= 400:
                return None
            raw_bytes = res.read(MAX_HTML_BYTES * 2)
        raw = raw_bytes.decode("utf-8", errors="ignore")
        return decode_html_entities(slice_html(raw))
    except Exception:
        return None


def enrich_from_website(website_url, max_items=4):
    parts = urlsplit(website_url)
    if not parts.scheme or not parts.netloc:
        return {"emails": [], "phones": [], "sourceUrls": []}

    origin = f"{parts.scheme}://{parts.netloc}"
    base = origin + "/"
    deadline = time.monotonic() + GLOBAL_BUDGET_S
    all_phones = []
    source_urls = []

    for path in PATHS_TO_TRY:
        if time.monotonic() > deadline:
            break
        try:
            target = urljoin(base, path or "/")
        except Exception:
            continue

        html = fetch_html(target, origin)
        if not html:
            continue

        result = inspect_page(html)
        if result is None:
            continue  # bot-protection challenge, move on
        emails, phones = result

        if phones:
            all_phones.extend(phones)

        if emails:
            # FOUND. Return the first real email + every phone collected along
            # the way. We do NOT keep crawling once an email is in hand.
            return {
                "emails": emails[:max_items],
                "phones": unique(all_phones)[:max_items],
                "sourceUrls": [target],
            }

        source_urls.append(target)

    # No email found anywhere — return whatever phones we picked up. NO
    # GUESSING. The lead saves with phone-only contact info.
    return {
        "emails": [],
        "phones": unique(all_phones)[:max_items],
        "sourceUrls": unique(source_urls),
    }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"emails": [], "phones": [], "sourceUrls": []}))
        return
    website_url = sys.argv[1]
    try:
        max_items = int(sys.argv[2]) if len(sys.argv) > 2 else 4
    except ValueError:
        max_items = 4

    try:
        result = enrich_from_website(website_url, max_items)
    except Exception:
        result = {"emails": [], "phones": [], "sourceUrls": []}
    print(json.dumps(result))


if __name__ == "__main__":
    main()
