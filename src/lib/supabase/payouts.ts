import { parseBaseUnits } from "./events";
import { supabase } from "./client";

/**
 * The `payouts` table is a MIRROR of the chain, never the ledger (spec §2
 * rule 3): "El servidor no es la fuente de verdad del dinero." Supabase
 * records intent and what this app observed; only a signature on Cookie
 * Chain is proof a transfer happened. Every function here is written so a
 * missing or wiped row can never be misread as "nothing was paid" — see
 * `summarise`'s `knownIncomplete`.
 */

/** One row as read back from `payouts`, amount already through `parseBaseUnits`. */
export type PayoutRow = {
  /** Base units, as text — cast with `::text` per `parseBaseUnits`'s doc. */
  amount: string;
  entryId: string;
  /** Null until the executor reports a signature for this recipient's batch. */
  signature: string | null;
};

/**
 * Enough to mirror a confirmed batch back into `payouts` once the executor
 * reports a signature (Airdrop.tsx does this from its `onBatch` hook).
 */
export type PayoutEventContext = {
  drawId: string | null;
  /** Wallet address (as it appears on a `Recipient`) -> `entries.id`. */
  entryIdByAddress: Record<string, string>;
  eventId: string;
};

/**
 * A row is "confirmed" ONLY once it carries a signature. A row without one is
 * intent, not proof — treating it as paid is exactly the failure mode rule 3
 * exists to rule out: a send that failed after the row was written would
 * otherwise render as money that moved.
 */
export function payoutState(row: {
  signature: string | null;
}): "confirmed" | "unconfirmed" {
  return row.signature ? "confirmed" : "unconfirmed";
}

export type PayoutSummary = {
  confirmed: number;
  /**
   * True whenever this list cannot be trusted as the whole story. Today that
   * is exactly the empty case: an empty `payouts` table is indistinguishable
   * from "nothing was ever sent" UNLESS the caller also checks the chain, so
   * the UI must show this as a visible note (pointing at CookieScan) rather
   * than rendering a silent zero.
   */
  knownIncomplete: boolean;
  /** Base units actually confirmed on chain — never counts a pending row. */
  paidBaseUnits: bigint;
  unconfirmed: number;
};

export function summarise(rows: readonly PayoutRow[]): PayoutSummary {
  let confirmed = 0;
  let unconfirmed = 0;
  let paidBaseUnits = 0n;

  for (const row of rows) {
    if (payoutState(row) === "confirmed") {
      confirmed += 1;
      paidBaseUnits += parseBaseUnits(row.amount);
    } else {
      unconfirmed += 1;
    }
  }

  return {
    confirmed,
    knownIncomplete: rows.length === 0,
    paidBaseUnits,
    unconfirmed,
  };
}

/** Every payout row recorded for one event, oldest first. */
export async function listPayouts(eventId: string): Promise<PayoutRow[]> {
  const { data, error } = await supabase
    .from("payouts")
    .select("amount:amount::text, entry_id, signature")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data.map((row) => ({
    amount: row.amount,
    entryId: row.entry_id,
    signature: row.signature,
  }));
}

/**
 * Write a bigint into a `numeric` column without ever routing it through a
 * JS `number` — same trick as `runDraw.ts`'s `asNumeric`. The generated
 * `Insert` type declares `amount` as `number` (a type-generator gap, not a
 * real `number`); Postgres parses a numeric literal from a JSON string just
 * as well as from a JS number, so the string is what should reach the wire.
 */
function asNumeric(value: bigint): number {
  return value.toString() as unknown as number;
}

/**
 * Mirror one confirmed batch into `payouts`, one row per recipient.
 *
 * Called only after the executor already reports a signature — never before,
 * and never for a failed batch. A recipient with no known `entries.id` (not
 * expected, but the map comes from an outside caller) is skipped rather than
 * failing the whole insert.
 */
export async function recordPayouts(input: {
  drawId: string | null;
  eventId: string;
  recipients: readonly { amount: bigint; entryId: string }[];
  signature: string;
}): Promise<void> {
  if (input.recipients.length === 0) return;
  const { error } = await supabase.from("payouts").insert(
    input.recipients.map((recipient) => ({
      amount: asNumeric(recipient.amount),
      draw_id: input.drawId,
      entry_id: recipient.entryId,
      event_id: input.eventId,
      signature: input.signature,
      status: "confirmed",
    }))
  );
  if (error) throw new Error(error.message);
}
