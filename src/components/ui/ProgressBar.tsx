"use client";

import { useEffect, useRef, useState } from "react";

export function ProgressBar({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const [display, setDisplay] = useState(clamped);
  const fromRef = useRef(clamped);
  const startedAtRef = useRef<number | null>(null);
  const targetRef = useRef(clamped);

  useEffect(() => {
    fromRef.current = display;
    targetRef.current = clamped;
    startedAtRef.current = null;
    let raf = 0;
    // ~600ms ease per change — feels smooth even when SSE events arrive
    // out of order or in bursts.
    const duration = 600;
    const step = (t: number) => {
      if (startedAtRef.current === null) startedAtRef.current = t;
      const elapsed = t - startedAtRef.current;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next =
        fromRef.current + (targetRef.current - fromRef.current) * eased;
      setDisplay(next);
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clamped]);

  return (
    <div
      className={`relative h-2 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)] ${className}`}
    >
      <div
        style={{ width: `${display}%` }}
        className="relative h-full rounded-full bg-gradient-to-r from-[var(--brand-700)] via-[var(--brand-500)] to-[var(--sky-500)]"
      >
        <span className="absolute inset-0 animate-pulse rounded-full bg-white/20" />
      </div>
    </div>
  );
}
