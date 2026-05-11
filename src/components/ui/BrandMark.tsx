/**
 * Lead Machine brand mark (funnel + dots). Two flavors:
 *  - <BrandMark /> just the icon
 *  - <BrandLogo /> icon + wordmark "Lead Machine"
 */

export function BrandMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logo-mark.svg" alt="" aria-hidden className={className} />
  );
}

export function BrandLogo({
  size = "md",
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const wordmark =
    size === "sm" ? "text-sm" : size === "lg" ? "text-2xl" : "text-base";
  const mark =
    size === "sm" ? "h-5 w-5" : size === "lg" ? "h-9 w-9" : "h-7 w-7";
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <BrandMark className={mark} />
      <span className={`font-bold tracking-tight ${wordmark}`}>
        <span className="text-[var(--ink-strong)]">Lead</span>{" "}
        <span className="brand-text-gradient">Machine</span>
      </span>
    </span>
  );
}
