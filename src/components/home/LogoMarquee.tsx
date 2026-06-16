// Animated logo slider. The track holds two identical copies of the brand
// set; the `marquee` keyframe (globals.css) shifts it -50% for a seamless,
// infinite loop. Logos reflect what the product actually touches: it scrapes
// from Google / Google Maps and sends outreach through the mailboxes users
// connect (Gmail, Outlook, Yahoo, Zoho, Titan, or custom SMTP/IMAP).

const brands = [
  "Google",
  "Google Maps",
  "Gmail",
  "Outlook",
  "Microsoft 365",
  "Yahoo Mail",
  "Zoho Mail",
  "Titan",
  "SMTP / IMAP",
];

export function LogoMarquee() {
  return (
    <section className="relative border-y border-[var(--border)] bg-[var(--surface-elev)]/60 py-9">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-subtle)]">
          Scrapes the open web · sends through the mailboxes you already use
        </p>
      </div>

      <div className="relative mt-7 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)] [-webkit-mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
        <div className="flex w-max animate-marquee items-center">
          {[...brands, ...brands].map((b, i) => (
            <span
              key={i}
              aria-hidden={i >= brands.length}
              className="shrink-0 whitespace-nowrap px-8 text-2xl font-bold tracking-tight text-[var(--ink-subtle)] transition hover:text-[var(--ink-muted)] md:text-3xl"
            >
              {b}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
