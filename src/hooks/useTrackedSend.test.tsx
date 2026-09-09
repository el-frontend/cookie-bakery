import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../components/ToastProvider";
import { useTrackedSend } from "./useTrackedSend";

const wrapper = ({ children }: { children: ReactNode }) => (
  <ToastProvider>{children}</ToastProvider>
);

/** Matches the real shape: code 1 nested under the send wrapper. */
function blockhashExpired() {
  const root = new Error(
    "The network has progressed past the last block for which this transaction could have been committed."
  ) as Error & { context: Record<string, unknown> };
  root.name = "SolanaError";
  root.context = {
    __code: 1,
    currentBlockHeight: 23578836n,
    lastValidBlockHeight: 23578835n,
  };
  const top = new Error("Failed to send transaction") as Error & {
    cause: unknown;
    context: Record<string, unknown>;
  };
  top.name = "SolanaError";
  top.context = { __code: 11 };
  top.cause = root;
  return top;
}

function unfunded() {
  const root = new Error(
    "Attempt to debit an account but found no record of a prior credit."
  ) as Error & { context: Record<string, unknown> };
  root.name = "SolanaError";
  root.context = { __code: 7050003 };
  const top = new Error("Failed to send transaction") as Error & {
    cause: unknown;
  };
  top.cause = root;
  return top;
}

describe("useTrackedSend", () => {
  it("reintenta una vez con blockhash expirado", async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(blockhashExpired())
      .mockResolvedValue({ context: { signature: "SIG123" } });

    const { result } = renderHook(() => useTrackedSend(send), { wrapper });
    let outcome;
    await act(async () => {
      outcome = await result.current.dispatch();
    });

    expect(send).toHaveBeenCalledTimes(2);
    expect(outcome).toMatchObject({ retried: true, signature: "SIG123" });
    expect(result.current.error).toBeNull();
  });

  it("no reintenta dos veces", async () => {
    const send = vi.fn().mockRejectedValue(blockhashExpired());
    const { result } = renderHook(() => useTrackedSend(send), { wrapper });

    await act(async () => {
      await result.current.dispatch();
    });

    // One original attempt plus exactly one retry — never a loop.
    expect(send).toHaveBeenCalledTimes(2);
    expect(result.current.error?.kind).toBe("blockhash-expired");
    expect(result.current.isRunning).toBe(false);
  });

  it("no reintenta ante rechazo del usuario", async () => {
    const send = vi
      .fn()
      .mockRejectedValue(new Error("User rejected the request"));
    const { result } = renderHook(() => useTrackedSend(send), { wrapper });

    await act(async () => {
      await result.current.dispatch();
    });

    // Re-prompting someone who just declined would be hostile.
    expect(send).toHaveBeenCalledTimes(1);
    expect(result.current.error?.kind).toBe("user-rejected");
  });

  it("no reintenta ante fondos insuficientes", async () => {
    const send = vi.fn().mockRejectedValue(unfunded());
    const { result } = renderHook(() => useTrackedSend(send), { wrapper });

    await act(async () => {
      await result.current.dispatch();
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(result.current.error?.kind).toBe("insufficient-funds");
    expect(result.current.error?.action?.label).toMatch(/Bridge/);
  });

  it("limpia el estado pending cuando la acción falla", async () => {
    const send = vi.fn().mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useTrackedSend(send), { wrapper });

    await act(async () => {
      await result.current.dispatch();
    });

    // A stuck spinner is the failure mode AC-05.1 exists to prevent.
    expect(result.current.isRunning).toBe(false);
    expect(result.current.error).not.toBeNull();
  });

  it("acepta una firma devuelta como string", async () => {
    const send = vi.fn().mockResolvedValue("PLAINSIG");
    const { result } = renderHook(() => useTrackedSend(send), { wrapper });

    await act(async () => {
      await result.current.dispatch();
    });
    expect(result.current.signature).toBe("PLAINSIG");
  });

  it("lee la firma de un SingleTransactionPlanResult de Kit", async () => {
    // The shape client.sendTransaction actually resolves with: the signature
    // lives under `status`, not at the top level.
    const send = vi.fn().mockResolvedValue({
      kind: "single",
      message: {},
      status: { context: {}, kind: "successful", signature: "PLANSIG" },
    });
    const { result } = renderHook(() => useTrackedSend(send), { wrapper });

    await act(async () => {
      await result.current.dispatch();
    });
    expect(result.current.signature).toBe("PLANSIG");
  });

  it("pasa los argumentos al send", async () => {
    const send = vi.fn().mockResolvedValue("SIG");
    const { result } = renderHook(() => useTrackedSend(send), { wrapper });

    await act(async () => {
      await result.current.dispatch("a", 42);
    });
    expect(send).toHaveBeenCalledWith("a", 42);
  });
});
