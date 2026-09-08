import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POLL_INTERVAL_MS } from "../hooks/useRpcHealth";

const getSlot = vi.fn();

vi.mock("@solana/react", () => ({
  useClient: () => ({ rpc: { getSlot: () => ({ send: getSlot }) } }),
}));

const { NetworkIndicator } = await import("./NetworkIndicator");

beforeEach(() => {
  getSlot.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("NetworkIndicator", () => {
  it("muestra la cadena, el host del rpc y el slot", async () => {
    getSlot.mockResolvedValue(23872514n);
    render(<NetworkIndicator />);

    await waitFor(() =>
      expect(screen.getByTestId("slot")).toHaveTextContent("slot 23872514")
    );
    expect(screen.getByTestId("network-indicator")).toHaveTextContent(
      "Cookie Chain · rpc.cookiescan.io"
    );
    expect(screen.queryByTestId("rpc-error-banner")).toBeNull();
  });

  it("renderiza el banner cuando el rpc está unhealthy", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getSlot.mockRejectedValue(new Error("down"));
    render(<NetworkIndicator />);

    // First failure on mount is tolerated — no banner yet.
    await waitFor(() => expect(getSlot).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId("rpc-error-banner")).toBeNull();

    // The second consecutive failure arrives on the next poll.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });

    await waitFor(() =>
      expect(screen.getByTestId("rpc-error-banner")).toBeInTheDocument()
    );
    expect(screen.getByRole("alert")).toHaveTextContent("not responding");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("el banner desaparece cuando el rpc se recupera", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getSlot.mockRejectedValue(new Error("down"));
    render(<NetworkIndicator />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });
    await waitFor(() =>
      expect(screen.getByTestId("rpc-error-banner")).toBeInTheDocument()
    );

    getSlot.mockResolvedValue(999n);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });

    await waitFor(() =>
      expect(screen.queryByTestId("rpc-error-banner")).toBeNull()
    );
    expect(screen.getByTestId("slot")).toHaveTextContent("slot 999");
  });
});
