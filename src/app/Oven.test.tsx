import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAddressDecoder, type Address } from "@solana/kit";
import {
  AccountState,
  getMintEncoder,
  getTokenEncoder,
  TOKEN_2022_PROGRAM_ADDRESS,
  type ExtensionArgs,
} from "@solana-program/token-2022";
import { TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import {
  AIRDROP_HISTORY_KEY,
  AIRDROP_HISTORY_VERSION,
} from "../store/airdropHistory";

const decoder = getAddressDecoder();
function seeded(seed: number, salt = 4): Address {
  const bytes = new Uint8Array(32);
  bytes[0] = salt;
  bytes[1] = seed & 0xff;
  bytes[2] = (seed >> 8) & 0xff;
  return decoder.decode(bytes);
}

const MINT = seeded(1);
const AUTHORITY = seeded(2);
const H1 = seeded(10);
const H2 = seeded(11);
const DECIMALS = 6;
const SUPPLY = 1_000_000_000n; // 1,000 tokens at 6 decimals

vi.mock("@solana/react", () => ({ useClient: () => ({}) }));

const { Oven } = await import("./Oven");

type StubAccount = { data: Uint8Array; owner: Address };
const chain = new Map<string, StubAccount>();

function rpcAccount(account: StubAccount | undefined) {
  if (!account) return null;
  return {
    data: [Buffer.from(account.data).toString("base64"), "base64"],
    executable: false,
    lamports: 1_461_600n,
    owner: account.owner,
    rentEpoch: 0n,
    space: BigInt(account.data.length),
  };
}

/** DAS answers are stubbed through fetch; the RPC through these methods. */
const largest = {
  value: [] as { address: Address; amount: string }[],
};

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
      value: addresses.map((a) => rpcAccount(chain.get(a))),
    }),
  }),
  getTokenLargestAccounts: () => ({
    send: async () => ({
      context: { slot: 1n },
      value: largest.value.map((entry) => ({
        address: entry.address,
        amount: entry.amount,
        decimals: DECIMALS,
        uiAmount: 0,
        uiAmountString: entry.amount,
      })),
    }),
  }),
};

const client = { rpc } as never;

function mintBytes(extensions: ExtensionArgs[] | null, revoked = false) {
  return new Uint8Array(
    getMintEncoder().encode({
      decimals: DECIMALS,
      extensions,
      freezeAuthority: null,
      isInitialized: true,
      mintAuthority: revoked ? null : AUTHORITY,
      supply: SUPPLY,
    })
  );
}

