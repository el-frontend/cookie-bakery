import { useCallback, useEffect, useRef, useState } from "react";

export const POLL_INTERVAL_MS = 10_000;
export const TIMEOUT_MS = 5_000;
/** Two consecutive failures before shouting — one blip is not an outage. */
export const FAILURE_THRESHOLD = 2;

export type RpcHealth = {
  consecutiveFailures: number;
  isHealthy: boolean;
  latencyMs: number | null;
  refresh: () => void;
  slot: bigint | null;
};

/** Fetches the current slot, rejecting if it takes longer than `timeoutMs`. */
export async function probeSlot(
  getSlot: () => Promise<bigint>,
  timeoutMs: number = TIMEOUT_MS,
  now: () => number = () => Date.now()
): Promise<{ latencyMs: number; slot: bigint }> {
  const started = now();
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`RPC did not respond within ${timeoutMs}ms`)),
      timeoutMs
    );
  });
  try {
    const slot = await Promise.race([getSlot(), timeout]);
    return { latencyMs: now() - started, slot };
  } finally {
    clearTimeout(timer!);
  }
}

/**
 * Polls the RPC and reports health.
 *
 * Deliberately tolerant of a single failure: the Cookie Chain RPC is
 * community-run and an isolated blip should not paint an outage banner over a
 * working app. Two consecutive failures does mean something.
 */
export function useRpcHealth(getSlot: () => Promise<bigint>): RpcHealth {
  const [slot, setSlot] = useState<bigint | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const getSlotRef = useRef(getSlot);
  getSlotRef.current = getSlot;

  const check = useCallback(async () => {
    try {
      const result = await probeSlot(() => getSlotRef.current());
      setSlot(result.slot);
      setLatencyMs(result.latencyMs);
      setConsecutiveFailures(0);
    } catch {
      setLatencyMs(null);
      setConsecutiveFailures((n) => n + 1);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (!cancelled) void check();
    };
    run();
    const timer = setInterval(run, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [check]);

  return {
    consecutiveFailures,
    isHealthy: consecutiveFailures < FAILURE_THRESHOLD,
    latencyMs,
    refresh: () => void check(),
    slot,
  };
}
