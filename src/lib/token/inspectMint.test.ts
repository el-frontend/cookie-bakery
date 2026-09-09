import { describe, expect, it, vi } from "vitest";
import { address, type Address, type ReadonlyUint8Array } from "@solana/kit";
import { TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import {
  getMintEncoder,
  TOKEN_2022_PROGRAM_ADDRESS,
} from "@solana-program/token-2022";
import { inspectMint, MintError } from "./inspectMint";

const MINT = address("9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM");
const AUTHORITY = address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const SOMEONE_ELSE = address("ComputeBudget111111111111111111111111111111");

function mintBytes({
  decimals = 6,
  supply = 1_000_000_000_000n,
}: { decimals?: number; supply?: bigint } = {}) {
  return getMintEncoder().encode({
    decimals,
    // A classic SPL mint carries no extension TLV at all.
    extensions: null,
    freezeAuthority: null,
    isInitialized: true,
    mintAuthority: AUTHORITY,
    supply,
  });
}

/** Minimal rpc double: only getAccountInfo is reached. */
function rpcReturning(value: unknown) {
  return {
    getAccountInfo: vi.fn(() => ({ send: async () => ({ value }) })),
  } as never;
}

function encodedAccount(owner: Address, data: ReadonlyUint8Array) {
  return {
    data: [Buffer.from(Uint8Array.from(data)).toString("base64"), "base64"],
    executable: false,
    lamports: 1_461_600n,
    owner,
    rentEpoch: 0n,
    space: BigInt(data.length),
  };
}

describe("inspectMint", () => {
  it("identifica Token-2022 por el owner", async () => {
    const rpc = rpcReturning(
      encodedAccount(TOKEN_2022_PROGRAM_ADDRESS, mintBytes())
    );
    const info = await inspectMint(rpc, MINT);

    expect(info.program).toBe("token-2022");
    expect(info.programAddress).toBe(TOKEN_2022_PROGRAM_ADDRESS);
    expect(info.decimals).toBe(6);
    expect(info.supply).toBe(1_000_000_000_000n);
    expect(info.mintAuthority).toBe(AUTHORITY);
    expect(info.freezeAuthority).toBeNull();
  });

  it("identifica Token clásico", async () => {
    const rpc = rpcReturning(
      encodedAccount(TOKEN_PROGRAM_ADDRESS, mintBytes({ decimals: 9 }))
    );
    const info = await inspectMint(rpc, MINT);

    expect(info.program).toBe("token");
    expect(info.decimals).toBe(9);
  });

  it("lanza legible si la cuenta no existe", async () => {
    const rpc = rpcReturning(null);
    await expect(inspectMint(rpc, MINT)).rejects.toThrow(MintError);
    await expect(inspectMint(rpc, MINT)).rejects.toThrow(/No account/);
  });

  it("lanza legible si el owner no es un token program", async () => {
    const rpc = rpcReturning(encodedAccount(SOMEONE_ELSE, mintBytes()));
    await expect(inspectMint(rpc, MINT)).rejects.toThrow(/another program/);
  });

  it("lanza legible si la cuenta es de un token program pero no un mint", async () => {
    // A token ACCOUNT, not a mint: right owner, wrong layout.
    const rpc = rpcReturning(
      encodedAccount(TOKEN_2022_PROGRAM_ADDRESS, new Uint8Array(12))
    );
    await expect(inspectMint(rpc, MINT)).rejects.toThrow(/is not a mint/);
  });
});
