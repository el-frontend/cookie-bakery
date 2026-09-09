import {
  fetchEncodedAccounts,
  type Address,
  type GetMultipleAccountsApi,
  type Rpc,
} from "@solana/kit";
import { findAssociatedTokenPda } from "@solana-program/token-2022";

/**
 * Find out which recipients still need an associated token account (RF-03.5).
 *
 * This drives both the cost and the batch size: a recipient without an ATA
 * adds rent AND a second instruction, so a batch of transfers that all create
 * accounts is much closer to the 1,232-byte limit than one that does not.
 *
 * Two limits from the PRD are enforced here, not left to the caller:
 * getMultipleAccounts is chunked at 100 addresses (the RPC's own cap), and no
 * more than 4 of those requests are in flight at once — the community RPC is
 * shared and this app has no business saturating it.
 */

/** The RPC caps getMultipleAccounts at 100 addresses per call. */
export const CHUNK_SIZE = 100;

/** PRD §4: at most 4 simultaneous requests against the community RPC. */
export const MAX_CONCURRENCY = 4;

export type AtaProbe = {
  /** Derived associated token account for this recipient. */
  ata: Address;
  /** False when the account has to be created as part of the airdrop. */
  exists: boolean;
  owner: Address;
};

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/**
 * Run `worker` over `items` with at most `limit` in flight.
 *
 * Results keep the input order regardless of completion order — the caller
 * pairs them back up with recipients positionally.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function run(): Promise<void> {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }

  const runners = Array.from({ length: Math.min(limit, items.length) }, () =>
    run()
  );
  await Promise.all(runners);
  return results;
}

export async function probeAtas(
  rpc: Rpc<GetMultipleAccountsApi>,
  owners: readonly Address[],
  mint: Address,
  tokenProgram: Address
): Promise<AtaProbe[]> {
  if (owners.length === 0) return [];

  // Derived once, in input order, and never recomputed downstream.
  const atas = await Promise.all(
    owners.map(async (owner) => {
      const [ata] = await findAssociatedTokenPda({ mint, owner, tokenProgram });
      return ata;
    })
  );

  const batches = chunk(atas, CHUNK_SIZE);
  const fetched = await mapWithConcurrency(batches, MAX_CONCURRENCY, (batch) =>
    fetchEncodedAccounts(rpc, batch)
  );

  const flat = fetched.flat();
  return owners.map((owner, index) => ({
    ata: atas[index],
    exists: flat[index]?.exists === true,
    owner,
  }));
}

/** Recipients that need `createAssociatedTokenAccountIdempotent`. */
export function missingAtas(probes: readonly AtaProbe[]): AtaProbe[] {
  return probes.filter((probe) => !probe.exists);
}
