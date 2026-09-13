import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import { sha256 } from "@noble/hashes/sha2";
import { parseBaseUnits } from "../supabase/events";
import { supabase } from "../supabase/client";
import type { Database } from "../supabase/types";
import { canonicalOrder, entriesRoot } from "./hashEntry";
import { pickWinners } from "./shuffle";
import type { DrawnEntry } from "./toRecipients";

/**
 * Commit and reveal, driven from the creator's browser (spec §5.1).
 *
 * No server logic: the seed is generated here, its hash is published, and the
 * seed itself goes to `draw_secrets` where RLS lets only this creator read it
 * back. So the promise is the creator's to their audience, and believing the
 * draw requires trusting nobody — not even us.
 *
 * The on-chain commit/reveal MEMO transactions are Task 13's work, not this
 * file's — `commit_slot`, `commit_signature` and `reveal_signature` stay null
 * through everything here, and nothing below assumes they are set.
 */

/**
 * Write a bigint into a `numeric` column without ever routing it through a
 * JS `number`.
 *
 * The generated `Database` type declares `amount_per_winner` as `number` for
 * BOTH `Row` and `Insert` — the generator does not distinguish "PostgREST
 * hands this back as a rounded double" (see `parseBaseUnits`) from "the
 * driver can serialize whatever is here." The latter is true: Postgres
 * parses a numeric literal from a JSON string exactly as well as from a JS
 * number, so the string form is what should actually reach the wire. The
 * cast documents that this is a type-generator gap, not a real `number`.
 */
function asNumeric(value: bigint): number {
  return value.toString() as unknown as number;
}

/** ~1 minute at ~400 ms per slot. The drum roll, and the anti-grinding lead. */
export const TARGET_SLOT_LEAD = 150n;

/**
 * The slot whose (not-yet-existing) hash the draw will use.
 *
 * Every "provably fair" claim the product makes rests on this number coming
 * from a slot that DOES NOT EXIST YET at commit time — never from a slot at
 * or before `currentSlot`, or the creator could look at the outcome before
 * fixing the entry list and seed commitment.
 */
export function targetSlotFor(currentSlot: bigint): bigint {
  return currentSlot + TARGET_SLOT_LEAD;
}

/** Whether the chain has produced the target slot yet. Nothing may bypass this. */
export function canReveal(input: {
  currentSlot: bigint;
  targetSlot: bigint;
}): boolean {
  return input.currentSlot >= input.targetSlot;
}

