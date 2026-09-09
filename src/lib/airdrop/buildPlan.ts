import type {
  Address,
  ClientWithGetMinimumBalance,
  Instruction,
  TransactionSigner,
} from "@solana/kit";
import {
  getCreateAssociatedTokenIdempotentInstruction,
  getTokenSize,
  getTransferCheckedInstruction,
} from "@solana-program/token-2022";
import type { AtaProbe } from "./probeAtas";

/**
 * Turn a validated recipient list into instructions and a price (RF-03.6).
 *
 * Deliberately PURE: it takes the ATA probe results rather than a client, so
 * the whole instruction shape is testable without a chain. Handing the result
 * to `client.planTransactions` — which refreshes the blockhash and sizes the
 * batches — is the executor's job (RF-03.7), not this module's.
 *
 * `createAssociatedTokenAccountIdempotent` is emitted ONLY for recipients the
 * probe found without an account, and it is the idempotent variant so a race
 * with someone else funding the same recipient mid-airdrop is a no-op instead
 * of a failed batch.
 */

/** Airdrop transactions carry one signature: the sender. */
export const LAMPORTS_PER_SIGNATURE = 5_000n;

/** PRD RT-05: batch size is configurable in this range, default 8. */
export const MIN_BATCH = 4;
export const MAX_BATCH = 12;
export const DEFAULT_BATCH = 8;

/**
 * With a new account to create, each recipient costs two instructions instead
 * of one, so the same byte budget holds fewer of them.
 */
export const DEFAULT_BATCH_WITH_NEW_ATAS = 6;

export type Recipient = {
  address: Address;
  /** Base units, already scaled by the mint's decimals. */
  amount: bigint;
};

export type BuildAirdropInput = {
  decimals: number;
  mint: Address;
  /** Probe results, one per recipient, in the same order. */
  probes: readonly AtaProbe[];
  recipients: readonly Recipient[];
  /** The sender's own token account. */
  source: Address;
  tokenProgram: Address;
  /** Sender wallet: fee payer and transfer authority. */
  authority: TransactionSigner;
};

export function buildAirdropInstructions({
  authority,
  decimals,
  mint,
  probes,
  recipients,
  source,
  tokenProgram,
}: BuildAirdropInput): Instruction[] {
  if (probes.length !== recipients.length) {
    throw new Error(
      `Probe list and recipient list disagree (${probes.length} vs ${recipients.length}).`
    );
  }

  const instructions: Instruction[] = [];

  recipients.forEach((recipient, index) => {
    const probe = probes[index];
    if (probe.owner !== recipient.address) {
      throw new Error(
        `Probe ${index} is for ${probe.owner}, not ${recipient.address}.`
      );
    }

    if (!probe.exists) {
      instructions.push(
        getCreateAssociatedTokenIdempotentInstruction(
          {
            ata: probe.ata,
            mint,
            owner: recipient.address,
            payer: authority,
          },
          { programAddress: undefined }
        )
      );
    }

    instructions.push(
      getTransferCheckedInstruction(
        {
          amount: recipient.amount,
          authority,
          decimals,
          destination: probe.ata,
          mint,
          source,
        },
        { programAddress: tokenProgram }
      )
    );
  });

  return instructions;
}

export type AirdropCost = {
  ataRent: bigint;
  fees: bigint;
  newAtaCount: bigint;
  total: bigint;
  transactionCount: number;
};

/**
 * Cost of the airdrop: rent for the accounts that have to be created, plus one
 * base fee per transaction. Recipients that already hold the token cost
 * nothing beyond their share of a transaction fee.
 */
export async function estimateAirdropCost(
  client: ClientWithGetMinimumBalance,
  probes: readonly AtaProbe[],
  transactionCount: number
): Promise<AirdropCost> {
  const newAtas = probes.filter((probe) => !probe.exists).length;
  const perAta =
    newAtas > 0 ? BigInt(await client.getMinimumBalance(getTokenSize())) : 0n;

  const ataRent = perAta * BigInt(newAtas);
  const fees = LAMPORTS_PER_SIGNATURE * BigInt(transactionCount);

  return {
    ataRent,
    fees,
    newAtaCount: BigInt(newAtas),
    total: ataRent + fees,
    transactionCount,
  };
}

/**
 * How many transactions a manual batching fallback would need.
 *
 * The planner normally decides this. This exists for the case the PRD calls
 * out — when per-batch UI control requires knowing the split up front — and
 * for showing a transaction count before anything is planned.
 */
export function batchCount(
  recipientCount: number,
  perBatch: number = DEFAULT_BATCH
): number {
  const size = Math.min(MAX_BATCH, Math.max(MIN_BATCH, perBatch));
  return Math.ceil(recipientCount / size);
}

/** Suggested batch size, smaller when accounts have to be created. */
export function suggestedBatchSize(probes: readonly AtaProbe[]): number {
  return probes.some((probe) => !probe.exists)
    ? DEFAULT_BATCH_WITH_NEW_ATAS
    : DEFAULT_BATCH;
}
