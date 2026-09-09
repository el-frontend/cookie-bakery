import {
  sequentialInstructionPlan,
  type Address,
  type ClientWithGetMinimumBalance,
  type InstructionPlan,
  type TransactionSigner,
} from "@solana/kit";
import {
  AuthorityType,
  getCreateMintInstructionPlan,
  getMintToATAInstructionPlanAsync,
  getSetAuthorityInstruction,
  TOKEN_2022_PROGRAM_ADDRESS,
} from "@solana-program/token-2022";
import { buildMintExtensions, type MintExtensionOptions } from "./sizing";

/**
 * The Bake instruction plan for a Token-2022 mint with metadata (RF-02.3).
 *
 * Assembled from the program client's own plans rather than by hand:
 *
 * - `getCreateMintInstructionPlan` emits createAccount → extension pre-inits →
 *   initializeMint → extension post-inits (which is where
 *   `initializeTokenMetadata` lives). It also allocates the pre-initialize size
 *   while funding the full rent-bearing size, so the metadata realloc is paid
 *   for.
 * - `getMintToATAInstructionPlanAsync` derives the ATA with the right token
 *   program, creates it idempotently and mints the supply.
 *
 * Revocations are appended last: the supply must exist before the mint
 * authority can be given up.
 */

export type CreateToken2022Input = {
  /** Creator wallet: fee payer, mint authority, metadata update authority. */
  authority: TransactionSigner;
  decimals: number;
  /** Freshly generated keypair for the mint account. Must sign. */
  mint: TransactionSigner;
  mintCloseAuthority: boolean;
  name: string;
  revokeFreezeAuthority: boolean;
  revokeMintAuthority: boolean;
  /** Initial supply in base units, already scaled by 10^decimals. */
  supply: bigint;
  symbol: string;
  transferFee: { basisPoints: number; maximumFee: bigint } | null;
  uri: string;
};

export function extensionsFor(
  input: CreateToken2022Input
): ReturnType<typeof buildMintExtensions> {
  const options: MintExtensionOptions = {
    authority: input.authority.address,
    mint: input.mint.address,
    mintCloseAuthority: input.mintCloseAuthority,
    name: input.name,
    symbol: input.symbol,
    transferFee: input.transferFee,
    uri: input.uri,
  };
  return buildMintExtensions(options);
}

/**
 * Instructions that give up an authority after the initial mint.
 *
 * The freeze authority is SET at initialization and revoked here rather than
 * simply never being set. That costs one extra instruction, but it makes the
 * revocation observable in the transaction and keeps both revocations on the
 * same code path — which is what AC-02.6 checks.
 */
function revocationInstructions(input: CreateToken2022Input, mint: Address) {
  const instructions = [];

  if (input.revokeMintAuthority) {
    instructions.push(
      getSetAuthorityInstruction(
        {
          authorityType: AuthorityType.MintTokens,
          newAuthority: null,
          owned: mint,
          owner: input.authority,
        },
        { programAddress: TOKEN_2022_PROGRAM_ADDRESS }
      )
    );
  }

  if (input.revokeFreezeAuthority) {
    instructions.push(
      getSetAuthorityInstruction(
        {
          authorityType: AuthorityType.FreezeAccount,
          newAuthority: null,
          owned: mint,
          owner: input.authority,
        },
        { programAddress: TOKEN_2022_PROGRAM_ADDRESS }
      )
    );
  }

  return instructions;
}

export async function buildCreateToken2022Plan(
  client: ClientWithGetMinimumBalance,
  input: CreateToken2022Input
): Promise<InstructionPlan> {
  const mint = input.mint.address;

  const createMint = await getCreateMintInstructionPlan(client, {
    decimals: input.decimals,
    extensions: extensionsFor(input),
    // Set even when the user asked to revoke it — the revocation below needs an
    // authority to give up, and leaves it null on-chain either way.
    freezeAuthority: input.authority.address,
    mintAuthority: input.authority,
    newMint: input.mint,
    payer: input.authority,
  });

  const mintToAta = await getMintToATAInstructionPlanAsync(
    {
      amount: input.supply,
      decimals: input.decimals,
      mint,
      mintAuthority: input.authority,
      owner: input.authority.address,
      payer: input.authority,
    },
    { tokenProgram: TOKEN_2022_PROGRAM_ADDRESS }
  );

  return sequentialInstructionPlan([
    createMint,
    mintToAta,
    ...revocationInstructions(input, mint),
  ]);
}
