import { percentOfSupply, type Holder } from "./holders";
import { truncateAddress } from "../format/address";

/**
 * Turn a holder list into the slices the distribution chart draws (RF-04.5).
 *
 * All arithmetic stays in `bigint` until the very last step. The "Others"
 * bucket is `supply - sum(top N)`, and both sides of that subtraction routinely
 * exceed 2^53 for a token with 9 decimals.
 *
 * ## Why "Others" can come out negative, and what happens then
 *
 * The supply is read from the mint account and the holders come from the DAS,
 * which are two different reads at two different slots. A transfer landing
 * between them, a stale index, or a token whose supply was burned after the
 * index was built can all leave `sum(top N) > supply`. The honest answer is
 * then "there is nothing left over", so the bucket is dropped rather than drawn
 * as a negative slice or, worse, an `Math.abs`-ed positive one that silently
 * invents supply nobody holds.
 */

/** The PRD's split: ten named holders, everything else aggregated. */
export const TOP_N = 10;

export type DistributionSlice = {
  /** Base units. */
  amount: bigint;
  /** True for the aggregate bucket — it is not a holder and is drawn apart. */
  isOthers: boolean;
  /** Stable key for React and for the chart's data rows. */
  key: string;
  /** Short label for the axis. */
  label: string;
  /** 0–100. Display only. */
  percent: number;
};

/** Address of the holder a slice represents, preferring the owner. */
function holderKey(holder: Holder): string {
  return holder.owner ?? holder.account;
}

export function buildDistribution(
  holders: readonly Holder[],
  supply: bigint,
  topN: number = TOP_N
): DistributionSlice[] {
  const top = [...holders]
    .sort((a, b) => (b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : 0))
    .slice(0, Math.max(0, topN));

  const slices: DistributionSlice[] = top.map((holder) => {
    const key = holderKey(holder);
    return {
      amount: holder.amount,
      isOthers: false,
      key,
      label: truncateAddress(key, 4, 4),
      percent: percentOfSupply(holder.amount, supply),
    };
  });

  const held = top.reduce((sum, holder) => sum + holder.amount, 0n);
  const remainder = supply - held;

  // Only a genuinely positive remainder becomes a slice. See the note above.
  if (remainder > 0n) {
    slices.push({
      amount: remainder,
      isOthers: true,
      key: "__others__",
      label: "Others",
      percent: percentOfSupply(remainder, supply),
    });
  }

  return slices;
}

/**
 * Share of supply held by the top `n` holders, as a percentage.
 *
 * The single most useful number on the screen: "the top 10 hold 98%" says more
 * about a token than any individual row.
 */
export function concentration(
  holders: readonly Holder[],
  supply: bigint,
  n: number = TOP_N
): number {
  const held = [...holders]
    .sort((a, b) => (b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : 0))
    .slice(0, Math.max(0, n))
    .reduce((sum, holder) => sum + holder.amount, 0n);

  return Math.min(100, percentOfSupply(held, supply));
}
