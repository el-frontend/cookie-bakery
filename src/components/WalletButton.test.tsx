import type { ClientWithWallet } from "@solana/kit-plugin-wallet";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = {
  connect: vi.fn(),
  connected: null as { account: { address: string } } | null,
  disconnect: vi.fn(),
  isConnecting: false,
  isDisconnecting: false,
  ready: true,
  status: "disconnected" as string,
  wallets: [] as { name: string }[],
};

vi.mock("@solana/kit-plugin-wallet/react", () => ({
  useConnect: () => ({
    dispatch: state.connect,
    isRunning: state.isConnecting,
  }),
  useConnectedWallet: () => state.connected,
  useDisconnect: () => ({
    dispatch: state.disconnect,
    isRunning: state.isDisconnecting,
  }),
  useWallets: () => state.wallets,
  useWalletStatus: () => state.status,
  // Mirrors the real gate: renders `fallback` until warm-up settles.
  WalletReadyGate: ({
    children,
    fallback,
  }: {
    children: ReactNode;
    fallback: ReactNode;
  }) => (state.ready ? children : fallback),
}));

const { WalletButton } = await import("./WalletButton");

const client = {} as ClientWithWallet;

beforeEach(() => {
  state.connect = vi.fn();
  state.connected = null;
  state.disconnect = vi.fn();
  state.isConnecting = false;
  state.isDisconnecting = false;
  state.ready = true;
  state.status = "disconnected";
  state.wallets = [];
});

describe("WalletButton", () => {
  it("muestra el fallback hasta que el descubrimiento resuelve", () => {
    state.ready = false;
    state.wallets = [{ name: "Nightly" }];
    render(<WalletButton client={client} />);

    expect(screen.getByTestId("wallet-warmup")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Nightly/ })).toBeNull();
  });

  it("lista las wallets detectadas", () => {
    state.wallets = [{ name: "Nightly" }, { name: "Phantom" }];
    render(<WalletButton client={client} />);

    expect(screen.getByRole("button", { name: /Nightly/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Phantom/ })).toBeInTheDocument();
    expect(screen.queryByTestId("wallet-warmup")).toBeNull();
  });

  it("connect y disconnect cambian el estado", async () => {
    const user = userEvent.setup();
    state.wallets = [{ name: "Nightly" }];
    const { rerender } = render(<WalletButton client={client} />);

    await user.click(screen.getByRole("button", { name: /Nightly/ }));
    expect(state.connect).toHaveBeenCalledWith({ name: "Nightly" });

    // Simulate the store settling into a connected state.
    state.connected = { account: { address: "CookieAddr1111" } };
    state.status = "connected";
    rerender(<WalletButton client={client} />);

    expect(screen.getByTestId("connected-address")).toHaveTextContent(
      "CookieAddr1111"
    );
    expect(screen.getByTestId("wallet-status")).toHaveTextContent("Connected");
    // The wallet picker is replaced by the connected view.
    expect(screen.queryByRole("button", { name: /Nightly/ })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Disconnect" }));
    expect(state.disconnect).toHaveBeenCalled();
  });

  it("deshabilita los botones mientras hay una acción en vuelo", () => {
    state.wallets = [{ name: "Nightly" }];
    state.isConnecting = true;
    state.status = "connecting";
    render(<WalletButton client={client} />);

    expect(screen.getByRole("button", { name: /Nightly/ })).toBeDisabled();
    expect(screen.getByTestId("wallet-status")).toHaveTextContent(
      "Connecting…"
    );
  });
});
