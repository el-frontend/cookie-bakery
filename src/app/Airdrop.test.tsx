import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { createNoopSigner, getAddressDecoder, type Address } from "@solana/kit";
import {
  AccountState,
  findAssociatedTokenPda,
  getMintEncoder,
  getTokenEncoder,
  TOKEN_2022_PROGRAM_ADDRESS,
} from "@solana-program/token-2022";
import { ToastProvider } from "../components/ToastProvider";
import {
  AIRDROP_HISTORY_KEY,
  AIRDROP_HISTORY_VERSION,
} from "../store/airdropHistory";

const decoder = getAddressDecoder();

/** Distinct valid addresses, built from bytes rather than typed base58. */
function seededAddress(seed: number): Address {
  const bytes = new Uint8Array(32);
  bytes[0] = 7;
  bytes[1] = seed & 0xff;
  bytes[2] = (seed >> 8) & 0xff;
  return decoder.decode(bytes);
}

const MINT = seededAddress(1);
const PAYER = seededAddress(2);
const R1 = seededAddress(10);
const R2 = seededAddress(11);
const R3 = seededAddress(12);
const DECIMALS = 6;

const payer = createNoopSigner(PAYER);
const balance = { lamports: 5_000_000_000n as bigint | null };

vi.mock("@solana/react", () => ({
  usePayer: () => payer,
}));

vi.mock("../hooks/useCookBalance", () => ({
  useCookBalance: () => ({
    error: null,
    isLoading: false,
    lamports: balance.lamports,
  }),
}));

const { Airdrop } = await import("./Airdrop");

type StubAccount = { data: Uint8Array; owner: Address };

/** Accounts the fake RPC knows about, keyed by address. */
const chain = new Map<string, StubAccount>();

function rpcAccount(account: StubAccount | undefined) {
  if (!account) return null;
  return {
    data: [Buffer.from(account.data).toString("base64"), "base64"],
    executable: false,
    lamports: 2_039_280n,
    owner: account.owner,
    rentEpoch: 0n,
    space: BigInt(account.data.length),
  };
}

const rpc = {
  getAccountInfo: (address: Address) => ({
    send: async () => ({
      context: { slot: 1n },
      value: rpcAccount(chain.get(address)),
    }),
  }),
  getMultipleAccounts: (addresses: readonly Address[]) => ({
    send: async () => ({
      context: { slot: 1n },
      value: addresses.map((address) => rpcAccount(chain.get(address))),
    }),
  }),
};

const sendTransaction = vi.fn(async () => ({
  kind: "single",
  status: { kind: "successful", signature: "SIG" },
}));

const client = {
  getMinimumBalance: vi.fn(async () => 2_039_280n),
  rpc,
  sendTransaction,
} as never;

function mintBytes(decimals: number): Uint8Array {
  return new Uint8Array(
    getMintEncoder().encode({
      decimals,
      extensions: null,
      freezeAuthority: null,
      isInitialized: true,
      mintAuthority: PAYER,
      supply: 1_000_000_000_000n,
    })
  );
}

function tokenBytes(owner: Address, amount: bigint): Uint8Array {
  return new Uint8Array(
    getTokenEncoder().encode({
      amount,
      closeAuthority: null,
      delegate: null,
      delegatedAmount: 0n,
      extensions: null,
      isNative: null,
      mint: MINT,
      owner,
      state: AccountState.Initialized,
    })
  );
}

/** Registers the mint, the sender's account, and the given holders' accounts. */
async function seedChain(holders: readonly Address[] = []) {
  chain.clear();
  chain.set(MINT, {
    data: mintBytes(DECIMALS),
    owner: TOKEN_2022_PROGRAM_ADDRESS,
  });

  for (const owner of [PAYER, ...holders]) {
    const [ata] = await findAssociatedTokenPda({
      mint: MINT,
      owner,
      tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
    });
    chain.set(ata, {
      data: tokenBytes(owner, 1_000_000_000_000n),
      owner: TOKEN_2022_PROGRAM_ADDRESS,
    });
  }
}

function renderAirdrop() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ToastProvider>{children}</ToastProvider>
  );
  return render(<Airdrop client={client} />, { wrapper });
}

