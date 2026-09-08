import type { Address } from "@solana/kit";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const trackedCalls: { key: unknown; spec: unknown }[] = [];
let trackedResult: { data?: unknown; error?: unknown } = {};

const rpc = { getBalance: vi.fn(() => ({ __req: "getBalance" })) };
const rpcSubscriptions = {
  accountNotifications: vi.fn(() => ({ __sub: "accountNotifications" })),
};

vi.mock("@solana/react", () => ({
  useClient: () => ({ rpc, rpcSubscriptions }),
}));

vi.mock("@solana/react/swr", () => ({
  useTrackedDataSWR: (key: unknown, spec: unknown) => {
    trackedCalls.push({ key, spec });
    return trackedResult;
  },
}));

const { useCookBalance } = await import("./useCookBalance");

/** Array.prototype.at needs ES2022; the project targets ES2020. */
function lastCall() {
  return trackedCalls[trackedCalls.length - 1];
}

const ADDRESS = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU" as Address;

beforeEach(() => {
  trackedCalls.length = 0;
  trackedResult = {};
  rpc.getBalance.mockClear();
  rpcSubscriptions.accountNotifications.mockClear();
});

describe("useCookBalance", () => {
  it("el spec es null sin address", () => {
    const { result } = renderHook(() => useCookBalance(undefined));

    expect(lastCall()?.spec).toBeNull();
    expect(lastCall()?.key).toBeNull();
    expect(result.current.lamports).toBeNull();
    expect(result.current.isLoading).toBe(false);
    // Gated off: no RPC traffic at all.
    expect(rpc.getBalance).not.toHaveBeenCalled();
    expect(rpcSubscriptions.accountNotifications).not.toHaveBeenCalled();
  });

  it("con address arma lectura inicial y suscripción a la vez", () => {
    renderHook(() => useCookBalance(ADDRESS));

    expect(rpc.getBalance).toHaveBeenCalledWith(ADDRESS, {
      commitment: "confirmed",
    });
    expect(rpcSubscriptions.accountNotifications).toHaveBeenCalledWith(
      ADDRESS,
      { commitment: "confirmed" }
    );
    expect(lastCall()?.key).toEqual(["cook-balance", ADDRESS]);
  });

  it("una notificación posterior actualiza el valor", () => {
    trackedResult = { data: { context: { slot: 1n }, value: 42n } };
    const { result, rerender } = renderHook(() => useCookBalance(ADDRESS));
    expect(result.current.lamports).toBe(42n);

    trackedResult = { data: { context: { slot: 2n }, value: 100n } };
    rerender();
    expect(result.current.lamports).toBe(100n);
  });

  it("el spec se mantiene estable entre renders con la misma address", () => {
    const { rerender } = renderHook(() => useCookBalance(ADDRESS));
    const first = lastCall()?.spec;
    rerender();
    // A new spec identity would tear down and re-open the subscription.
    expect(lastCall()?.spec).toBe(first);
  });

  it("expone el error y deja de cargar", () => {
    trackedResult = { error: new Error("rpc down") };
    const { result } = renderHook(() => useCookBalance(ADDRESS));

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.lamports).toBeNull();
  });
});
