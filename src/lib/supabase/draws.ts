import { hexToBytes } from "@noble/hashes/utils";
import { pickWinners } from "../draw/shuffle";
import { supabase } from "./client";
import { getPublicEvent, parseBaseUnits } from "./events";
import type { Database } from "./types";

/**
 * The public read side of `draws` (spec §5.3.3, §5.6) — what the verify page
 * consumes.
 *
 * `draws` has no DELETE policy and RLS grants `select … using (true)` to
 * `anon` (see the migration): every draw an event ever had is visible here,
 * abandoned ones included. That is deliberate — see `Verify.tsx`'s docstring.
 */
export type PublishedDrawRow = {
  amountPerWinner: string;
  blockhash: string | null;
  commit: string;
  commitSignature: string | null;
  commitSlot: number | null;
  createdAt: string;
  entriesRoot: string;
  entryHashes: string[];
  /**
   * Not a new leak: `getPublicEvent` already hands this out (Register.tsx
   * needs it for `entries.event_id`). It is the domain-separation salt in
   * `hashEntry`, not a secret — exposing it is what lets this page's "check
   * my entry" box hash an address the same way the draw itself did.
   */
  eventId: string;
  id: string;
  revealSignature: string | null;
  revealedSeed: string | null;
  status: Database["public"]["Enums"]["draw_status"];
  targetSlot: number;
  /**
   * The winning entry HASHES, recomputed here from public columns —
   * NEVER read off `winner_entry_ids`. That column stores internal database
   * ids, meaningful only to the creator (who can also read `entries` and so
   * knows which wallet each id belongs to); anon cannot read `entries` at
   * all, so an id would be useless to a public verifier anyway.
   *
   * Running the production shuffle (`pickWinners`, `shuffle.ts`) here, and
   * `verifyDraw`'s independently written reimplementation on the page, is
   * what makes check 5 meaningful rather than circular: two different pieces
   * of code have to agree, not one piece of code agreeing with itself.
   *
   * `null` before reveal (no seed/blockhash to shuffle with yet), and for a
   * draw whose on-chain record is otherwise unusable.
   */
  winners: string[] | null;
  winnersCount: number;
};

function computeWinners(row: {
  blockhash: string | null;
  entryHashes: string[];
  revealedSeed: string | null;
  winnersCount: number;
}): string[] | null {
  if (
    row.blockhash === null ||
    row.revealedSeed === null ||
    row.entryHashes.length === 0
  ) {
    return null;
  }
  try {
    return pickWinners(
      row.entryHashes,
      row.winnersCount,
      hexToBytes(row.revealedSeed),
      row.blockhash
    );
  } catch {
    // A malformed record (e.g. an odd-length seed) must not take the whole
    // page down — it just can't be verified, which `Verify.tsx` already has
    // a state for.
    return null;
  }
}

/**
 * Every draw an event has ever had, oldest attempts included.
 *
 * Resolves the slug to an event through the same public read Register.tsx
 * uses, then reads `draws` — the two RLS-public tables this whole page is
 * built on. An unknown slug reads as "no draws", identically to a real event
 * that simply hasn't run one yet: neither is sensitive here the way it is on
 * the registration page, since a slug with nothing to verify says nothing
 * about whether it exists.
 */
export async function listPublicDraws(
  slug: string
): Promise<PublishedDrawRow[]> {
  const event = await getPublicEvent(slug);
  if (event === null) return [];

  const { data, error } = await supabase
    .from("draws")
    .select(
      "amount:amount_per_winner::text, blockhash:chain_blockhash, commit:seed_commit, commit_signature, commit_slot, created_at, entries_root, entry_hashes, id, reveal_signature, revealed_seed, status, target_slot, winners_count"
    )
    .eq("event_id", event.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  return data.map((row) => ({
    amountPerWinner: parseBaseUnits(row.amount).toString(),
    blockhash: row.blockhash,
    commit: row.commit,
    commitSignature: row.commit_signature,
    commitSlot: row.commit_slot,
    createdAt: row.created_at,
    entriesRoot: row.entries_root,
    entryHashes: row.entry_hashes,
    eventId: event.id,
    id: row.id,
    revealSignature: row.reveal_signature,
    revealedSeed: row.revealed_seed,
    status: row.status,
    targetSlot: row.target_slot,
    winners: computeWinners({
      blockhash: row.blockhash,
      entryHashes: row.entry_hashes,
      revealedSeed: row.revealed_seed,
      winnersCount: row.winners_count,
    }),
    winnersCount: row.winners_count,
  }));
}
