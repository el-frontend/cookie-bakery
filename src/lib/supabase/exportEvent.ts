import { escapeCsvField } from "../airdrop/exportCsv";
import { fromBaseUnits } from "../token/bakeForm";
import { computeWinners } from "./draws";
import { listEntries } from "./events";
import { listPayouts, payoutState } from "./payouts";
import { supabase } from "./client";
import type { Database } from "./types";

/**
 * Export everything a creator has for one event (spec §2 rule 4:
 * "Exportable siempre… Sin lock-in").
 *
 * This is the whole promise made good: if Supabase disappeared tomorrow, a
 * creator who ran this export still has their registrations and their draw's
 * proof — the on-chain memos and CookieScan outlive us either way, but this
 * file is what lets a HUMAN keep the record without needing us at all.
 *
 * The JSON half doubles as re-verification input: every `draws[]` entry
 * carries the same fields `verifyDraw` (`../draw/verifyDraw.ts`) consumes —
 * commit, revealed seed, blockhash, target slot, commit slot, the ordered
 * entry hashes and the winners (as hashes, exactly like the public verify
 * page — never wallet addresses, so this file can be handed to a third party
 * without also handing them the handle-to-wallet map). Dropping the seed or
 * the blockhash would leave a file that looks complete and proves nothing.
 *
 * `toExportCsv` and `toExportJson` are pure — no network, no `Date.now()` —
 * so they are fully unit-testable on a literal fixture, the same split
 * `../airdrop/exportCsv.ts` uses between building a string and downloading
 * it. This module deliberately stops at producing the two strings; the
 * `Blob` + `URL.createObjectURL` + `<a download>` dance that turns a string
 * into a saved file belongs to whichever screen wires up the button, exactly
 * as `Airdrop.tsx`'s `download()` helper does for the CSV export.
 */

export type EventExportEvent = {
  mint: string;
  mintDecimals: number;
  slug: string;
  title: string;
};

export type EventExportEntry = {
  createdAt: string;
  id: string;
  walletAddress: string;
};

/**
 * Every draw the event ever ran, abandoned attempts included — the same
 * "nothing disappears" rule `Verify.tsx` documents for the public page.
 *
 * Only `id`, `commit`, `revealedSeed`, `targetSlot` and `winners` are
 * required: those are the fields the Step-1 fixture supplies, and a draw
 * that never reached reveal genuinely has no seed, blockhash or winners yet.
 * The rest are present whenever the real query has them — `exportEvent`
 * always fills every field it can — but are optional here so a hand-built
 * bundle (tests, or a future partial export) does not have to fabricate
 * values it does not have.
 */
export type EventExportDraw = {
  blockhash: string | null;
  commit: string;
  commitSignature?: string | null;
  commitSlot?: number | null;
  entriesRoot?: string;
  entryHashes?: string[];
  id: string;
  revealedSeed: string | null;
  revealSignature?: string | null;
  status?: Database["public"]["Enums"]["draw_status"];
  targetSlot: number;
  /** Winning entry HASHES, never wallet addresses — see the module docstring. */
  winners: string[] | null;
  winnersCount?: number;
};

/** Only ever a CONFIRMED payout (`payoutState(row) === "confirmed"`) — see `payouts.ts`. */
export type EventExportPayout = {
  amount: string;
  entryId: string;
  signature: string;
};

export type EventExportBundle = {
  draws: EventExportDraw[];
  entries: EventExportEntry[];
  event: EventExportEvent;
  payouts: EventExportPayout[];
};

const CSV_HEADER = "address,registered_at,amount,signature";

/**
 * One row per (entry, payout) pair, following `exportCsv.ts`'s rule: a row
 * per RECIPIENT-and-result, not per draw or per batch, and one CSV row per
 * result rather than grouping amounts — see that file's docstring for why an
 * unescaped grouping separator would shift every later column.
 *
 * Every registrant appears at least once, whether or not they ever won —
 * dropping non-winners would silently turn "exportable always" into
 * "exportable only for the outcome that pleases us."
 */
