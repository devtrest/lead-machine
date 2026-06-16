/* eslint-disable @next/next/no-img-element */
// Animated logo slider. The track holds two identical copies of the logo set;
// the `marquee` keyframe (globals.css) shifts it -50% for a seamless loop.
// Logos are self-hosted SVGs in /public/logos and reflect what the product
// touches: scraping (Google, Google Maps) and outreach (Gmail, Proton Mail,
// Zoho, HubSpot, Mailchimp, Zapier, Calendly). Rendered grayscale for a clean
// "works with" strip; color reveals on hover.

const logos = [
  { src: "/logos/google.svg", alt: "Google" },
  { src: "/logos/googlemaps.svg", alt: "Google Maps" },
  { src: "/logos/gmail.svg", alt: "Gmail" },
  { src: "/logos/protonmail.svg", alt: "Proton Mail" },
  { src: "/logos/zoho.svg", alt: "Zoho" },
  { src: "/logos/hubspot.svg", alt: "HubSpot" },
  { src: "/logos/mailchimp.svg", alt: "Mailchimp" },
  { src: "/logos/zapier.svg", alt: "Zapier" },
  { src: "/logos/calendly.svg", alt: "Calendly" },
];

export function LogoMarquee() {
  return (
    <section className="relative border-y border-[var(--border)] bg-[var(--surface-elev)]/60 py-7">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <p className="text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-subtle)]">
          Scrapes the open web · sends through the mailboxes you already use
        </p>
      </div>

      <div className="relative mt-6 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)] [-webkit-mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
        <div className="flex w-max animate-marquee items-center">
          {[...logos, ...logos].map((logo, i) => (
            <span
              key={i}
              className="flex shrink-0 items-center justify-center px-7 md:px-10"
            >
              <img
                src={logo.src}
                alt={i < logos.length ? logo.alt : ""}
                aria-hidden={i >= logos.length}
                draggable={false}
                loading="lazy"
                className="h-6 w-auto opacity-50 grayscale transition duration-300 hover:opacity-100 hover:grayscale-0 md:h-7"
              />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
