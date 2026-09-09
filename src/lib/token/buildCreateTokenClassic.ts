import {
  sequentialInstructionPlan,
  type ClientWithGetMinimumBalance,
  type InstructionPlan,
  type TransactionSigner,
} from "@solana/kit";
import { TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import {
  AuthorityType,
  getCreateMintInstructionPlan,
  getMintToATAInstructionPlanAsync,
  getSetAuthorityInstruction,
} from "@solana-program/token-2022";

/**
 * Classic SPL Token fallback (RF-02.4).
 *
 * Same input contract as the Token-2022 builder, minus metadata and
 * extensions. The PRD keeps this path so a Token-2022 problem on Cookie Chain
 * cannot block the bounty deliverable.
 *
 * It reuses the Token-2022 plan builders retargeted at `TOKEN_PROGRAM_ADDRESS`:
 * `InitializeMint`, `MintTo` and `SetAuthority` share discriminators and data
 * layout across both programs — Token-2022 is a superset — and the builders
 * take a `tokenProgram`/`programAddress` override for exactly this purpose.
 *
 * Passing NO extensions matters: `getCreateMintInstructionPlan` then sizes the
 * account with `getMintSize()` and gets the bare 82-byte base. Handing it an
 * empty array instead would size it at 166 and the Token program would reject
 * the account.
 */

export type CreateTokenClassicInput = {
  /** Creator wallet: fee payer and mint authority. */
  authority: TransactionSigner;
  decimals: number;
  /** Freshly generated keypair for the mint account. Must sign. */
  mint: TransactionSigner;
  revokeFreezeAuthority: boolean;
  revokeMintAuthority: boolean;
  /** Initial supply in base units, already scaled by 10^decimals. */
  supply: bigint;
};

export async function buildCreateTokenClassicPlan(
  client: ClientWithGetMinimumBalance,
  input: CreateTokenClassicInput
): Promise<InstructionPlan> {
  const mint = input.mint.address;

  const createMint = await getCreateMintInstructionPlan(
    client,
    {
      decimals: input.decimals,
      freezeAuthority: input.authority.address,
      mintAuthority: input.authority,
      newMint: input.mint,
      payer: input.authority,
    },
    { tokenProgram: TOKEN_PROGRAM_ADDRESS }
  );

  const mintToAta = await getMintToATAInstructionPlanAsync(
    {
      amount: input.supply,
      decimals: input.decimals,
      mint,
      mintAuthority: input.authority,
      owner: input.authority.address,
      payer: input.authority,
    },
    { tokenProgram: TOKEN_PROGRAM_ADDRESS }
  );

  const revocations = [];
  if (input.revokeMintAuthority) {
    revocations.push(
      getSetAuthorityInstruction(
        {
          authorityType: AuthorityType.MintTokens,
          newAuthority: null,
          owned: mint,
          owner: input.authority,
        },
        { programAddress: TOKEN_PROGRAM_ADDRESS }
      )
    );
  }
  if (input.revokeFreezeAuthority) {
    revocations.push(
      getSetAuthorityInstruction(
        {
          authorityType: AuthorityType.FreezeAccount,
          newAuthority: null,
          owned: mint,
          owner: input.authority,
        },
        { programAddress: TOKEN_PROGRAM_ADDRESS }
      )
    );
  }

  return sequentialInstructionPlan([createMint, mintToAta, ...revocations]);
}