/** Picks the mint by pasting it, the path a token nobody baked here takes. */
async function pickToken(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Mint address"), MINT);
  await user.click(screen.getByTestId("token-use-mint"));
  await waitFor(() =>
    expect(screen.getByTestId("token-selected")).toBeInTheDocument()
  );
}

async function typeList(
  user: ReturnType<typeof userEvent.setup>,
  list: string
) {
  // `paste` rather than `type`: a 44-character address per keystroke is slow
  // and re-runs validation on every partial address.
  await user.click(screen.getByLabelText("Recipients"));
  await user.paste(list);
}

beforeEach(async () => {
  vi.clearAllMocks();
  localStorage.clear();
  balance.lamports = 5_000_000_000n;
  sendTransaction.mockResolvedValue({
    kind: "single",
    status: { kind: "successful", signature: "SIG" },
  });
  await seedChain([R1]);
});

describe("Airdrop · validación (AC-03.3)", () => {
  it("señala la dirección inválida, la cantidad cero y el duplicado", async () => {
    const user = userEvent.setup();
    renderAirdrop();
    await pickToken(user);

    await typeList(
      user,
      [
        `${R1},100`,
        "0OIl1notbase58,50",
        `${R2},0`,
        `${R1},25`,
        `${R3},10`,
      ].join("\n")
    );

    const table = await screen.findByTestId("recipient-table");
    expect(
      within(table).getByText("Not a valid base58 address.")
    ).toBeInTheDocument();
    expect(
      within(table).getByText("Amount must be greater than zero.")
    ).toBeInTheDocument();
    expect(
      within(table).getByText(/already appears on line 1/)
    ).toBeInTheDocument();

    // Three flagged rows, and nothing can be prepared while they stand.
    expect(screen.getByTestId("plan-summary")).toHaveTextContent(
      "3rows with errors"
    );
    expect(screen.getByTestId("airdrop-prepare")).toBeDisabled();
  });
});

describe("Airdrop · duplicados (AC-03.4)", () => {
  it("fusionar duplicados suma las cantidades", async () => {
    const user = userEvent.setup();
    renderAirdrop();
    await pickToken(user);

    await typeList(user, [`${R1},100`, `${R2},10`, `${R1},50`].join("\n"));

    await user.click(await screen.findByTestId("airdrop-merge"));

    const summary = screen.getByTestId("plan-summary");
    expect(summary).toHaveTextContent("2recipients");
    expect(summary).toHaveTextContent("0rows with errors");
    // 100 + 50 merged, plus 10.
    expect(summary).toHaveTextContent("160");
    expect(
      within(screen.getByTestId("recipient-table")).getByText(
        /Merged from 1, 3/
      )
    ).toBeInTheDocument();
    expect(screen.getByTestId("airdrop-prepare")).toBeEnabled();
  });
});

describe("Airdrop · plan y coste (AC-03.5)", () => {
  it("muestra nº de transacciones, ATAs nuevas y coste antes de firmar", async () => {
    const user = userEvent.setup();
    renderAirdrop();
    await pickToken(user);
    await typeList(user, [`${R1},100`, `${R2},200`, `${R3},300`].join("\n"));

    await user.click(await screen.findByTestId("airdrop-prepare"));
    await waitFor(() =>
      expect(screen.getByTestId("airdrop-send")).toBeInTheDocument()
    );

    const summary = screen.getByTestId("plan-summary");
    // R2 and R3 have no account, so the batch size drops to 6 (PRD RT-05).
    expect(summary).toHaveTextContent("1 × 6 per batch");
    expect(summary).toHaveTextContent("New token accounts2");
    expect(summary).not.toHaveTextContent("Estimated cost—");
    // Nothing has been signed to get here.
    expect(sendTransaction).not.toHaveBeenCalled();

    const table = screen.getByTestId("recipient-table");
    expect(within(table).getAllByText("+ ATA")).toHaveLength(2);
    expect(within(table).getAllByText("ATA exists")).toHaveLength(1);
  });

  it("no deja preparar si el emisor no tiene suficientes tokens", async () => {
    const [payerAta] = await findAssociatedTokenPda({
      mint: MINT,
      owner: PAYER,
      tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
    });
    chain.set(payerAta, {
      data: tokenBytes(PAYER, 1n),
      owner: TOKEN_2022_PROGRAM_ADDRESS,
    });

    const user = userEvent.setup();
    renderAirdrop();
    await pickToken(user);
    await typeList(user, `${R1},100`);

    await user.click(await screen.findByTestId("airdrop-prepare"));

    expect(await screen.findByText(/but the wallet holds/)).toBeInTheDocument();
    expect(screen.queryByTestId("airdrop-send")).not.toBeInTheDocument();
  });
});

