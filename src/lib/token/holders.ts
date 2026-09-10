import {
  fetchEncodedAccounts,
  type Address,
  type GetMultipleAccountsApi,
  type GetTokenLargestAccountsApi,
  type Rpc,
} from "@solana/kit";
import { getTokenDecoder } from "@solana-program/token-2022";
import {
  DasUnavailableError,
  getTokenAccounts,
  type DasOptions,
} from "../chain/das";
import {
  chunk,
  mapWithConcurrency,
  CHUNK_SIZE,
  MAX_CONCURRENCY,
} from "../airdrop/probeAtas";

/**
 * Who holds a token, from the DAS when it answers and from the RPC when it
 * does not (RF-04.2).
 *
 * Both sources are normalised to one `Holder`, but they are NOT equivalent and
 * the difference cost real work to paper over:
 *
 * - The DAS returns `owner` alongside the token account. Ordered by `amount`
 *   descending (verified 2026-09-10), so a top-20 is one request.
 * - `getTokenLargestAccounts` returns exactly 20 **token account** addresses
 *   with amounts, and **no owners at all**. A holders table keyed by token
 *   account is close to useless to a human, so the fallback decodes those 20
 *   accounts to recover the owner. One extra `getMultipleAccounts` for the
 *   fallback path buys a table that reads the same as the DAS one.
 *
 * Percentages are computed in bigint and only narrowed to `number` at the very
 * end. `Number(amount) / Number(supply)` looks fine and silently breaks: both
 * sides exceed 2^53 for any token with 9 decimals and a real supply.
 */

export type HolderSource = "das" | "rpc";

export type Holder = {
  /** The token account. */
  account: Address;
  amount: bigint;
  /** Null only when the account could not be decoded. */
  owner: Address | null;
  /** Share of supply, 0–100. Display only — never fed back into arithmetic. */
  percent: number;
};

export type HoldersResult = {
  holders: Holder[];
  /** Which source answered, so the UI can say so. */
  source: HolderSource;
  /** Holder count for the whole mint. Null when only the RPC answered — it
   * returns the top 20 and cannot say how many exist beyond them. */
  total: number | null;
};

/**
 * Percentage of supply with four decimal places, computed entirely in bigint.
 *
 * Scaling by 1e6 before the division keeps four decimals of a percentage
 * without either operand ever becoming a float.
 */
export function percentOfSupply(amount: bigint, supply: bigint): number {
  if (supply <= 0n) return 0;
  return Number((amount * 1_000_000n) / supply) / 10_000;
}

function withPercent(
  holders: readonly Omit<Holder, "percent">[],
  supply: bigint
): Holder[] {
  return holders.map((holder) => ({
    ...holder,
    percent: percentOfSupply(holder.amount, supply),
  }));
}

/** Descending by amount, with the token account as a stable tiebreak. */
export function sortHolders<T extends { account: Address; amount: bigint }>(
  holders: readonly T[]
): T[] {
  return [...holders].sort((a, b) => {
    if (a.amount === b.amount) return a.account < b.account ? -1 : 1;
    return b.amount > a.amount ? 1 : -1;
  });
}

/**
 * Recover owners for token accounts the RPC named but did not attribute.
 *
 * A decode failure is not fatal: the row still has an account and an amount,
 * which is more useful than dropping the holder entirely, so the owner just
 * stays null and the table shows the account instead.
 */
async function ownersOf(
  rpc: Rpc<GetMultipleAccountsApi>,
  accounts: readonly Address[]
): Promise<Map<string, Address>> {
  const owners = new Map<string, Address>();
  if (accounts.length === 0) return owners;

  const batches = chunk(accounts, CHUNK_SIZE);
  const fetched = await mapWithConcurrency(batches, MAX_CONCURRENCY, (batch) =>
    fetchEncodedAccounts(rpc, batch)
  );

  for (const account of fetched.flat()) {
    if (!account.exists) continue;
    try {
      owners.set(account.address, getTokenDecoder().decode(account.data).owner);
    } catch {
      // Not a token account, or a layout this decoder does not know. Leave it
      // unattributed rather than guessing an owner.
    }
  }

  return owners;
}

export async function holdersFromRpc(
  rpc: Rpc<GetTokenLargestAccountsApi & GetMultipleAccountsApi>,
  mint: Address,
  supply: bigint
): Promise<HoldersResult> {
  const { value } = await rpc.getTokenLargestAccounts(mint).send();
  const accounts = value.map((entry) => entry.address);
  const owners = await ownersOf(rpc, accounts);

  const holders = sortHolders(
    value.map((entry) => ({
      account: entry.address,
      amount: BigInt(entry.amount),
      owner: owners.get(entry.address) ?? null,
    }))
  );

  return { holders: withPercent(holders, supply), source: "rpc", total: null };
}

export async function fetchHolders(
  rpc: Rpc<GetTokenLargestAccountsApi & GetMultipleAccountsApi>,
  mint: Address,
  supply: bigint,
  options: { dasOptions?: DasOptions; limit?: number } = {}
): Promise<HoldersResult> {
  const { dasOptions, limit = 20 } = options;

  try {
    const page = await getTokenAccounts({ limit, mint, page: 1 }, dasOptions);
    // Sorted again on our side rather than trusted: the ordering is a verified
    // property of today's server, not a contract it promised to keep.
    const holders = sortHolders(
      page.accounts.map((account) => ({
        account: account.address,
        amount: account.amount,
        owner: account.owner,
      }))
    );
    return {
      holders: withPercent(holders, supply),
      source: "das",
      total: page.total,
    };
  } catch (error) {
    if (!(error instanceof DasUnavailableError)) throw error;
    // The whole reason DasUnavailableError exists: keep the screen working.
    return holdersFromRpc(rpc, mint, supply);
  }
}
