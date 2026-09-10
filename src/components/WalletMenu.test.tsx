import type { ClientWithWallet } from "@solana/kit-plugin-wallet";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Account = { address: string };
type Wallet = { accounts: Account[]; name: string };

const state = {
  connect: vi.fn(),
  connectError: null as unknown,
  connected: null as { account: Account; wallet: Wallet } | null,
  disconnect: vi.fn(),
  isConnecting: false,
  isDisconnecting: false,
  resetConnect: vi.fn(),
  selectAccount: vi.fn(),
  showToast: vi.fn(),
  wallets: [] as Wallet[],
};

vi.mock("@solana/kit-plugin-wallet/react", () => ({
  useConnect: () => ({
    dispatch: state.connect,
    error: state.connectError,
    isRunning: state.isConnecting,
    reset: state.resetConnect,
  }),
  useConnectedWallet: () => state.connected,
  useDisconnect: () => ({
    dispatch: state.disconnect,
    isRunning: state.isDisconnecting,
  }),
  useSelectAccount: () => state.selectAccount,
  useWallets: () => state.wallets,
}));

vi.mock("../hooks/useCookBalance", () => ({
  useCookBalance: () => ({
    error: null,
    isLoading: false,
    lamports: 2_500_000_000n,
  }),
}));

vi.mock("../hooks/useToast", () => ({
  useToast: () => ({
    dismiss: vi.fn(),
    show: state.showToast,
    update: vi.fn(),
  }),
}));

const { WalletMenu } = await import("./WalletMenu");

const client = {} as ClientWithWallet;

const nightly: Wallet = {
  accounts: [{ address: "CookieAddr1111" }, { address: "SecondAddr2222" }],
  name: "Nightly",
};
const phantom: Wallet = { accounts: [], name: "Phantom" };

beforeEach(() => {
  state.connect = vi.fn();
  state.connectError = null;
  state.connected = { account: nightly.accounts[0], wallet: nightly };
  state.disconnect = vi.fn();
  state.isConnecting = false;
  state.isDisconnecting = false;
  state.resetConnect = vi.fn();
  state.selectAccount = vi.fn();
  state.showToast = vi.fn();
  state.wallets = [nightly, phantom];
});

async function openMenu() {
  const user = userEvent.setup();
  render(<WalletMenu client={client} />);
  await user.click(screen.getByTestId("wallet-menu-trigger"));
  return user;
}

describe("WalletMenu", () => {
  it("no renderiza nada sin wallet conectada", () => {
    state.connected = null;
    const { container } = render(<WalletMenu client={client} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("el chip muestra dirección y saldo, y abre el menú", async () => {
    const user = userEvent.setup();
    render(<WalletMenu client={client} />);

    const trigger = screen.getByTestId("wallet-menu-trigger");
    expect(trigger).toHaveTextContent("Cook…1111");
    expect(trigger).toHaveTextContent("2.5 COOK");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("wallet-menu")).toBeNull();

    await user.click(trigger);
    expect(screen.getByTestId("wallet-menu")).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("conecta otra wallet detectada y cierra el menú", async () => {
    const user = await openMenu();

    await user.click(screen.getByRole("menuitem", { name: /Phantom/ }));
    expect(state.connect).toHaveBeenCalledWith(phantom);
    expect(screen.queryByTestId("wallet-menu")).toBeNull();
  });

  it("no ofrece la wallet ya conectada como destino", async () => {
    await openMenu();
    expect(screen.queryByRole("menuitem", { name: /Nightly/ })).toBeNull();
  });

  it("avisa cuando no hay otra wallet a la que cambiar", async () => {
    state.wallets = [nightly];
    await openMenu();
    expect(screen.getByText("No other wallets detected.")).toBeInTheDocument();
  });

  it("cambia a otra cuenta autorizada de la misma wallet", async () => {
    const user = await openMenu();

    await user.click(screen.getByRole("menuitem", { name: /Second…dr2222/ }));
    expect(state.selectAccount).toHaveBeenCalledWith(nightly.accounts[1]);
    expect(screen.queryByTestId("wallet-menu")).toBeNull();
  });

  it("desconecta la wallet actual", async () => {
    const user = await openMenu();

    await user.click(screen.getByTestId("wallet-disconnect"));
    expect(state.disconnect).toHaveBeenCalled();
    expect(screen.queryByTestId("wallet-menu")).toBeNull();
  });

  it("copia la dirección completa, nunca la truncada", async () => {
    const writeText = vi.fn(async () => {});
    const user = await openMenu();
    // setup() installs its own clipboard stub, so override it afterwards.
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    await user.click(screen.getByRole("menuitem", { name: /Copy address/ }));

    expect(writeText).toHaveBeenCalledWith("CookieAddr1111");
  });

  it("Escape cierra el menú y devuelve el foco al chip", async () => {
    const user = await openMenu();

    await user.keyboard("{Escape}");
    expect(screen.queryByTestId("wallet-menu")).toBeNull();
    expect(screen.getByTestId("wallet-menu-trigger")).toHaveFocus();
  });

  it("un clic fuera cierra el menú", async () => {
    const user = await openMenu();

    await user.click(document.body);
    expect(screen.queryByTestId("wallet-menu")).toBeNull();
  });

  it("las flechas recorren los items del menú", async () => {
    const user = await openMenu();

    await user.keyboard("{ArrowDown}");
    expect(
      screen.getByRole("menuitem", { name: /Copy address/ })
    ).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(screen.getByTestId("wallet-disconnect")).toHaveFocus();
  });

  it("avisa por toast si el cambio de wallet falla", () => {
    state.connectError = new Error("User rejected the request");
    render(<WalletMenu client={client} />);

    expect(state.showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Signature declined",
        variant: "error",
      })
    );
    expect(state.resetConnect).toHaveBeenCalled();
  });

  it("bloquea los cambios de identidad mientras hay una acción en vuelo", async () => {
    state.isConnecting = true;
    await openMenu();

    expect(screen.getByRole("menuitem", { name: /Phantom/ })).toBeDisabled();
    expect(
      screen.getByRole("menuitem", { name: /Second…dr2222/ })
    ).toBeDisabled();
  });
});
