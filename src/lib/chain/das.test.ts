import { describe, expect, it, vi } from "vitest";
import { address } from "@solana/kit";
import { TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import {
  clampLimit,
  DAS_MAX_LIMIT,
  DasUnavailableError,
  getAllTokenAccounts,
  getTokenAccounts,
} from "./das";

const MINT = address("9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM");
const OWNER = address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ACCOUNT = address("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

const DAS_URL = "https://api.example.test";

function rawAccount(amount: string, index = 0) {
  return {
    address:
      index === 0 ? ACCOUNT : address("11111111111111111111111111111111"),
    amount,
    delegated_amount: 0,
    frozen: false,
    mint: MINT,
    owner: OWNER,
    token_program: TOKEN_PROGRAM_ADDRESS,
  };
}

type SentBody = { params: Record<string, unknown> };
type ResultFactory = (body: SentBody) => unknown;

/** A fetch stub that replies with a JSON-RPC envelope and records the body. */
function okFetch(result: ResultFactory | Record<string, unknown>) {
  return vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as SentBody;
    const value = typeof result === "function" ? result(body) : result;
    return {
      json: async () => ({ id: 1, jsonrpc: "2.0", result: value }),
      ok: true,
      status: 200,
    } as Response;
  }) as unknown as typeof fetch;
}

describe("getTokenAccounts", () => {
  it("envía params como objeto, no array", async () => {
    // Verified against the live endpoint: an array yields
    // -32602 "Either 'mint' or 'owner' parameter is required".
    const fetchImpl = okFetch({
      limit: 20,
      page: 1,
      token_accounts: [rawAccount("5")],
      total: 1,
    });

    await getTokenAccounts({ mint: MINT }, { dasUrl: DAS_URL, fetchImpl });

    const call = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0];
    const sent = JSON.parse(String((call[1] as RequestInit).body));
    expect(Array.isArray(sent.params)).toBe(false);
    expect(sent.params).toMatchObject({ limit: 20, mint: MINT, page: 1 });
    expect(sent.method).toBe("getTokenAccounts");
    expect(call[0]).toBe(DAS_URL);
  });

  it("parsea amount a bigint sin pasar por number", async () => {
    // Past 2^53. Number would round this to ...66264 and the holder's balance
    // would silently disagree with the chain.
    const huge = "484085512066266123";
    const fetchImpl = okFetch({
      limit: 20,
      page: 1,
      token_accounts: [rawAccount(huge)],
      total: 1,
    });

    const page = await getTokenAccounts(
      { mint: MINT },
      { dasUrl: DAS_URL, fetchImpl }
    );

    expect(page.accounts[0].amount).toBe(484085512066266123n);
    expect(page.accounts[0].amount.toString()).toBe(huge);
    // Proof the detour matters: Number cannot even round-trip this string.
    expect(BigInt(Number(huge))).not.toBe(484085512066266123n);
  });

  it("rechaza un amount que no es una cadena de dígitos", async () => {
    const fetchImpl = okFetch({
      limit: 20,
      page: 1,
      token_accounts: [{ ...rawAccount("0"), amount: 1.5 }],
      total: 1,
    });

    await expect(
      getTokenAccounts({ mint: MINT }, { dasUrl: DAS_URL, fetchImpl })
    ).rejects.toThrow(DasUnavailableError);
  });

  it("recorta el limit al máximo que el servidor respeta", async () => {
    // The server clamps to 1000 silently; asking for more and believing the
    // answer was complete is the bug this prevents.
    const fetchImpl = okFetch({
      limit: DAS_MAX_LIMIT,
      page: 1,
      token_accounts: [],
      total: 0,
    });

    await getTokenAccounts(
      { limit: 5_000, mint: MINT },
      { dasUrl: DAS_URL, fetchImpl }
    );

    const sent = JSON.parse(
      String(
        (
          (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
            .calls[0][1] as RequestInit
        ).body
      )
    );
    expect(sent.params.limit).toBe(DAS_MAX_LIMIT);
  });

  it("lanza DasUnavailableError ante 5xx", async () => {
    const fetchImpl = vi.fn(async () => ({
      json: async () => ({}),
      ok: false,
      status: 503,
    })) as unknown as typeof fetch;

    await expect(
      getTokenAccounts({ mint: MINT }, { dasUrl: DAS_URL, fetchImpl })
    ).rejects.toThrow(/503/);
  });

  it("lanza DasUnavailableError cuando la red falla", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;

    await expect(
      getTokenAccounts({ mint: MINT }, { dasUrl: DAS_URL, fetchImpl })
    ).rejects.toThrow(DasUnavailableError);
  });

  it("lanza DasUnavailableError ante un error JSON-RPC", async () => {
    const fetchImpl = vi.fn(async () => ({
      json: async () => ({
        error: { code: -32602, message: "Missing required parameters" },
        id: 1,
        jsonrpc: "2.0",
      }),
      ok: true,
      status: 200,
    })) as unknown as typeof fetch;

    await expect(
      getTokenAccounts({ mint: MINT }, { dasUrl: DAS_URL, fetchImpl })
    ).rejects.toThrow(/Missing required parameters/);
  });

  it("aborta la petición cuando se agota el timeout", async () => {
    const fetchImpl = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError"))
          );
        })
    ) as unknown as typeof fetch;

    await expect(
      getTokenAccounts(
        { mint: MINT },
        { dasUrl: DAS_URL, fetchImpl, timeoutMs: 5 }
      )
    ).rejects.toThrow(DasUnavailableError);
  });
});

