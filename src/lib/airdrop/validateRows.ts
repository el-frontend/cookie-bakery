import { isAddress, type Address } from "@solana/kit";
import { toBaseUnits } from "../token/bakeForm";
import type { CsvRow } from "./parseCsv";

/**
 * Row validation for the airdrop list (RF-03.2).
 *
 * Every amount becomes a bigint in the mint's base units here and stays one
 * from this point on. Doing the conversion once, at the edge, is what keeps
 * floating point out of a transfer: 1e9 tokens at 9 decimals is 1e18 base
 * units, and Number stops being exact at 2^53.
 *
 * `isAddress` rather than `address()` because this runs over up to 1,000 rows
 * and a thrown-and-caught exception per bad row is the slow path.
 */

export type RowIssue =
  | "amount-not-a-number"
  | "amount-too-precise"
  | "amount-zero-or-negative"
  | "duplicate"
  | "invalid-address"
  | "missing-field";

export type RowError = {
  issue: RowIssue;
  line: number;
  message: string;
  rawAddress: string;
};

export type ValidRow = {
  address: Address;
  /** Base units, already scaled by the mint's decimals. */
  amount: bigint;
  line: number;
};

export type ValidationResult = {
  /** Lines that repeat an address seen earlier, keyed by that address. */
  duplicates: Map<Address, number[]>;
  errors: RowError[];
  /** Sum of every valid row, in base units. */
  total: bigint;
  valid: ValidRow[];
};

export function validateRows(
  rows: readonly CsvRow[],
  decimals: number
): ValidationResult {
  const errors: RowError[] = [];
  const valid: ValidRow[] = [];
  const duplicates = new Map<Address, number[]>();
  const firstSeen = new Map<string, number>();
  let total = 0n;

  for (const row of rows) {
    const { line, rawAddress, rawAmount } = row;

    if (rawAddress === "" || rawAmount === "") {
      errors.push({
        issue: "missing-field",
        line,
        message: "This line needs both an address and an amount.",
        rawAddress,
      });
      continue;
    }

    if (!isAddress(rawAddress)) {
      errors.push({
        issue: "invalid-address",
        line,
        message: "Not a valid base58 address.",
        rawAddress,
      });
      continue;
    }

    let amount: bigint;
    try {
      amount = toBaseUnits(rawAmount, decimals);
    } catch (error) {
      const tooPrecise =
        error instanceof RangeError && error.message.includes("decimal places");
      errors.push({
        issue: tooPrecise ? "amount-too-precise" : "amount-not-a-number",
        line,
        message: tooPrecise
          ? `This mint has ${decimals} decimals, so the amount cannot be more precise.`
          : "Not a positive number.",
        rawAddress,
      });
      continue;
    }

    if (amount <= 0n) {
      errors.push({
        issue: "amount-zero-or-negative",
        line,
        message: "Amount must be greater than zero.",
        rawAddress,
      });
      continue;
    }

    // A duplicate is flagged, not dropped: the user decides whether to merge.
    const seenAt = firstSeen.get(rawAddress);
    if (seenAt === undefined) {
      firstSeen.set(rawAddress, line);
    } else {
      const lines = duplicates.get(rawAddress) ?? [seenAt];
      lines.push(line);
      duplicates.set(rawAddress, lines);
      errors.push({
        issue: "duplicate",
        line,
        message: `This address already appears on line ${seenAt}.`,
        rawAddress,
      });
    }

    valid.push({ address: rawAddress, amount, line });
    total += amount;
  }

  return { duplicates, errors, total, valid };
}

/** True when nothing blocks execution. Duplicates block until merged. */
export function canExecute(result: ValidationResult): boolean {
  return result.errors.length === 0 && result.valid.length > 0;
}
