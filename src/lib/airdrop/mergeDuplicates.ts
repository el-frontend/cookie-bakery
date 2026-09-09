import type { Address } from "@solana/kit";
import type { ValidRow } from "./validateRows";

/**
 * Duplicate merging for the airdrop list (RF-03.3).
 *
 * Amounts are summed as bigint. The source lines are kept so the table can
 * show WHY a recipient's figure differs from any single line of the file the
 * user pasted — a merge that silently changes a number is how someone sends
 * twice what they meant to.
 */

export type MergedRow = {
  address: Address;
  amount: bigint;
  /** The line this row is reported at — the first occurrence. */
  line: number;
  /** Every original line folded into this row, in file order. */
  sourceLines: number[];
};

export function mergeDuplicates(rows: readonly ValidRow[]): MergedRow[] {
  const byAddress = new Map<Address, MergedRow>();

  for (const row of rows) {
    const existing = byAddress.get(row.address);
    if (existing === undefined) {
      byAddress.set(row.address, {
        address: row.address,
        amount: row.amount,
        line: row.line,
        sourceLines: [row.line],
      });
      continue;
    }
    existing.amount += row.amount;
    existing.sourceLines.push(row.line);
  }

  // Map preserves insertion order, so the result keeps file order.
  return [...byAddress.values()];
}

/** Rows that actually absorbed another line. */
export function mergedRowsOnly(rows: readonly MergedRow[]): MergedRow[] {
  return rows.filter((row) => row.sourceLines.length > 1);
}

export function totalOf(rows: readonly MergedRow[]): bigint {
  return rows.reduce((sum, row) => sum + row.amount, 0n);
}
