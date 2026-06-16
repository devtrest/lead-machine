import { Info } from "lucide-react";

export type LegalSection = {
  heading: string;
  body?: string[];
  bullets?: string[];
};

export function LegalDoc({
  lastUpdated,
  intro,
  sections,
}: {
  lastUpdated: string;
  intro?: string;
  sections: LegalSection[];
}) {
  return (
    <section className="relative pb-20">
      <div className="mx-auto max-w-3xl px-5 md:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-subtle)]">
          Last updated · {lastUpdated}
        </p>

        {intro ? (
          <p className="mt-4 text-sm leading-relaxed text-[var(--ink-muted)] md:text-base">
            {intro}
          </p>
        ) : null}

        <div className="mt-10 space-y-10">
          {sections.map((s, i) => (
            <div key={s.heading}>
              <h2 className="flex items-baseline gap-2 text-lg font-semibold tracking-tight text-[var(--ink-strong)]">
                <span className="text-sm font-semibold text-[var(--brand-600)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {s.heading}
              </h2>
              {s.body?.map((p, j) => (
                <p
                  key={j}
                  className="mt-3 text-sm leading-relaxed text-[var(--ink-muted)]"
                >
                  {p}
                </p>
              ))}
              {s.bullets ? (
                <ul className="mt-3 space-y-2">
                  {s.bullets.map((b, j) => (
                    <li
                      key={j}
                      className="flex gap-2.5 text-sm leading-relaxed text-[var(--ink-muted)]"
                    >
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand-500)]" />
                      {b}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>

        <div className="surface-sunken mt-12 flex items-start gap-3 p-5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ink-subtle)]" />
          <p className="text-xs leading-relaxed text-[var(--ink-muted)]">
            This document is provided for general information and is a starting
            template — it is not legal advice. Please have it reviewed by
            qualified counsel before relying on it for your business. Questions?
            Email{" "}
            <a
              href="mailto:hello@leadmachine.ai"
              className="font-medium text-[var(--brand-700)] underline-offset-2 hover:underline"
            >
              hello@leadmachine.ai
            </a>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