function tokenBytes(owner: Address, amount: bigint) {
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

/** DAS holders for MINT, plus an optional metadata document. */
function stubFetch(
  holders: readonly { amount: string; owner: Address }[],
  metadata?: Record<string, unknown>
) {
  return vi.fn(async (url: string | URL | Request) => {
    const href = String(url);
    if (href.includes("api.cookiescan.io")) {
      return {
        json: async () => ({
          id: 1,
          jsonrpc: "2.0",
          result: {
            limit: 20,
            page: 1,
            token_accounts: holders.map((h, i) => ({
              address: seeded(200 + i),
              amount: h.amount,
              delegated_amount: 0,
              frozen: false,
              mint: MINT,
              owner: h.owner,
              token_program: TOKEN_PROGRAM_ADDRESS,
            })),
            total: holders.length,
          },
        }),
        ok: true,
        status: 200,
      } as Response;
    }
    if (metadata) {
      const text = JSON.stringify(metadata);
      return {
        body: null,
        headers: { get: () => null },
        ok: true,
        status: 200,
        text: async () => text,
      } as unknown as Response;
    }
    return {
      headers: { get: () => null },
      ok: false,
      status: 404,
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

const onAirdrop = vi.fn();
const onBake = vi.fn();

function renderOven() {
  return render(<Oven client={client} onAirdrop={onAirdrop} onBake={onBake} />);
}

/** Selects MINT by pasting it into the token selector. */
async function pickMint(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Mint address"), MINT);
  await user.click(screen.getByTestId("token-use-mint"));
  await waitFor(() =>
    expect(screen.getByTestId("token-selected")).toBeInTheDocument()
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  chain.clear();
  largest.value = [];
  chain.set(MINT, {
    data: mintBytes(null),
    owner: TOKEN_2022_PROGRAM_ADDRESS,
  });
  vi.stubGlobal("fetch", stubFetch([{ amount: "600000000", owner: H1 }]));
});

describe("Oven · estado vacío (AC-06.3)", () => {
  it("muestra el estado vacío sin mint", () => {
    renderOven();

    const empty = screen.getByTestId("oven-empty-state");
    expect(empty).toHaveTextContent("Nothing in the oven yet");
    // Names the next action rather than the absence.
    expect(
      within(empty).getByRole("button", { name: "Bake a token" })
    ).toBeInTheDocument();
  });
});

describe("Oven · mint (AC-04.2)", () => {
  it("renderiza supply y autoridades del mint", async () => {
    const user = userEvent.setup();
    renderOven();
    await pickMint(user);

    // Grouped for reading; the exact string still lives in the CSV export.
    await waitFor(() => expect(screen.getByText("1,000")).toBeInTheDocument());
    expect(screen.getByText("Total supply")).toBeInTheDocument();
    expect(screen.getByText("Decimals")).toBeInTheDocument();

    // Freeze was null on chain, so it reads as revoked, not as unknown.
    expect(screen.getAllByText("Revoked").length).toBeGreaterThanOrEqual(1);
  });

  it("marca ambas autoridades como revocadas cuando son null", async () => {
    chain.set(MINT, {
      data: mintBytes(null, true),
      owner: TOKEN_2022_PROGRAM_ADDRESS,
    });
    const user = userEvent.setup();
    renderOven();
    await pickMint(user);

    await waitFor(() => expect(screen.getAllByText("Revoked")).toHaveLength(2));
  });

  it("lista las extensiones activas con su detalle", async () => {
    chain.set(MINT, {
      data: mintBytes([
        { __kind: "NonTransferable" },
        { __kind: "MintCloseAuthority", closeAuthority: AUTHORITY },
      ]),
      owner: TOKEN_2022_PROGRAM_ADDRESS,
    });
    const user = userEvent.setup();
    renderOven();
    await pickMint(user);

    const list = await screen.findByTestId("extension-list");
    expect(list).toHaveTextContent("Non-transferable");
    expect(list).toHaveTextContent("Holders cannot transfer this token");
    expect(list).toHaveTextContent("Mint close authority");
  });

  it("dice que no hay extensiones en lugar de dejar el panel vacío", async () => {
    const user = userEvent.setup();
    renderOven();
    await pickMint(user);

    await waitFor(() =>
      expect(
        screen.getByText("No Token-2022 extensions are active on this mint.")
      ).toBeInTheDocument()
    );
  });
});

describe("Oven · holders (AC-04.3, AC-04.5)", () => {
  it("lista los holders con su porcentaje del supply", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch([
        { amount: "600000000", owner: H1 },
        { amount: "300000000", owner: H2 },
      ])
    );
    const user = userEvent.setup();
    renderOven();
    await pickMint(user);

    const table = await screen.findByTestId("holders-table");
    expect(within(table).getByText("60.00%")).toBeInTheDocument();
    expect(within(table).getByText("30.00%")).toBeInTheDocument();
    expect(
      screen.getByText("Holders indexed by CookieScan.")
    ).toBeInTheDocument();
  });

  it("sigue mostrando holders con la DAS caída", async () => {
    largest.value = [{ address: seeded(300), amount: "900000000" }];
    chain.set(seeded(300), {
      data: tokenBytes(H1, 900_000_000n),
      owner: TOKEN_2022_PROGRAM_ADDRESS,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => ({}),
        ok: false,
        status: 503,
      })) as unknown as typeof fetch
    );

    const user = userEvent.setup();
    renderOven();
    await pickMint(user);

    const table = await screen.findByTestId("holders-table");
    expect(within(table).getByText("90.00%")).toBeInTheDocument();
    expect(screen.getByText(/straight from the RPC/)).toBeInTheDocument();
  });
});

describe("Oven · metadata hostil (AC-04.6)", () => {
  it("renderiza markup de la metadata como texto plano", async () => {
    chain.set(MINT, {
      data: mintBytes([
        {
          __kind: "TokenMetadata",
          additionalMetadata: new Map(),
          mint: MINT,
          name: "<b>Evil</b> Token",
          symbol: "EVIL",
          updateAuthority: AUTHORITY,
          uri: "https://meta.test/x.json",
        } as unknown as ExtensionArgs,
      ]),
      owner: TOKEN_2022_PROGRAM_ADDRESS,
    });
    vi.stubGlobal(
      "fetch",
      stubFetch([{ amount: "1000000000", owner: H1 }], {
        description: "<script>alert(1)</script>Harmless",
        image: "https://cdn.test/a.png",
        name: "<img src=x onerror=alert(1)>Remote Name",
      })
    );

    const user = userEvent.setup();
    const { container } = renderOven();
    await pickMint(user);

    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
        "Remote Name"
      )
    );
    // Nothing was injected as markup.
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector('img[src="x"]')).toBeNull();
    expect(container.innerHTML).not.toContain("onerror");
    // The tags are stripped and their inert text content survives, which is
    // what "render markup as plain text" means here.
    expect(screen.getByText("alert(1)Harmless")).toBeInTheDocument();
  });

  it("la imagen lleva referrerpolicy no-referrer", async () => {
    chain.set(MINT, {
      data: mintBytes([
        {
          __kind: "TokenMetadata",
          additionalMetadata: new Map(),
          mint: MINT,
          name: "Cookie",
          symbol: "BAKE",
          updateAuthority: AUTHORITY,
          uri: "https://meta.test/x.json",
        } as unknown as ExtensionArgs,
      ]),
      owner: TOKEN_2022_PROGRAM_ADDRESS,
    });
    vi.stubGlobal(
      "fetch",
      stubFetch([{ amount: "1000000000", owner: H1 }], {
        image: "https://cdn.test/a.png",
        name: "Cookie",
      })
    );

    const user = userEvent.setup();
    renderOven();
    await pickMint(user);

    const image = await waitFor(() => {
      const found = document.querySelector('img[src="https://cdn.test/a.png"]');
      if (!found) throw new Error("image not rendered yet");
      return found;
    });
    expect(image).toHaveAttribute("referrerpolicy", "no-referrer");
  });

  it("ignora una imagen que no sea https", async () => {
    chain.set(MINT, {
      data: mintBytes([
        {
          __kind: "TokenMetadata",
          additionalMetadata: new Map(),
          mint: MINT,
          name: "Cookie",
          symbol: "BAKE",
          updateAuthority: AUTHORITY,
          uri: "https://meta.test/x.json",
        } as unknown as ExtensionArgs,
      ]),
      owner: TOKEN_2022_PROGRAM_ADDRESS,
    });
    vi.stubGlobal(
      "fetch",
      stubFetch([{ amount: "1000000000", owner: H1 }], {
        image: "data:image/svg+xml,<svg onload=alert(1)/>",
        name: "Cookie",
      })
    );

    const user = userEvent.setup();
    const { container } = renderOven();
    await pickMint(user);

    await waitFor(() =>
      expect(screen.getByTestId("holders-table")).toBeInTheDocument()
    );
    expect(container.querySelector("img")).toBeNull();
  });
});