export async function commitDraw(input: {
  amountPerWinner: bigint;
  currentSlot: bigint;
  entries: readonly DrawnEntry[];
  eventId: string;
  winnersCount: number;
}): Promise<{
  commit: string;
  drawId: string;
  entriesRoot: string;
  orderedHashes: string[];
  targetSlot: bigint;
}> {
  const seed = crypto.getRandomValues(new Uint8Array(32));
  const commit = bytesToHex(sha256(seed));
  const orderedHashes = canonicalOrder(input.entries.map((e) => e.hash));
  const root = entriesRoot(orderedHashes);
  const targetSlot = targetSlotFor(input.currentSlot);

  const { data, error } = await supabase
    .from("draws")
    .insert({
      amount_per_winner: asNumeric(input.amountPerWinner),
      entries_root: root,
      entry_hashes: orderedHashes,
      event_id: input.eventId,
      seed_commit: commit,
      target_slot: Number(targetSlot),
      winners_count: input.winnersCount,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const secret = await supabase
    .from("draw_secrets")
    .insert({ draw_id: data.id, seed: bytesToHex(seed) });
  if (secret.error) throw new Error(secret.error.message);

  return {
    commit,
    drawId: data.id as string,
    entriesRoot: root,
    orderedHashes,
    targetSlot,
  };
}

/**
 * Resolve winning hashes back to the entries that produced them.
 *
 * The one piece of genuinely new logic in this file — everything else is a
 * direct RPC/DB call — so it is exported and unit-tested on its own rather
 * than only exercised indirectly through `revealDraw`.
 *
 * Throws rather than dropping a winner: a hash `pickWinners` returned that is
 * not in `entries` means the frozen entry list and the winners came from two
 * different draws, and paying out here would pay whoever happened to line up
 * with the wrong hash.
 */
export function resolveWinnerEntryIds(
  winners: readonly string[],
  entries: readonly DrawnEntry[]
): string[] {
  const byHash = new Map(entries.map((entry) => [entry.hash, entry]));
  return winners.map((hash) => {
    const entry = byHash.get(hash);
    if (entry === undefined) {
      throw new RangeError(`Unknown winner hash ${hash} — lists do not match.`);
    }
    return entry.entryId;
  });
}

export async function revealDraw(input: {
  blockhash: string;
  drawId: string;
  entries: readonly DrawnEntry[];
  orderedHashes: readonly string[];
  seed: Uint8Array;
  winnersCount: number;
}): Promise<{ winnerEntryIds: string[]; winners: string[] }> {
  const winners = pickWinners(
    input.orderedHashes,
    input.winnersCount,
    input.seed,
    input.blockhash
  );

  // The payout (Task 14) and the event summary both read the ids, so resolve
  // them here rather than re-deriving the mapping at every call site.
  const winnerEntryIds = resolveWinnerEntryIds(winners, input.entries);

  const { error } = await supabase
    .from("draws")
    .update({
      chain_blockhash: input.blockhash,
      revealed_seed: bytesToHex(input.seed),
      status: "revealed",
      winner_entry_ids: winnerEntryIds,
    })
    .eq("id", input.drawId);
  if (error) throw new Error(error.message);

  return { winnerEntryIds, winners };
}

export type DrawRow = {
  amountPerWinner: bigint;
  chainBlockhash: string | null;
  drawId: string;
  entriesRoot: string;
  orderedHashes: string[];
  revealedSeed: string | null;
  seedCommit: string;
  status: Database["public"]["Tables"]["draws"]["Row"]["status"];
  targetSlot: bigint;
  winnerEntryIds: string[] | null;
  winnersCount: number;
};

/**
 * The most recent draw for an event, or `null` if none has been started.
 *
 * Reload-safe on purpose: a creator refreshing mid-wait (or an audience
 * member's browser tab surviving a whole livestream) must land back on
 * whichever state — setup, waiting or revealed — the database actually holds,
 * never back on "setup" just because local component state was lost.
 *
 * `amount_per_winner` is cast to text in the select and run through
 * `parseBaseUnits` — see that function's docstring for why a plain select
 * would silently round the value.
 */
export async function getDrawForEvent(
  eventId: string
): Promise<DrawRow | null> {
  const { data, error } = await supabase
    .from("draws")
    .select(
      "amount:amount_per_winner::text, chain_blockhash, entries_root, entry_hashes, id, revealed_seed, seed_commit, status, target_slot, winner_entry_ids, winners_count"
    )
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data === null) return null;

  return {
    amountPerWinner: parseBaseUnits(data.amount),
    chainBlockhash: data.chain_blockhash,
    drawId: data.id,
    entriesRoot: data.entries_root,
    orderedHashes: data.entry_hashes,
    revealedSeed: data.revealed_seed,
    seedCommit: data.seed_commit,
    status: data.status,
    targetSlot: BigInt(data.target_slot),
    winnerEntryIds: data.winner_entry_ids,
    winnersCount: data.winners_count,
  };
}

/**
 * The creator's own seed back from `draw_secrets`.
 *
 * RLS (`draw_secrets_owner`) lets only the creator who wrote it read it back,
 * so this call is only ever meaningful from the creator's own signed-in
 * browser — never from the public verify page, which gets the seed from the
 * `revealed_seed` column on `draws` once it exists.
 */
export async function getDrawSeed(drawId: string): Promise<Uint8Array> {
  const { data, error } = await supabase
    .from("draw_secrets")
    .select("seed")
    .eq("draw_id", drawId)
    .single();
  if (error) throw new Error(error.message);
  return hexToBytes(data.seed);
}