export function toExportCsv(bundle: EventExportBundle): string {
  const lines = [CSV_HEADER];
  const decimals = bundle.event.mintDecimals;

  for (const entry of bundle.entries) {
    const payouts = bundle.payouts.filter((p) => p.entryId === entry.id);

    if (payouts.length === 0) {
      lines.push(
        [entry.walletAddress, entry.createdAt, "", ""]
          .map(escapeCsvField)
          .join(",")
      );
      continue;
    }

    for (const payout of payouts) {
      lines.push(
        [
          entry.walletAddress,
          entry.createdAt,
          fromBaseUnits(BigInt(payout.amount), decimals),
          payout.signature,
        ]
          .map(escapeCsvField)
          .join(",")
      );
    }
  }

  return lines.join("\n");
}

/**
 * The whole bundle, verbatim, as JSON — no field renaming, no summarising.
 * A reader who wants to re-run `verifyDraw` over `draws[i]` needs the exact
 * shape this produces, so reshaping it "for readability" would be exactly
 * the kind of lossy export rule 4 exists to rule out.
 */
export function toExportJson(bundle: EventExportBundle): string {
  return JSON.stringify(bundle, null, 2);
}

async function loadEvent(eventId: string): Promise<EventExportEvent> {
  const { data, error } = await supabase
    .from("events")
    .select("mint, mint_decimals, slug, title")
    .eq("id", eventId)
    .single();
  if (error) throw new Error(error.message);
  return {
    mint: data.mint,
    mintDecimals: data.mint_decimals,
    slug: data.slug,
    title: data.title,
  };
}

/**
 * Every draw for the event, oldest first, with full columns — including
 * `entry_hashes` and `commit_slot`, which the public verify page's query
 * (`listPublicDraws`) also reads for the same reason: without them, nobody
 * downstream of this export can redo the timing check or the shuffle.
 *
 * `amount_per_winner` is NOT selected here — the export cares about what
 * each recipient actually received, which lives in `payouts.amount` and
 * already goes through `parseBaseUnits`-safe handling in `listPayouts`.
 */
async function loadDraws(eventId: string): Promise<EventExportDraw[]> {
  const { data, error } = await supabase
    .from("draws")
    .select(
      "chain_blockhash, commit_signature, commit_slot, entries_root, entry_hashes, id, reveal_signature, revealed_seed, seed_commit, status, target_slot, winners_count"
    )
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  return data.map((row) => ({
    blockhash: row.chain_blockhash,
    commit: row.seed_commit,
    commitSignature: row.commit_signature,
    commitSlot: row.commit_slot,
    entriesRoot: row.entries_root,
    entryHashes: row.entry_hashes,
    id: row.id,
    revealedSeed: row.revealed_seed,
    revealSignature: row.reveal_signature,
    status: row.status,
    targetSlot: row.target_slot,
    winners: computeWinners({
      blockhash: row.chain_blockhash,
      entryHashes: row.entry_hashes,
      revealedSeed: row.revealed_seed,
      winnersCount: row.winners_count,
    }),
    winnersCount: row.winners_count,
  }));
}

/**
 * Assemble the full bundle for one event — everything `toExportCsv` and
 * `toExportJson` need, fetched with the same typed queries the rest of the
 * app uses (`listEntries`, `listPayouts`) rather than a parallel set of
 * ad-hoc selects, so a change to those tables' RLS or column casts is felt
 * here automatically instead of drifting out of sync.
 */
export async function loadExportBundle(
  eventId: string
): Promise<EventExportBundle> {
  const [event, entryRows, draws, payoutRows] = await Promise.all([
    loadEvent(eventId),
    listEntries(eventId),
    loadDraws(eventId),
    listPayouts(eventId),
  ]);

  return {
    draws,
    entries: entryRows.map((row) => ({
      createdAt: row.created_at,
      id: row.id,
      walletAddress: row.wallet_address,
    })),
    event,
    payouts: payoutRows
      .filter((row) => payoutState(row) === "confirmed")
      .map((row) => ({
        amount: row.amount,
        entryId: row.entryId,
        // Safe: `payoutState(row) === "confirmed"` already proved this is
        // not null (see `payouts.ts`'s docstring on what "confirmed" means).
        signature: row.signature as string,
      })),
  };
}

/**
 * The one function the creator panel calls. Fetches, then builds both
 * formats from the SAME bundle — so the CSV a creator opens in a spreadsheet
 * and the JSON they hand to someone re-verifying a draw can never disagree
 * about what happened.
 */
export async function exportEvent(
  eventId: string
): Promise<{ csv: string; json: string }> {
  const bundle = await loadExportBundle(eventId);
  return { csv: toExportCsv(bundle), json: toExportJson(bundle) };
}
