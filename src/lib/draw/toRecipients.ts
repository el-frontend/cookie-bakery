import { isAddress, type Address } from "@solana/kit";
import type { Recipient } from "../airdrop/buildPlan";

/**
 * The join between events and the airdrop engine that already exists.
 *
 * `Recipient` is the exact type `buildAirdropInstructions` consumes, so an
 * event is simply another SOURCE of the recipient list, alongside the CSV.
 * Batching, simulation, progress, pause and retry are inherited unchanged.
 *
 * Every function here re-validates addresses even though they came out of our
 * own database. A row in `entries` was written by an anonymous visitor through
 * the public page, so it is untrusted input by definition.
 */

export type DrawnEntry = {
  entryId: string;
  hash: string;
  walletAddress: string;
};

export type ManualSelection = {
  amount: bigint;
  entryId: string;
  walletAddress: string;
};

function toAddress(walletAddress: string): Address {
  if (!isAddress(walletAddress)) {
    throw new RangeError(`"${walletAddress}" is not a valid base58 address.`);
  }
  return walletAddress;
}

export function toRecipients(
  winners: readonly string[],
  entries: readonly DrawnEntry[],
  amountPerWinner: bigint
): Recipient[] {
  if (amountPerWinner <= 0n) {
    throw new RangeError("The amount per winner must be greater than zero.");
  }
  const byHash = new Map(entries.map((entry) => [entry.hash, entry]));
  return winners.map((hash) => {
    const entry = byHash.get(hash);
    if (entry === undefined) {
      // The frozen list and the published winners are not from the same draw.
      throw new RangeError(`Unknown winner hash ${hash} — lists do not match.`);
    }
    return {
      address: toAddress(entry.walletAddress),
      amount: amountPerWinner,
    };
  });
}

export function selectionToRecipients(
  selection: readonly ManualSelection[]
): Recipient[] {
  if (selection.length === 0) {
    throw new RangeError("Select at least one recipient.");
  }
  const seen = new Set<string>();
  return selection.map((row) => {
    if (row.amount <= 0n) {
      throw new RangeError("Every amount must be greater than zero.");
    }
    if (seen.has(row.walletAddress)) {
      throw new RangeError(`Duplicate recipient ${row.walletAddress}.`);
    }
    seen.add(row.walletAddress);
    return { address: toAddress(row.walletAddress), amount: row.amount };
  });
}

/**
 * Split a pool so the parts sum to EXACTLY the pool.
 *
 * The remainder goes one base unit at a time to the first recipients rather
 * than being rounded away per row: rounding down would leave dust unsent, and
 * rounding up would try to send more than the creator has.
 */
export function splitPool(pool: bigint, count: number): bigint[] {
  if (!Number.isInteger(count) || count <= 0) {
    throw new RangeError(`Need at least one recipient, got ${count}.`);
  }
  const size = BigInt(count);
  if (pool < size) {
    throw new RangeError(
      `A pool of ${pool} base units cannot be split among ${count} recipients.`
    );
  }
  const base = pool / size;
  const remainder = Number(pool % size);
  return Array.from({ length: count }, (_, i) =>
    i < remainder ? base + 1n : base
  );
}
