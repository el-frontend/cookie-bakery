import { describe, expect, it, vi } from "vitest";
import { address, type Address } from "@solana/kit";
import { TOKEN_2022_PROGRAM_ADDRESS } from "@solana-program/token-2022";
import {
  CHUNK_SIZE,
  chunk,
  mapWithConcurrency,
  MAX_CONCURRENCY,
  missingAtas,
  probeAtas,
} from "./probeAtas";

const MINT = address("9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM");

/** Distinct, real base58 owners generated from a known-good address. */
function owners(count: number): Address[] {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const base = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
  const out: Address[] = [];
  for (let i = 0; out.length < count; i++) {
    const tail =
      alphabet[i % 58] +
      alphabet[((i / 58) | 0) % 58] +
      alphabet[((i / 3364) | 0) % 58];
    try {
      out.push(address(base.slice(0, -3) + tail));
    } catch {
      // Not every tail decodes to 32 bytes; skip those.
    }
  }
  return out;
}

/**
 * getMultipleAccounts double. `present` decides which ATAs come back as
 * existing; `inFlight` records the concurrency actually reached.
 */
function fakeRpc(present: (index: number) => boolean) {
  const state = { calls: [] as number[], maxInFlight: 0, inFlight: 0 };
  let seen = 0;
  const rpc = {
    getMultipleAccounts: vi.fn((addresses: string[]) => ({
      send: async () => {
        state.calls.push(addresses.length);
        state.inFlight++;
        state.maxInFlight = Math.max(state.maxInFlight, state.inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        state.inFlight--;
        const value = addresses.map(() => {
          const exists = present(seen++);
          return exists
            ? {
                data: ["", "base64"],
                executable: false,
                lamports: 2_039_280n,
                owner: TOKEN_2022_PROGRAM_ADDRESS,
                rentEpoch: 0n,
                space: 165n,
              }
            : null;
        });
        return { context: { slot: 1n }, value };
      },
    })),
  } as never;
  return { rpc, state };
}

describe("chunk", () => {
  it("trocea en bloques del tamaño pedido sin perder elementos", () => {
    const items = Array.from({ length: 250 }, (_, i) => i);
    const blocks = chunk(items, CHUNK_SIZE);

    expect(blocks.map((b) => b.length)).toEqual([100, 100, 50]);
    expect(blocks.flat()).toEqual(items);
  });
});

describe("mapWithConcurrency", () => {
  it("no lanza más tareas simultáneas que el límite", async () => {
    let inFlight = 0;
    let peak = 0;
    const items = Array.from({ length: 20 }, (_, i) => i);

    const out = await mapWithConcurrency(items, 4, async (item) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 3));
      inFlight--;
      return item * 2;
    });

    expect(peak).toBeLessThanOrEqual(4);
    // Order follows the input, not completion.
    expect(out).toEqual(items.map((i) => i * 2));
  });
});

describe("probeAtas", () => {
  it("trocea en bloques de 100", async () => {
    const { rpc, state } = fakeRpc(() => true);
    await probeAtas(rpc, owners(250), MINT, TOKEN_2022_PROGRAM_ADDRESS);

    expect(state.calls).toEqual([100, 100, 50]);
  });

  it("no lanza más de 4 peticiones simultáneas", async () => {
    const { rpc, state } = fakeRpc(() => true);
    await probeAtas(rpc, owners(1000), MINT, TOKEN_2022_PROGRAM_ADDRESS);

    expect(state.calls).toHaveLength(10);
    expect(state.maxInFlight).toBeLessThanOrEqual(MAX_CONCURRENCY);
  });

  it("marca las ATAs ausentes", async () => {
    // Every other recipient already holds the token.
    const { rpc } = fakeRpc((index) => index % 2 === 0);
    const list = owners(6);
    const probes = await probeAtas(rpc, list, MINT, TOKEN_2022_PROGRAM_ADDRESS);

    expect(probes.map((p) => p.exists)).toEqual([
      true,
      false,
      true,
      false,
      true,
      false,
    ]);
    expect(missingAtas(probes)).toHaveLength(3);
    // Probes stay paired with the owner they were derived from.
    expect(probes.map((p) => p.owner)).toEqual(list);
  });

  it("deriva una ATA distinta por destinatario", async () => {
    const { rpc } = fakeRpc(() => true);
    const probes = await probeAtas(
      rpc,
      owners(5),
      MINT,
      TOKEN_2022_PROGRAM_ADDRESS
    );

    expect(new Set(probes.map((p) => p.ata)).size).toBe(5);
  });

  it("no llama al RPC con una lista vacía", async () => {
    const { rpc, state } = fakeRpc(() => true);
    expect(await probeAtas(rpc, [], MINT, TOKEN_2022_PROGRAM_ADDRESS)).toEqual(
      []
    );
    expect(state.calls).toHaveLength(0);
  });
});