describe("Airdrop · ejecución (AC-03.1)", () => {
  it("envía un airdrop de tres destinatarios, uno sin ATA", async () => {
    const user = userEvent.setup();
    renderAirdrop();
    await pickToken(user);
    await typeList(user, [`${R1},100`, `${R2},200`, `${R3},300`].join("\n"));

    await user.click(await screen.findByTestId("airdrop-prepare"));
    await user.click(await screen.findByTestId("airdrop-send"));

    await waitFor(() =>
      expect(screen.getByTestId("batch-status-0")).toHaveTextContent(
        "Confirmed"
      )
    );
    expect(sendTransaction).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: /SIG/ })).toHaveAttribute(
      "href",
      expect.stringContaining("/tx/SIG")
    );
    expect(
      screen.getByRole("heading", { name: "Airdrop complete" })
    ).toBeInTheDocument();

    // One createAssociatedTokenIdempotent per missing account, plus a
    // transferChecked per recipient. The mock is declared without parameters,
    // so its recorded arguments need re-typing to be inspected.
    const calls = sendTransaction.mock.calls as unknown as [unknown[]][];
    expect(calls[0][0]).toHaveLength(5);
  });
});

describe("Airdrop · fallo y reintento (AC-03.2)", () => {
  it("reintenta el lote fallido sin repetir el confirmado", async () => {
    // Seven recipients with existing accounts → batches of 8 would be one
    // transaction, so give two of them no account to force the split at 6.
    const owners = [R1, R2, R3, seededAddress(13), seededAddress(14)];
    await seedChain(owners);
    const many = [...owners, seededAddress(20), seededAddress(21)];

    sendTransaction
      .mockResolvedValueOnce({
        kind: "single",
        status: { kind: "successful", signature: "SIG-A" },
      })
      .mockRejectedValueOnce(new Error("Simulation failed"))
      .mockResolvedValueOnce({
        kind: "single",
        status: { kind: "successful", signature: "SIG-B" },
      });

    const user = userEvent.setup();
    renderAirdrop();
    await pickToken(user);
    await typeList(user, many.map((owner) => `${owner},10`).join("\n"));

    await user.click(await screen.findByTestId("airdrop-prepare"));
    await user.click(await screen.findByTestId("airdrop-send"));

    await waitFor(() =>
      expect(screen.getByTestId("batch-status-1")).toHaveTextContent("Failed")
    );
    expect(screen.getByTestId("batch-status-0")).toHaveTextContent("Confirmed");

    await user.click(screen.getByTestId("batch-retry-1"));

    await waitFor(() =>
      expect(screen.getByTestId("batch-status-1")).toHaveTextContent(
        "Confirmed"
      )
    );
    // Three sends in total: batch 0 once, batch 1 twice. The confirmed batch
    // is never re-sent.
    expect(sendTransaction).toHaveBeenCalledTimes(3);
    expect(screen.getByTestId("batch-status-0")).toHaveTextContent("Confirmed");
  });
});

describe("Airdrop · historial (AC-03.8)", () => {
  it("muestra qué lotes se confirmaron en una tanda anterior", async () => {
    localStorage.setItem(
      AIRDROP_HISTORY_KEY,
      JSON.stringify({
        runs: [
          {
            batches: [
              {
                index: 0,
                recipients: [{ address: R1, amount: "100" }],
                signature: "OLD-SIG",
                status: "confirmed",
              },
              {
                index: 1,
                recipients: [{ address: R2, amount: "200" }],
                status: "pending",
              },
            ],
            decimals: DECIMALS,
            id: "run-1",
            mint: MINT,
            startedAt: "2026-09-09T10:00:00.000Z",
            symbol: "BAKE",
          },
        ],
        v: AIRDROP_HISTORY_VERSION,
      })
    );

    renderAirdrop();

    const history = await screen.findByTestId("airdrop-history");
    expect(history).toHaveTextContent("BAKE");
    expect(history).toHaveTextContent("1/2 batches");
  });
});
