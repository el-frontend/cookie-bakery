import { describe, expect, it, vi } from "vitest";
import { address, type Address } from "@solana/kit";
import {
  AccountState,
  getTokenEncoder,
  TOKEN_2022_PROGRAM_ADDRESS,
} from "@solana-program/token-2022";
import { TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { readSourceAccount } from "./sourceAccount";

const MINT = address("9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM");
const OTHER_MINT = address("So11111111111111111111111111111111111111112");
const OWNER = address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

function tokenAccountBytes(mint: Address, amount: bigint): Uint8Array {
  return new Uint8Array(
    getTokenEncoder().encode({
      amount,
      closeAuthority: null,
      delegate: null,
      delegatedAmount: 0n,
      extensions: null,
      isNative: null,
      mint,
      owner: OWNER,
      state: AccountState.Initialized,
    })
  );
}

/** A getAccountInfo stub returning base64 data, the shape Kit asks for. */
function rpcReturning(
  value: {
    data: Uint8Array;
    owner: Address;
  } | null
) {
  return {
    getAccountInfo: vi.fn(() => ({
      send: vi.fn(async () => ({
        context: { slot: 1n },
        value: value
          ? {
              data: [Buffer.from(value.data).toString("base64"), "base64"],
              executable: false,
              lamports: 2_039_280n,
              owner: value.owner,
              rentEpoch: 0n,
              space: BigInt(value.data.length),
            }
          : null,
      })),
    })),
  } as never;
}

describe("readSourceAccount", () => {
  it("lee el saldo del emisor", async () => {
    const rpc = rpcReturning({
      data: tokenAccountBytes(MINT, 1_000_000n),
      owner: TOKEN_2022_PROGRAM_ADDRESS,
    });

    const source = await readSourceAccount(
      rpc,
      OWNER,
      MINT,
      TOKEN_2022_PROGRAM_ADDRESS
    );

    expect(source.exists).toBe(true);
    expect(source.amount).toBe(1_000_000n);
    expect(source.ata).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
  });

  it("no inventa saldo cuando el emisor no tiene la cuenta", async () => {
    const source = await readSourceAccount(
      rpcReturning(null),
      OWNER,
      MINT,
      TOKEN_2022_PROGRAM_ADDRESS
    );

    expect(source).toMatchObject({ amount: 0n, exists: false });
  });

  it("rechaza una cuenta que pertenece a otro programa", async () => {
    const rpc = rpcReturning({
      data: tokenAccountBytes(MINT, 5n),
      owner: TOKEN_PROGRAM_ADDRESS,
    });

    const source = await readSourceAccount(
      rpc,
      OWNER,
      MINT,
      TOKEN_2022_PROGRAM_ADDRESS
    );

    expect(source).toMatchObject({ amount: 0n, exists: false });
  });

  it("rechaza una cuenta de otro mint", async () => {
    const rpc = rpcReturning({
      data: tokenAccountBytes(OTHER_MINT, 5n),
      owner: TOKEN_2022_PROGRAM_ADDRESS,
    });

    const source = await readSourceAccount(
      rpc,
      OWNER,
      MINT,
      TOKEN_2022_PROGRAM_ADDRESS
    );

    expect(source).toMatchObject({ amount: 0n, exists: false });
  });

  it("deriva la ATA con el programa que se le pasa", async () => {
    const rpc = rpcReturning(null);

    const classic = await readSourceAccount(
      rpc,
      OWNER,
      MINT,
      TOKEN_PROGRAM_ADDRESS
    );
    const token2022 = await readSourceAccount(
      rpc,
      OWNER,
      MINT,
      TOKEN_2022_PROGRAM_ADDRESS
    );

    // The wrong program address silently derives a different account, so this
    // is the guard that the caller's choice actually reaches the derivation.
    expect(classic.ata).not.toBe(token2022.ata);
  });
});
