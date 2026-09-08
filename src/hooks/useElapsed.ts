import { useEffect, useRef, useState } from "react";

export const TICK_MS = 100;

/**
 * Milliseconds elapsed while `running` is true, frozen once it goes false.
 *
 * Freezing rather than resetting is the point: after a transaction confirms
 * the user wants to see how long it took, so the final value has to survive.
 */
export function useElapsed(running: boolean, now: () => number = Date.now) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAt = useRef<number | null>(null);
  // Kept in a ref and OUT of the effect deps on purpose. A caller passing an
  // inline `() => Date.now()` would otherwise change identity on every render,
  // re-running the effect and resetting the clock to zero each tick.
  const nowRef = useRef(now);
  nowRef.current = now;

  useEffect(() => {
    if (!running) {
      startedAt.current = null;
      return;
    }
    startedAt.current = nowRef.current();
    setElapsedMs(0);

    const timer = setInterval(() => {
      if (startedAt.current != null) {
        setElapsedMs(nowRef.current() - startedAt.current);
      }
    }, TICK_MS);

    // Clearing on unmount matters: a component torn down mid-flight would
    // otherwise keep a timer alive and warn about setting state while
    // unmounted, every tick, forever.
    return () => clearInterval(timer);
  }, [running]);

  return elapsedMs;
}

/** `1.4s`, or `0.8s` for sub-second. Kept short — it sits inline in a chip. */
export function formatElapsed(ms: number): string {
  if (ms < 1000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}
