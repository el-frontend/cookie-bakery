import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FAILURE_THRESHOLD,
  POLL_INTERVAL_MS,
  probeSlot,
  TIMEOUT_MS,
  useRpcHealth,
} from "./useRpcHealth";

describe("probeSlot", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("un timeout de 5s cuenta como fallo", async () => {
    vi.useFakeTimers();
    // A call that never settles must reject, not hang forever.
    const promise = probeSlot(() => new Promise<bigint>(() => {}), TIMEOUT_MS);
    const assertion = expect(promise).rejects.toThrow(/did not respond/);
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS + 1);
    await assertion;
  });

  it("devuelve slot y latencia cuando responde", async () => {
    let clock = 1000;
    const result = await probeSlot(
      async () => {
        clock += 42;
        return 123n;
      },
      TIMEOUT_MS,
      () => clock
    );
    expect(result.slot).toBe(123n);
    expect(result.latencyMs).toBe(42);
  });

  it("propaga el error del rpc", async () => {
    await expect(
      probeSlot(async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");
  });
});

describe("useRpcHealth", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("marca unhealthy tras 2 fallos consecutivos", async () => {
    const getSlot = vi.fn().mockRejectedValue(new Error("down"));
    const { result } = renderHook(() => useRpcHealth(getSlot));

    await waitFor(() => expect(result.current.consecutiveFailures).toBe(1));
    // One failure is a blip, not an outage.
    expect(result.current.isHealthy).toBe(true);

    await act(async () => {
      result.current.refresh();
    });

    await waitFor(() =>
      expect(result.current.consecutiveFailures).toBe(FAILURE_THRESHOLD)
    );
    expect(result.current.isHealthy).toBe(false);
  });

  it("un éxito posterior reinicia el contador", async () => {
    const getSlot = vi
      .fn()
      .mockRejectedValueOnce(new Error("down"))
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValue(900n);

    const { result } = renderHook(() => useRpcHealth(getSlot));
    // Mount is failure 1; the next poll makes it 2 and trips unhealthy.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });
    await waitFor(() => expect(result.current.isHealthy).toBe(false));

    await act(async () => {
      result.current.refresh();
    });

    await waitFor(() => expect(result.current.slot).toBe(900n));
    expect(result.current.consecutiveFailures).toBe(0);
    expect(result.current.isHealthy).toBe(true);
  });

  it("expone el slot actual al arrancar", async () => {
    const getSlot = vi.fn().mockResolvedValue(23872514n);
    const { result } = renderHook(() => useRpcHealth(getSlot));

    await waitFor(() => expect(result.current.slot).toBe(23872514n));
    expect(result.current.isHealthy).toBe(true);
  });
});