describe("getAllTokenAccounts", () => {
  it("pagina hasta agotar total", async () => {
    const pages: Record<number, string[]> = {
      1: Array.from({ length: DAS_MAX_LIMIT }, (_, i) => String(i + 1)),
      2: ["7", "8"],
    };
    const fetchImpl = okFetch((body) => {
      const page = Number(body.params.page);
      const amounts = pages[page] ?? [];
      return {
        limit: DAS_MAX_LIMIT,
        page,
        token_accounts: amounts.map((amount, i) => rawAccount(amount, i)),
        total: DAS_MAX_LIMIT + 2,
      };
    });

    const result = await getAllTokenAccounts(MINT, {
      dasUrl: DAS_URL,
      fetchImpl,
    });

    expect(result.total).toBe(DAS_MAX_LIMIT + 2);
    expect(result.accounts).toHaveLength(DAS_MAX_LIMIT + 2);
    expect(result.truncated).toBe(false);
    expect(
      fetchImpl as unknown as ReturnType<typeof vi.fn>
    ).toHaveBeenCalledTimes(2);
  });

  it("se detiene ante una página vacía aunque total prometa más", async () => {
    // A server that reports more than it hands over must not loop forever.
    const fetchImpl = okFetch((body) => ({
      limit: DAS_MAX_LIMIT,
      page: Number(body.params.page),
      token_accounts: Number(body.params.page) === 1 ? [rawAccount("1")] : [],
      total: 999_999,
    }));

    const result = await getAllTokenAccounts(MINT, {
      dasUrl: DAS_URL,
      fetchImpl,
    });

    expect(result.accounts).toHaveLength(1);
    expect(
      fetchImpl as unknown as ReturnType<typeof vi.fn>
    ).toHaveBeenCalledTimes(2);
  });

  it("marca el resultado como truncado al alcanzar maxAccounts", async () => {
    const fetchImpl = okFetch((body) => ({
      limit: DAS_MAX_LIMIT,
      page: Number(body.params.page),
      token_accounts: Array.from({ length: DAS_MAX_LIMIT }, (_, i) =>
        rawAccount(String(i + 1), i)
      ),
      total: 10_000,
    }));

    const result = await getAllTokenAccounts(MINT, {
      dasUrl: DAS_URL,
      fetchImpl,
      maxAccounts: 1_500,
    });

    expect(result.accounts).toHaveLength(1_500);
    expect(result.truncated).toBe(true);
  });
});

describe("clampLimit", () => {
  it("mantiene el rango 1..1000", () => {
    expect(clampLimit(0)).toBe(1);
    expect(clampLimit(-5)).toBe(1);
    expect(clampLimit(20)).toBe(20);
    expect(clampLimit(5_000)).toBe(DAS_MAX_LIMIT);
    expect(clampLimit(Number.NaN)).toBe(20);
  });
});
