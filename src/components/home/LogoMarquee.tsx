/* eslint-disable @next/next/no-img-element */
// Animated logo slider, embedded inside the hero (between the CTA and the
// dashboard preview). The track holds two identical copies of the logo set;
// the `marquee` keyframe (globals.css) shifts it -50% for a seamless loop.
// Logos are self-hosted SVGs in /public/logos and reflect what the product
// touches: scraping (Google, Google Maps) and outreach (Gmail, HubSpot,
// Mailchimp, Zapier, Calendly). Grayscale, color reveals on hover.

const logos = [
  { src: "/logos/google.svg", alt: "Google" },
  { src: "/logos/googlemaps.svg", alt: "Google Maps" },
  { src: "/logos/gmail.svg", alt: "Gmail" },
  { src: "/logos/hubspot.svg", alt: "HubSpot" },
  { src: "/logos/mailchimp.svg", alt: "Mailchimp" },
  { src: "/logos/zapier.svg", alt: "Zapier" },
  { src: "/logos/calendly.svg", alt: "Calendly" },
];

export function LogoMarquee() {
  return (
    <div className="relative mx-auto mt-12 max-w-3xl">
      <p className="text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-subtle)]">
        Scrapes the open web · sends through the mailboxes you already use
      </p>

      <div className="relative mt-5 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_18%,black_82%,transparent)] [-webkit-mask-image:linear-gradient(to_right,transparent,black_18%,black_82%,transparent)]">
        <div className="flex w-max animate-marquee items-center">
          {[...logos, ...logos].map((logo, i) => (
            <span
              key={i}
              className="flex shrink-0 items-center justify-center px-7 md:px-9"
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
    </div>
  );
}
