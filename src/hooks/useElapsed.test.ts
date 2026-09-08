import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatElapsed, TICK_MS, useElapsed } from "./useElapsed";

describe("useElapsed", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("cuenta mientras running es true", async () => {
    let clock = 0;
    const { result } = renderHook(() => useElapsed(true, () => clock));

    await act(async () => {
      clock = 500;
      await vi.advanceTimersByTimeAsync(TICK_MS * 5);
    });
    expect(result.current).toBe(500);
  });

  it("se detiene al confirmar", async () => {
    let clock = 0;
    const { rerender, result } = renderHook(
      ({ running }) => useElapsed(running, () => clock),
      { initialProps: { running: true } }
    );

    await act(async () => {
      clock = 1400;
      await vi.advanceTimersByTimeAsync(TICK_MS * 3);
    });
    expect(result.current).toBe(1400);

    // Stop counting — the final value must survive for display.
    rerender({ running: false });
    await act(async () => {
      clock = 9999;
      await vi.advanceTimersByTimeAsync(TICK_MS * 10);
    });
    expect(result.current).toBe(1400);
  });

  it("no sigue corriendo tras desmontar", async () => {
    let clock = 0;
    let ticks = 0;
    const now = () => {
      ticks += 1;
      return clock;
    };
    const { unmount } = renderHook(() => useElapsed(true, now));

    await act(async () => {
      clock = 300;
      await vi.advanceTimersByTimeAsync(TICK_MS * 3);
    });
    const ticksBefore = ticks;

    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TICK_MS * 10);
    });

    // No further reads: the interval was cleared on teardown.
    expect(ticks).toBe(ticksBefore);
  });
});

describe("formatElapsed", () => {
  it("formatea sub-segundo y segundos", () => {
    expect(formatElapsed(800)).toBe("0.8s");
    expect(formatElapsed(1400)).toBe("1.4s");
  });

  it("formatea minutos", () => {
    expect(formatElapsed(65_000)).toBe("1m 5s");
  });
});
