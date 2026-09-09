import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ToastProvider } from "../components/ToastProvider";
import { MY_TOKENS_KEY } from "../store/myTokens";

const PAYER_ADDRESS = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const SIGNATURE = "4BEoRsMQ9qdz4wXc4nEopQGv7dMFAceTBtRySZM8KTKWtbGMzuUxg";

const payer = { address: PAYER_ADDRESS, signTransactions: vi.fn() };
const planDispatchAsync = vi.fn(async () => ({}));
// The shape client.sendTransaction resolves with.
const sendDispatchAsync = vi.fn(async () => ({
  kind: "single",
  message: {},
  status: { context: {}, kind: "successful", signature: SIGNATURE },
}));
const balance = { lamports: 1_000_000_000n as bigint | null };

vi.mock("@solana/react", () => ({
  usePayer: () => payer,
  usePlanTransaction: () => ({ dispatchAsync: planDispatchAsync }),
  useSendTransaction: () => ({ dispatchAsync: sendDispatchAsync }),
}));

vi.mock("../hooks/useCookBalance", () => ({
  useCookBalance: () => ({
    error: null,
    isLoading: false,
    lamports: balance.lamports,
  }),
}));

const { Bake } = await import("./Bake");

/** Only `getMinimumBalance` is reached from the component under test. */
const client = {
  getMinimumBalance: vi.fn(async (space: number) => BigInt(space * 6960)),
} as never;

function renderBake() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ToastProvider>{children}</ToastProvider>
  );
  return render(<Bake client={client} />, { wrapper });
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Name"), "Bakery Cookie");
  await user.type(screen.getByLabelText("Symbol"), "BAKE");
}

beforeEach(() => {
  vi.clearAllMocks();
  balance.lamports = 1_000_000_000n;
  localStorage.clear();
  planDispatchAsync.mockResolvedValue({});
  sendDispatchAsync.mockResolvedValue({
    kind: "single",
    message: {},
    status: { context: {}, kind: "successful", signature: SIGNATURE },
  });
});

describe("Bake", () => {
  it("no envía con el formulario inválido", async () => {
    const user = userEvent.setup();
    renderBake();

    // Name and symbol are empty.
    await user.click(screen.getByTestId("bake-review"));

    expect(await screen.findAllByRole("alert")).not.toHaveLength(0);
    expect(screen.queryByTestId("bake-summary")).not.toBeInTheDocument();
    expect(planDispatchAsync).not.toHaveBeenCalled();
    expect(sendDispatchAsync).not.toHaveBeenCalled();
  });

  it("simula antes de pedir firma", async () => {
    const user = userEvent.setup();
    renderBake();
    await fillValidForm(user);
    await user.click(screen.getByTestId("bake-review"));

    expect(await screen.findByTestId("bake-summary")).toBeInTheDocument();
    await waitFor(() => expect(planDispatchAsync).toHaveBeenCalledTimes(1));
    // Simulating is not signing.
    expect(sendDispatchAsync).not.toHaveBeenCalled();
  });

  it("muestra el error de simulación sin firmar", async () => {
    planDispatchAsync.mockRejectedValueOnce(
      new Error("custom program error: 0x1")
    );
    const user = userEvent.setup();
    renderBake();
    await fillValidForm(user);
    await user.click(screen.getByTestId("bake-review"));

    expect(await screen.findByTestId("simulation-error")).toBeInTheDocument();
    expect(screen.getByTestId("bake-submit")).toBeDisabled();
    expect(sendDispatchAsync).not.toHaveBeenCalled();
  });

  it("bloquea el envío con saldo insuficiente", async () => {
    balance.lamports = 1n;
    const user = userEvent.setup();
    renderBake();
    await fillValidForm(user);
    await user.click(screen.getByTestId("bake-review"));

    await screen.findByTestId("cost-breakdown");
    expect(screen.getByTestId("insufficient-balance")).toBeInTheDocument();
    expect(screen.getByTestId("bake-submit")).toBeDisabled();
    expect(sendDispatchAsync).not.toHaveBeenCalled();
  });

  it("muestra la tarjeta con el mint tras confirmar", async () => {
    const user = userEvent.setup();
    renderBake();
    await fillValidForm(user);
    await user.click(screen.getByTestId("bake-review"));

    const submit = await screen.findByTestId("bake-submit");
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);

    const card = await screen.findByTestId("token-result");
    expect(card).toHaveTextContent("Bakery Cookie");
    expect(card).toHaveTextContent("BAKE");
    expect(sendDispatchAsync).toHaveBeenCalledTimes(1);
  });

  it("enlaza a CookieScan con el mint", async () => {
    const user = userEvent.setup();
    renderBake();
    await fillValidForm(user);
    await user.click(screen.getByTestId("bake-review"));

    const mintShown = (await screen.findByTestId("summary-mint")).textContent;
    const submit = screen.getByTestId("bake-submit");
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);

    const link = await screen.findByTestId("result-mint-link");
    const href = link.getAttribute("href") ?? "";
    expect(href).toMatch(/^https:\/\/cookiescan\.io\/token\//);
    // The address previewed before signing is the one that ends up created.
    expect(link.textContent?.slice(0, 4)).toBe(mintShown?.slice(0, 4));

    expect(screen.getByTestId("result-tx-link")).toHaveAttribute(
      "href",
      `https://cookiescan.io/tx/${SIGNATURE}`
    );
  });

  it("guarda el token en Mis tokens tras confirmar", async () => {
    const user = userEvent.setup();
    renderBake();
    await fillValidForm(user);
    await user.click(screen.getByTestId("bake-review"));

    const submit = await screen.findByTestId("bake-submit");
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);
    await screen.findByTestId("token-result");

    const stored = JSON.parse(localStorage.getItem(MY_TOKENS_KEY) as string);
    expect(stored.tokens).toHaveLength(1);
    expect(stored.tokens[0]).toMatchObject({
      name: "Bakery Cookie",
      program: "token-2022",
      signature: SIGNATURE,
      symbol: "BAKE",
    });
  });

  it("vuelve al formulario desde el resumen sin firmar", async () => {
    const user = userEvent.setup();
    renderBake();
    await fillValidForm(user);
    await user.click(screen.getByTestId("bake-review"));

    await screen.findByTestId("bake-summary");
    await user.click(screen.getByTestId("bake-back"));

    expect(screen.getByTestId("bake-review")).toBeInTheDocument();
    expect(sendDispatchAsync).not.toHaveBeenCalled();
  });
});
