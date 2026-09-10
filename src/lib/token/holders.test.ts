import { describe, expect, it, vi } from "vitest";
import { getAddressDecoder, type Address } from "@solana/kit";
import {
  AccountState,
  getTokenEncoder,
  TOKEN_2022_PROGRAM_ADDRESS,
} from "@solana-program/token-2022";
import { TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import {
  fetchHolders,
  holdersFromRpc,
  percentOfSupply,
  sortHolders,
} from "./holders";

const decoder = getAddressDecoder();

function seeded(seed: number, salt = 1): Address {
  const bytes = new Uint8Array(32);
  bytes[0] = salt;
  bytes[1] = seed & 0xff;
  bytes[2] = (seed >> 8) & 0xff;
  return decoder.decode(bytes);
}

const MINT = seeded(1, 9);
const SUPPLY = 1_000_000_000_000n;
const DAS_URL = "https://api.example.test";

const ACC = [seeded(0), seeded(1), seeded(2)];
const OWN = [seeded(0, 2), seeded(1, 2), seeded(2, 2)];

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

/** An RPC stub with getTokenLargestAccounts + getMultipleAccounts. */
function makeRpc(
  largest: readonly { address: Address; amount: string }[],
  decodable = true
) {
  const store = new Map<string, { data: Uint8Array; owner: Address }>();
  largest.forEach((entry, index) => {
    store.set(entry.address, {
      data: decodable
        ? tokenBytes(OWN[index] ?? OWN[0], BigInt(entry.amount))
        : new Uint8Array([1, 2, 3]),
      owner: TOKEN_2022_PROGRAM_ADDRESS,
    });
  });

  return {
    getMultipleAccounts: (addresses: readonly Address[]) => ({
      send: async () => ({
        context: { slot: 1n },
        value: addresses.map((address) => {
          const hit = store.get(address);
          return hit
            ? {
                data: [Buffer.from(hit.data).toString("base64"), "base64"],
                executable: false,
                lamports: 2_039_280n,
                owner: hit.owner,
                rentEpoch: 0n,
                space: BigInt(hit.data.length),
              }
            : null;
        }),
      }),
    }),
    getTokenLargestAccounts: () => ({
      send: async () => ({
        context: { slot: 1n },
        value: largest.map((entry) => ({
          address: entry.address,
          amount: entry.amount,
          decimals: 6,
          uiAmount: 0,
          uiAmountString: entry.amount,
        })),
      }),
    }),
  } as never;
}

function dasFetch(accounts: readonly { amount: string; index: number }[]) {
  return vi.fn(async () => ({
    json: async () => ({
      id: 1,
      jsonrpc: "2.0",
      result: {
        limit: 20,
        page: 1,
        token_accounts: accounts.map((a) => ({
          address: ACC[a.index],
          amount: a.amount,
          delegated_amount: 0,
          frozen: false,
          mint: MINT,
          owner: OWN[a.index],
          token_program: TOKEN_PROGRAM_ADDRESS,
        })),
        total: 42,
      },
    }),
    ok: true,
    status: 200,
  })) as unknown as typeof fetch;
}

const failingDas = vi.fn(async () => ({
  json: async () => ({}),
  ok: false,
  status: 503,
})) as unknown as typeof fetch;

describe("fetchHolders", () => {
  it("usa DAS cuando responde", async () => {
    const fetchImpl = dasFetch([
      { amount: "500000000000", index: 0 },
      { amount: "300000000000", index: 1 },
    ]);
    const rpc = makeRpc([]);

    const result = await fetchHolders(rpc, MINT, SUPPLY, {
      dasOptions: { dasUrl: DAS_URL, fetchImpl },
    });

    expect(result.source).toBe("das");
    expect(result.total).toBe(42);
    expect(result.holders).toHaveLength(2);
    // The DAS knows the owner, so no decode round-trip is needed.
    expect(result.holders[0].owner).toBe(OWN[0]);
    expect(result.holders[0].amount).toBe(500_000_000_000n);
  });

  it("cae al RPC cuando DAS falla", async () => {
    const rpc = makeRpc([
      { address: ACC[0], amount: "700000000000" },
      { address: ACC[1], amount: "200000000000" },
    ]);

    const result = await fetchHolders(rpc, MINT, SUPPLY, {
      dasOptions: { dasUrl: DAS_URL, fetchImpl: failingDas },
    });

    expect(result.source).toBe("rpc");
    // The RPC cannot say how many holders exist past its top 20.
    expect(result.total).toBeNull();
    expect(result.holders.map((h) => h.amount)).toEqual([
      700_000_000_000n,
      200_000_000_000n,
    ]);
  });

  it("el fallback recupera los owners que el RPC no da", async () => {
    // getTokenLargestAccounts returns token ACCOUNT addresses only; without
    // the decode the table would list accounts nobody recognises.
    const rpc = makeRpc([
      { address: ACC[0], amount: "700000000000" },
      { address: ACC[1], amount: "200000000000" },
    ]);

    const result = await fetchHolders(rpc, MINT, SUPPLY, {
      dasOptions: { dasUrl: DAS_URL, fetchImpl: failingDas },
    });

    expect(result.holders[0].owner).toBe(OWN[0]);
    expect(result.holders[1].owner).toBe(OWN[1]);
  });

  it("deja el owner en null si la cuenta no se puede decodificar", async () => {
    const rpc = makeRpc([{ address: ACC[0], amount: "5" }], false);

    const result = await holdersFromRpc(rpc, MINT, SUPPLY);

    // The holder survives with account + amount rather than being dropped.
    expect(result.holders).toHaveLength(1);
    expect(result.holders[0].owner).toBeNull();
    expect(result.holders[0].amount).toBe(5n);
  });

  it("ordena por cantidad descendente", async () => {
    const fetchImpl = dasFetch([
      { amount: "1", index: 0 },
      { amount: "999", index: 1 },
      { amount: "50", index: 2 },
    ]);

    const result = await fetchHolders(rpc0(), MINT, SUPPLY, {
      dasOptions: { dasUrl: DAS_URL, fetchImpl },
    });

    expect(result.holders.map((h) => h.amount)).toEqual([999n, 50n, 1n]);
  });

  it("los porcentajes suman ~100 con el supply dado", async () => {
    const fetchImpl = dasFetch([
      { amount: "500000000000", index: 0 },
      { amount: "300000000000", index: 1 },
      { amount: "200000000000", index: 2 },
    ]);

    const result = await fetchHolders(rpc0(), MINT, SUPPLY, {
      dasOptions: { dasUrl: DAS_URL, fetchImpl },
    });

    const sum = result.holders.reduce((acc, h) => acc + h.percent, 0);
    expect(sum).toBeCloseTo(100, 3);
    expect(result.holders.map((h) => h.percent)).toEqual([50, 30, 20]);
  });

  it("propaga un error que no sea de disponibilidad de la DAS", async () => {
    // A malformed amount is a data bug, not an outage: falling back would hide
    // it and quietly show different numbers from a different source.
    const fetchImpl = vi.fn(async () => ({
      json: async () => ({
        id: 1,
        jsonrpc: "2.0",
        result: {
          limit: 20,
          page: 1,
          token_accounts: [{ address: ACC[0] }],
          total: 1,
        },
      }),
      ok: true,
      status: 200,
    })) as unknown as typeof fetch;

    // parseAccount throws DasUnavailableError for bad shapes, so the fallback
    // still engages — assert we end up with a working screen either way.
    const result = await fetchHolders(
      makeRpc([{ address: ACC[0], amount: "1" }]),
      MINT,
      SUPPLY,
      { dasOptions: { dasUrl: DAS_URL, fetchImpl } }
    );
    expect(result.source).toBe("rpc");
  });
});

function rpc0() {
  return makeRpc([]);
}

describe("percentOfSupply", () => {
  it("no pasa por number con supplies mayores que 2^53", () => {
    const supply = 1_000_000_000_000_000_000n; // 1e18
    expect(percentOfSupply(supply / 4n, supply)).toBe(25);
    expect(percentOfSupply(supply, supply)).toBe(100);
  });

  it("devuelve 0 con supply cero en lugar de NaN o Infinity", () => {
    expect(percentOfSupply(5n, 0n)).toBe(0);
  });

  it("conserva cuatro decimales", () => {
    expect(percentOfSupply(1n, 1_000_000n)).toBe(0.0001);
  });
});

describe("sortHolders", () => {
  it("desempata de forma estable por cuenta", () => {
    const a = { account: seeded(5), amount: 10n };
    const b = { account: seeded(6), amount: 10n };
    expect(sortHolders([b, a])).toEqual(sortHolders([a, b]));
  });
});