describe("Oven · historial y acciones (AC-04.7)", () => {
  it("lista el historial local de ese mint", async () => {
    localStorage.setItem(
      AIRDROP_HISTORY_KEY,
      JSON.stringify({
        runs: [
          {
            batches: [
              {
                index: 0,
                recipients: [{ address: H1, amount: "100" }],
                signature: "SIGONE",
                status: "confirmed",
              },
            ],
            decimals: DECIMALS,
            id: "run-mine",
            mint: MINT,
            startedAt: "2026-09-09T10:00:00.000Z",
            symbol: "BAKE",
          },
          {
            batches: [],
            decimals: DECIMALS,
            id: "run-other",
            mint: seeded(999),
            startedAt: "2026-09-09T11:00:00.000Z",
            symbol: "OTHER",
          },
        ],
        v: AIRDROP_HISTORY_VERSION,
      })
    );

    const user = userEvent.setup();
    renderOven();
    await pickMint(user);

    const history = await screen.findByTestId("oven-history");
    // Only this mint's runs, and the signature links out to CookieScan.
    expect(history).toHaveTextContent("1/1 batches");
    const link = within(history).getByRole("link");
    expect(link).toHaveAttribute("href", expect.stringContaining("/tx/SIGONE"));
  });

  it("el link a CookieSwap incluye el mint", async () => {
    const user = userEvent.setup();
    renderOven();
    await pickMint(user);

    const link = await screen.findByTestId("oven-cookieswap");
    expect(link).toHaveAttribute("href", expect.stringContaining(MINT));
    expect(link).toHaveAttribute("rel", "noreferrer");
  });

  it("'Airdrop más' entrega el token seleccionado", async () => {
    const user = userEvent.setup();
    renderOven();
    await pickMint(user);

    await user.click(await screen.findByTestId("oven-airdrop-more"));

    expect(onAirdrop).toHaveBeenCalledWith(
      expect.objectContaining({ decimals: DECIMALS, mint: MINT })
    );
  });
});
