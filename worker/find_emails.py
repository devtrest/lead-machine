#!/usr/bin/env python3
"""Website email + phone + social harvester.

This is the ONLY email-finding mechanism in Lead Machine. There is NO
third-party API and NO headless browser (Apollo and Playwright/Facebook were
deliberately left out of the automated worker) — everything we report came
directly out of the HTML source of one of the lead's own pages.

The Node worker (worker/src/enrichment.ts) and the dev-mode mirror
(src/lib/lead-enrichment.ts) invoke this script as a subprocess, one call per
lead:

    python3 find_emails.py <website_url> [max_items]

It prints a single JSON object to stdout:

    {"emails": [...], "phones": [...], "sourceUrls": [...],
     "socials": {"facebook": "...", "instagram": "...",
                 "twitter": "...", "linkedin": "..."}}

Pipeline:
  1. Fetch the homepage. Pull social profile links + any emails/phones.
  2. If no email yet, DISCOVER the best contact-ish internal pages by scoring
     the homepage's own links (contact / about / team / impressum / ...), then
     fall back to a fixed list of common paths. Crawl them in order, stopping
     at the first page that yields a real email.
  3. Prefer emails on the site's own domain over generic third-party ones.

If nothing surfaces, the lead saves with no email — we DO NOT guess (no
info@domain.com fallback, no DNS lookups, no AI).

Standard library only — no pip dependencies — so the Docker image just needs
`python3`, no `pip install`.
"""

import html as html_lib
import json
import re
import ssl
import sys
import time
from urllib.error import URLError
from urllib.parse import unquote, urljoin, urlsplit
from urllib.request import Request, urlopen

# Verify TLS normally. But fall back to an UNVERIFIED context when the cert
# can't be checked — covers (a) minimal containers with no CA store and
# (b) the many small-business sites with expired/self-signed certs. We only
# ever READ public marketing HTML here (no secrets sent), so skipping
# verification to reach a lead's contact page is an acceptable trade.
_UNVERIFIED_CTX = ssl.create_default_context()
_UNVERIFIED_CTX.check_hostname = False
_UNVERIFIED_CTX.verify_mode = ssl.CERT_NONE


def _is_ssl_error(exc):
    if isinstance(exc, ssl.SSLError):
        return True
    return isinstance(exc, URLError) and isinstance(
        getattr(exc, "reason", None), ssl.SSLError
    )

EMAIL_RE = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
PHONE_RE = re.compile(
    r"(?:\+\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)\d{3,4}[\s-]?\d{3,4}"
)

# Spam / placeholder / asset-file patterns we reject. Sites pollute their HTML
# with example@example.com, font.woff@1x hashes that look like emails, sentry /
# wix dummies, and (now that we read socials) facebook/meta CDN addresses.
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
        r"@(facebook|fb|fbcdn|meta)\.",
        r"\.fbcdn\.",
        r"\.(png|jpe?g|gif|webp|svg|css|js|woff2?|ttf|ico)$",
    )
]

# Internal-link words that flag a page likely to carry a contact email. Higher
# score = crawled sooner. Mix of EN + common DE/ES/FR so we catch /kontakt,
# /impressum, /contacto, /nous-contacter, etc.
CONTACT_HINTS = (
    "contact",
    "kontakt",
    "contacto",
    "contatti",
    "about",
    "team",
    "support",
    "impressum",
    "company",
    "info",
    "reach",
    "connect",
    "get-in-touch",
    "legal",
    "imprint",
)

# Fixed fallback paths tried after (and in addition to) discovered links, for
# sites that don't link their contact page prominently from the homepage.
FALLBACK_PATHS = (
    "/contact-us",
    "/contact",
    "/about-us",
    "/about",
    "/terms-and-conditions",
    "/terms",
)

# Social profile destinations. We capture the URL only — no scraping of the
# platform itself (FB/IG block datacenter IPs and need a login).
SOCIAL_DOMAINS = {
    "facebook": ("facebook.com", "fb.com", "fb.me"),
    "instagram": ("instagram.com",),
    "twitter": ("twitter.com", "x.com"),
    "linkedin": ("linkedin.com",),
}
# Share / intent widgets are not the business's own profile — skip them.
SOCIAL_SKIP = ("/sharer", "/share", "intent/", "/dialog", "plugins/")

FETCH_TIMEOUT_S = 5.0
# Overall wall-clock budget across the whole page walk. The Node side abandons
# the call after its own per-lead deadline; we cap ourselves here so an
# orphaned subprocess can't hang chewing through every candidate on a slow
# site. Once we're out of time we stop starting new fetches.
GLOBAL_BUDGET_S = 16.0
# Max internal pages crawled (beyond the homepage) looking for an email.
MAX_INTERNAL_PAGES = 6

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


def deobfuscate(s):
    """Undo the tricks sites use to hide emails from naive scrapers.

    html.unescape covers numeric/named entities (&#64; -> @, &commat; -> @,
    &period; -> ., &amp; -> & ...). On top of that we:
      - undo JSON unicode/slash escaping (\\u0040 -> @, \\/ -> /)
      - turn the UNAMBIGUOUS bracketed forms into @ and . :
        "name [at] domain [dot] com" / "(at)" / "{dot}".

    We deliberately do NOT touch the bare-word " at " / " dot " forms — those
    fire on ordinary prose ("meet us at example.com") and manufacture fake
    addresses. Bracketed forms are safe because real text rarely contains them.
    """
    s = html_lib.unescape(s)
    s = s.replace("\\u0040", "@").replace("\\u0026", "&").replace("\\/", "/")
    s = re.sub(r"\s*[\[({]\s*at\s*[\])}]\s*", "@", s, flags=re.IGNORECASE)
    s = re.sub(r"\s*[\[({]\s*dot\s*[\])}]\s*", ".", s, flags=re.IGNORECASE)
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
_HREF_RE = re.compile(r"""<a\b[^>]*?\bhref\s*=\s*["']([^"'#]+)""", re.IGNORECASE)


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


