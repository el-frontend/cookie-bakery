import type { ClientWithGetMinimumBalance } from "@solana/kit";
import {
  extension,
  getMintSize,
  getTokenSize,
  type ExtensionArgs,
} from "@solana-program/token-2022";
import type { Address } from "@solana/kit";

/**
 * Mint sizing and the cost preview shown before signing (RF-02.2).
 *
 * Two sizes matter and they are NOT the same:
 *
 * - **allocated** — what `createAccount` reserves. Only extensions initialized
 *   *before* `initializeMint` count.
 * - **rentBearing** — what the account ends up at once `initializeTokenMetadata`
 *   reallocs it. Rent must cover THIS, or the realloc fails at execution time
 *   because the program will not fund it.
 *
 * `getCreateMintInstructionPlan` applies the same split internally; this module
 * exists to surface the breakdown for the UI, which the plan does not expose.
 */

/** Extensions the token program initializes only AFTER `initializeMint`. */
const POST_INITIALIZE_KINDS = new Set(["TokenMetadata", "TokenGroup"]);

/** Base fee per signature, in lamports. */
export const LAMPORTS_PER_SIGNATURE = 5_000n;

/**
 * Signatures on the Bake transaction: the creator wallet (fee payer and mint
 * authority) plus the freshly generated mint keypair.
 */
export const BAKE_SIGNATURE_COUNT = 2n;

export type MintExtensionOptions = {
  /** Address the metadata pointer targets — the mint itself. */
  mint: Address;
  /** Creator wallet: metadata update authority and extension authority. */
  authority: Address;
  name: string;
  symbol: string;
  uri: string;
  mintCloseAuthority: boolean;
  transferFee: { basisPoints: number; maximumFee: bigint } | null;
};

/**
 * The extension set for a Token-2022 mint with metadata.
 *
 * Order is irrelevant here — `getCreateMintInstructionPlan` splits pre- and
 * post-initialize extensions itself — but the TokenMetadata entry MUST be
 * present or its bytes go unfunded.
 */
export function buildMintExtensions(
  options: MintExtensionOptions
): ExtensionArgs[] {
  const extensions: ExtensionArgs[] = [
    extension("MetadataPointer", {
      authority: options.authority,
      metadataAddress: options.mint,
    }),
  ];

  if (options.transferFee) {
    const fee = {
      epoch: 0n,
      maximumFee: options.transferFee.maximumFee,
      transferFeeBasisPoints: options.transferFee.basisPoints,
    };
    extensions.push(
      extension("TransferFeeConfig", {
        newerTransferFee: fee,
        olderTransferFee: fee,
        transferFeeConfigAuthority: options.authority,
        withdrawWithheldAuthority: options.authority,
        withheldAmount: 0n,
      })
    );
  }

  if (options.mintCloseAuthority) {
    extensions.push(
      extension("MintCloseAuthority", { closeAuthority: options.authority })
    );
  }

  extensions.push(
    extension("TokenMetadata", {
      additionalMetadata: new Map<string, string>(),
      mint: options.mint,
      name: options.name,
      symbol: options.symbol,
      updateAuthority: options.authority,
      uri: options.uri,
    })
  );

  return extensions;
}

export type MintSpace = {
  /** Bytes `createAccount` reserves. */
  allocated: number;
  /** Bytes the account ends at, after the metadata realloc. */
  rentBearing: number;
};

/**
 * Split the extension list into the allocated and rent-bearing sizes.
 *
 * `getMintSize([])` returns 166, NOT the 82-byte base — an empty array still
 * encodes the TLV extension header. A classic SPL mint must be exactly 82 bytes
 * or the Token program rejects it, so an empty list must call `getMintSize()`
 * with no argument at all.
 */
export function computeMintSpace(extensions: ExtensionArgs[]): MintSpace {
  if (extensions.length === 0) {
    const base = getMintSize();
    return { allocated: base, rentBearing: base };
  }

  const preInitialize = extensions.filter(
    (e) => !POST_INITIALIZE_KINDS.has(e.__kind)
  );

  return {
    allocated:
      preInitialize.length === 0 ? getMintSize() : getMintSize(preInitialize),
    rentBearing: getMintSize(extensions),
  };
}

export type BakeCost = {
  ataRent: bigint;
  ataSpace: number;
  fee: bigint;
  mintRent: bigint;
  space: MintSpace;
  total: bigint;
};

/**
 * Total COOK the Bake transaction costs: rent for the mint at its final size,
 * rent for the creator's associated token account, and one base fee per
 * signature.
 */
export async function estimateBakeCost(
  client: ClientWithGetMinimumBalance,
  extensions: ExtensionArgs[]
): Promise<BakeCost> {
  const space = computeMintSpace(extensions);
  const ataSpace = getTokenSize();

  const [mintRent, ataRent] = await Promise.all([
    client.getMinimumBalance(space.rentBearing),
    client.getMinimumBalance(ataSpace),
  ]);

  const fee = LAMPORTS_PER_SIGNATURE * BAKE_SIGNATURE_COUNT;
  const mint = BigInt(mintRent);
  const ata = BigInt(ataRent);

  return {
    ataRent: ata,
    ataSpace,
    fee,
    mintRent: mint,
    space,
    total: mint + ata + fee,
  };
}

/** Whether the connected wallet can cover the transaction (AC-02.5). */
export function canAfford(balanceLamports: bigint, cost: BakeCost): boolean {
  return balanceLamports >= cost.total;
}
