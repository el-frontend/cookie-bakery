import { fromBaseUnits } from "../token/bakeForm";
import type { AirdropRun } from "../../store/airdropHistory";

/**
 * Export the outcome of an airdrop as CSV (RF-03.8).
 *
 * One row per RECIPIENT, not per batch: the person reading this wants to know
 * whether a particular wallet got its tokens, and which signature proves it.
 * A batch-level export makes them do that join by hand.
 *
 * Every field is escaped, because the error column carries chain messages that
 * routinely contain commas, quotes and newlines — an unescaped one silently
 * shifts every later column, which is worse than no export at all.
 */

export const CSV_HEADER = "address,amount,status,signature,error";

/**
 * RFC 4180 escaping: wrap in quotes when the value contains a comma, a quote,
 * a newline or a carriage return, and double any embedded quote.
 */
export function escapeCsvField(value: string): string {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

export type ExportRow = {
  address: string;
  amount: string;
  error: string;
  signature: string;
  status: string;
};

export function rowsForRun(run: AirdropRun): ExportRow[] {
  const rows: ExportRow[] = [];

  for (const batch of run.batches) {
    for (const recipient of batch.recipients) {
      rows.push({
        address: recipient.address,
        amount: fromBaseUnits(BigInt(recipient.amount), run.decimals),
        error: batch.status === "failed" ? (batch.error ?? "") : "",
        signature: batch.signature ?? "",
        status: batch.status,
      });
    }
  }

  return rows;
}

export function exportRunToCsv(run: AirdropRun): string {
  const lines = [CSV_HEADER];

  for (const row of rowsForRun(run)) {
    lines.push(
      [row.address, row.amount, row.status, row.signature, row.error]
        .map(escapeCsvField)
        .join(",")
    );
  }

  return lines.join("\n");
}

/** Filename that sorts usefully and names the mint it belongs to. */
export function exportFilename(run: AirdropRun): string {
  const day = run.startedAt.slice(0, 10);
  return `airdrop-${run.symbol || "token"}-${day}.csv`;
}
