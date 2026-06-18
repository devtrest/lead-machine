"use client";

import { useEffect } from "react";

// Server-rendered pages with dynamic content (like /user/jobs) often hydrate
// AFTER the browser has already attempted to scroll to whatever was in the
// URL hash. Result: clicking 'Generate leads' from the dashboard navigates
// to /user/jobs#generate but the page lands at the top instead of at the
// form. This component runs once on mount: if there's a hash AND the target
// element exists, smooth-scroll into view. Drop it anywhere on the page
// (typically right after layout / above the fold) — it has no UI.
export function ScrollToHash() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (!hash || hash === "#") return;
    const id = hash.slice(1);
    // Wait a microtask so the rest of the page finishes laying out before we
    // measure — otherwise scrollIntoView lands on a position that shifts
    // when client-only sections (jobs list, stat tiles) reflow.
    const t = setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 50);
    return () => clearTimeout(t);
  }, []);
  return null;
}