def prefer_own_domain(emails, host):
    """Re-order so emails on the site's own domain come first, dropping nothing.
    A boutique that lists both hi@brand.com and its agency's hello@webfirm.com
    should surface the brand's address first."""
    if not emails or not host:
        return emails
    root = host.replace("www.", "").split(":")[0].lower()
    base = root.split(".")[0]
    own, other = [], []
    for e in emails:
        dom = e.split("@")[-1].lower()
        (own if (root in dom or (base and base in dom)) else other).append(e)
    return own + other


def extract_socials(html, base_url):
    """Pull the business's own social profile URLs from anchor hrefs."""
    out = {}
    for href in _HREF_RE.findall(html):
        low = href.lower()
        if any(skip in low for skip in SOCIAL_SKIP):
            continue
        for platform, domains in SOCIAL_DOMAINS.items():
            if platform in out:
                continue
            if any(d in low for d in domains):
                try:
                    out[platform] = urljoin(base_url, href.strip())
                except Exception:
                    out[platform] = href.strip()
    return out


def discover_contact_links(html, base_url, base_host):
    """Score the homepage's internal links by CONTACT_HINTS and return the most
    promising ones (highest score first), same-domain only."""
    root = base_host.replace("www.", "").lower()
    scored = []
    seen = set()
    for href in _HREF_RE.findall(html):
        try:
            target = urljoin(base_url, href.strip())
        except Exception:
            continue
        target = target.split("#")[0]
        if target in seen:
            continue
        seen.add(target)
        parts = urlsplit(target)
        if parts.scheme not in ("http", "https"):
            continue
        if parts.netloc.replace("www.", "").lower() != root:
            continue
        low = target.lower()
        score = sum(1 for h in CONTACT_HINTS if h in low)
        if score:
            scored.append((score, target))
    scored.sort(key=lambda t: t[0], reverse=True)
    return [u for _, u in scored]


def fetch_html(url, referer_origin):
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
    # First attempt verifies TLS; on a cert failure, retry once unverified.
    for attempt, ctx in enumerate((None, _UNVERIFIED_CTX)):
        try:
            with urlopen(req, timeout=FETCH_TIMEOUT_S, context=ctx) as res:
                if getattr(res, "status", 200) and res.status >= 400:
                    return None
                raw_bytes = res.read(MAX_HTML_BYTES * 2)
            raw = raw_bytes.decode("utf-8", errors="ignore")
            return deobfuscate(slice_html(raw))
        except Exception as exc:
            if attempt == 0 and _is_ssl_error(exc):
                continue  # retry with the unverified context
            return None
    return None


def enrich_from_website(website_url, max_items=4):
    parts = urlsplit(website_url)
    if not parts.scheme or not parts.netloc:
        return {"emails": [], "phones": [], "sourceUrls": [], "socials": {}}

    host = parts.netloc
    origin = f"{parts.scheme}://{host}"
    base = origin + "/"
    deadline = time.monotonic() + GLOBAL_BUDGET_S
    all_phones = []
    source_urls = []
    socials = {}

    def finalize(emails, src):
        return {
            "emails": prefer_own_domain(emails, host)[:max_items],
            "phones": unique(all_phones)[:max_items],
            "sourceUrls": src,
            "socials": socials,
        }

    # --- Homepage first: it carries socials + (usually) the footer email. ---
    home_html = fetch_html(base, origin)
    if home_html:
        socials = extract_socials(home_html, base)
        result = inspect_page(home_html)
        if result is not None:
            emails, phones = result
            if phones:
                all_phones.extend(phones)
            if emails:
                return finalize(emails, [base])
            source_urls.append(base)

    # --- No email on the homepage: build a crawl list. Discovered contact-ish
    #     links first (scored), then the fixed fallback paths. ---
    candidates = []
    if home_html:
        candidates.extend(discover_contact_links(home_html, base, host))
    for path in FALLBACK_PATHS:
        try:
            candidates.append(urljoin(base, path))
        except Exception:
            pass

    crawled = {base}
    pages_done = 0
    for target in unique(candidates):
        if pages_done >= MAX_INTERNAL_PAGES or time.monotonic() > deadline:
            break
        if target in crawled:
            continue
        crawled.add(target)

        html = fetch_html(target, origin)
        if not html:
            continue
        pages_done += 1

        if not socials:
            socials = extract_socials(html, base)

        result = inspect_page(html)
        if result is None:
            continue  # bot-protection challenge, move on
        emails, phones = result
        if phones:
            all_phones.extend(phones)
        if emails:
            return finalize(emails, [target])
        source_urls.append(target)

    # No email found anywhere — return phones + socials we picked up. NO
    # GUESSING. The lead saves with phone/social-only contact info.
    return {
        "emails": [],
        "phones": unique(all_phones)[:max_items],
        "sourceUrls": unique(source_urls),
        "socials": socials,
    }


def main():
    empty = {"emails": [], "phones": [], "sourceUrls": [], "socials": {}}
    if len(sys.argv) < 2:
        print(json.dumps(empty))
        return
    website_url = sys.argv[1]
    try:
        max_items = int(sys.argv[2]) if len(sys.argv) > 2 else 4
    except ValueError:
        max_items = 4

    try:
        result = enrich_from_website(website_url, max_items)
    except Exception:
        result = empty
    print(json.dumps(result))


if __name__ == "__main__":
    main()
