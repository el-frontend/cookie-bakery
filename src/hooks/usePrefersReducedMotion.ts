import { useEffect, useState } from "react";

/**
 * Whether the viewer asked for reduced motion.
 *
 * `index.css` already neutralises CSS animation under the media query, but
 * Recharts animates in JavaScript by interpolating attributes, which no
 * stylesheet can reach. Charts need the preference as a value.
 *
 * Defaults to `false` when `matchMedia` is missing (jsdom, older engines) so a
 * chart still renders rather than silently deciding it must stay still.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);

    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
