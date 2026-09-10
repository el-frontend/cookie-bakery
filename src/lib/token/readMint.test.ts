import { describe, expect, it } from "vitest";
import { getAddressDecoder, type Address } from "@solana/kit";
import {
  getMintEncoder,
  TOKEN_2022_PROGRAM_ADDRESS,
  type Extension,
  type ExtensionArgs,
} from "@solana-program/token-2022";
import { TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { MintError } from "./inspectMint";
import {
  describeExtension,
  extensionSummaries,
  readMint,
  readOnChainMetadata,
} from "./readMint";

const decoder = getAddressDecoder();
function seeded(seed: number, salt = 1): Address {
  const bytes = new Uint8Array(32);
  bytes[0] = salt;
  bytes[1] = seed & 0xff;
  bytes[2] = (seed >> 8) & 0xff;
  return decoder.decode(bytes);
}

const MINT = seeded(1, 9);
const AUTHORITY = seeded(2, 9);
const DELEGATE = seeded(3, 9);
const HOOK = seeded(4, 9);

function mintBytes(args: {
  decimals?: number;
  extensions?: ExtensionArgs[] | null;
  freezeAuthority?: Address | null;
  mintAuthority?: Address | null;
  supply?: bigint;
}): Uint8Array {
  return new Uint8Array(
    getMintEncoder().encode({
      decimals: args.decimals ?? 6,
      extensions: args.extensions ?? null,
      freezeAuthority: args.freezeAuthority ?? null,
      isInitialized: true,
      mintAuthority: args.mintAuthority ?? null,
      supply: args.supply ?? 1_000_000_000n,
    })
  );
}

/** getAccountInfo stub. `null` data means the account does not exist. */
function rpcWith(
  account: { data: Uint8Array; owner: Address } | null
): Parameters<typeof readMint>[0] {
  return {
    getAccountInfo: () => ({
      send: async () => ({
        context: { slot: 1n },
        value: account
          ? {
              data: [Buffer.from(account.data).toString("base64"), "base64"],
              executable: false,
              lamports: 1_461_600n,
              owner: account.owner,
              rentEpoch: 0n,
              space: BigInt(account.data.length),
            }
          : null,
      }),
    }),
  } as never;
}

describe("readMint", () => {
  it("lanza legible si la cuenta no existe", async () => {
    await expect(readMint(rpcWith(null), MINT)).rejects.toThrow(MintError);
    await expect(readMint(rpcWith(null), MINT)).rejects.toThrow(
      /No account at that address/
    );
  });

  it("rechaza un owner inesperado sin decodificar", async () => {
    // Deliberately valid mint BYTES under the wrong owner: if the owner check
    // ran after the decode, this would succeed and the app would derive
    // associated accounts against a program that does not hold this mint.
    const rpc = rpcWith({
      data: mintBytes({}),
      owner: seeded(99, 5),
    });

    await expect(readMint(rpc, MINT)).rejects.toThrow(
      /not a token mint|another program/
    );
  });

  it("reporta mint authority revocada como null", async () => {
    const rpc = rpcWith({
      data: mintBytes({ freezeAuthority: null, mintAuthority: null }),
      owner: TOKEN_2022_PROGRAM_ADDRESS,
    });

    const details = await readMint(rpc, MINT);

    expect(details.minting).toEqual({ address: null, revoked: true });
    expect(details.freeze).toEqual({ address: null, revoked: true });
  });

  it("distingue una autoridad vigente de una revocada", async () => {
    const rpc = rpcWith({
      data: mintBytes({ freezeAuthority: null, mintAuthority: AUTHORITY }),
      owner: TOKEN_2022_PROGRAM_ADDRESS,
    });

    const details = await readMint(rpc, MINT);

    expect(details.minting).toEqual({ address: AUTHORITY, revoked: false });
    expect(details.freeze.revoked).toBe(true);
  });

  it("lista las extensiones activas", async () => {
    const rpc = rpcWith({
      data: mintBytes({
        extensions: [
          { __kind: "NonTransferable" },
          { __kind: "MintCloseAuthority", closeAuthority: AUTHORITY },
        ],
        mintAuthority: AUTHORITY,
      }),
      owner: TOKEN_2022_PROGRAM_ADDRESS,
    });

    const details = await readMint(rpc, MINT);

    expect(details.extensionSummaries.map((e) => e.kind)).toEqual([
      "NonTransferable",
      "MintCloseAuthority",
    ]);
    expect(details.extensionSummaries[0].label).toBe("Non-transferable");
  });

  it("un mint clásico sin extensiones da una lista vacía, no un fallo", async () => {
    const rpc = rpcWith({
      data: mintBytes({ mintAuthority: AUTHORITY }),
      owner: TOKEN_PROGRAM_ADDRESS,
    });

    const details = await readMint(rpc, MINT);

    expect(details.program).toBe("token");
    expect(details.extensionSummaries).toEqual([]);
    expect(details.onChainMetadata).toBeNull();
  });

  it("formatea el supply con los decimales del mint", async () => {
    const rpc = rpcWith({
      data: mintBytes({ decimals: 9, supply: 1_500_000_000n }),
      owner: TOKEN_2022_PROGRAM_ADDRESS,
    });

    const details = await readMint(rpc, MINT);

    expect(details.supply).toBe(1_500_000_000n);
    expect(details.supplyFormatted).toBe("1.5");
  });
});

describe("readOnChainMetadata", () => {
  it("extrae nombre, símbolo y uri de la extensión TokenMetadata", () => {
    const extension = {
      __kind: "TokenMetadata",
      additionalMetadata: new Map([["twitter", "@bakery"]]),
      mint: MINT,
      name: "Bakery Cookie",
      symbol: "BAKE",
      updateAuthority: { __option: "Some", value: AUTHORITY },
      uri: "https://example.com/meta.json",
    } as unknown as Extension;

    const metadata = readOnChainMetadata([extension]);

    expect(metadata).toMatchObject({
      name: "Bakery Cookie",
      symbol: "BAKE",
      updateAuthority: AUTHORITY,
      uri: "https://example.com/meta.json",
    });
    expect(metadata?.additional).toEqual([["twitter", "@bakery"]]);
  });

  it("devuelve null cuando el mint no lleva metadata on-chain", () => {
    expect(
      readOnChainMetadata([{ __kind: "NonTransferable" } as Extension])
    ).toBeNull();
  });

  it("no sanea el texto — eso es trabajo de metadata.ts al renderizar", () => {
    const extension = {
      __kind: "TokenMetadata",
      additionalMetadata: new Map(),
      mint: MINT,
      name: "<img src=x onerror=alert(1)>",
      symbol: "X",
      updateAuthority: { __option: "None" },
      uri: "",
    } as unknown as Extension;

    // One sanitiser, applied at render, shared with the remote JSON. Two
    // implementations would drift.
    expect(readOnChainMetadata([extension])?.name).toBe(
      "<img src=x onerror=alert(1)>"
    );
  });
});

describe("describeExtension", () => {
  it("explica lo que cuesta una transfer fee", () => {
    const summary = describeExtension(
      {
        __kind: "TransferFeeConfig",
        newerTransferFee: {
          maximumFee: 5_000_000n,
          transferFeeBasisPoints: 100,
        },
      } as unknown as Extension,
      6
    );

    // "Transfer fee" alone never tells a holder they lose 1% of every send.
    expect(summary.label).toBe("Transfer fee");
    expect(summary.detail).toBe("1.00% per transfer, capped at 5");
  });

  it("nombra al delegado permanente porque puede mover tokens ajenos", () => {
    const summary = describeExtension(
      {
        __kind: "PermanentDelegate",
        delegate: { __option: "Some", value: DELEGATE },
      } as unknown as Extension,
      6
    );

    expect(summary.detail).toContain(DELEGATE);
    expect(summary.detail).toContain("any holder");
  });

  it("nombra el programa del transfer hook", () => {
    const summary = describeExtension(
      {
        __kind: "TransferHook",
        programId: { __option: "Some", value: HOOK },
      } as unknown as Extension,
      6
    );

    expect(summary.detail).toContain(HOOK);
  });

  it("no oculta una extensión que no conoce", () => {
    // Hiding an unknown extension would under-report what the token can do.
    const summary = describeExtension(
      { __kind: "SomethingBrandNew" } as unknown as Extension,
      6
    );

    expect(summary.kind).toBe("SomethingBrandNew");
    expect(summary.label).toBe("SomethingBrandNew");
  });
});

describe("extensionSummaries", () => {
  it("conserva el orden de la cuenta", () => {
    const list = extensionSummaries(
      [
        { __kind: "ImmutableOwner" },
        { __kind: "NonTransferable" },
      ] as unknown as Extension[],
      6
    );

    expect(list.map((e) => e.kind)).toEqual([
      "ImmutableOwner",
      "NonTransferable",
    ]);
  });
});
