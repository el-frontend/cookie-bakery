import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import { sha256 } from "@noble/hashes/sha2";
import { parseBaseUnits } from "../supabase/events";
import { supabase } from "../supabase/client";
import type { Database } from "../supabase/types";
import {
  commitMemo,
  revealMemo,
  sendAttestation,
  type Attestation,
  type AttestationClient,
} from "./attest";
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
 * The on-chain commit/reveal MEMO transactions (Task 13, `./attest.ts`) are
 * wired in below. `commit_slot < target_slot` is the entire timing proof
 * `verifyDraw` checks, so `commitDraw` never lets a failed send disappear
 * silently — see its docstring — and `revealDraw` refuses outright to run
 * without a `commit_signature` already on the row.
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
  client: AttestationClient;
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

  // The row above is the real commitment — immutable from here on (the
  // `draws_commitments_immutable` trigger). Whether the memo that PROVES it
  // reaches CookieScan is a separate concern, and a failure here must not
  // unwind the insert above or bubble up as "the draw failed to start": the
  // draw did start, it just is not attested yet. `attestCommit` is exactly
  // the retry path for this state, and `DrawPanel` renders "not yet
  // attested" rather than the normal wait when `commit_signature` is still
  // null — see this file's docstring and `revealDraw`'s hard guard below,
  // which is what actually stops an unattested draw from being revealed.
  try {
    await attestCommit({
      client: input.client,
      commit,
      drawId: data.id as string,
      entriesRoot: root,
      targetSlot,
    });
  } catch {
    // Intentionally swallowed — see comment above.
  }

  return {
    commit,
    drawId: data.id as string,
    entriesRoot: root,
    orderedHashes,
    targetSlot,
  };
}

/**
 * Send (or resend) the commit memo for an existing draw and record where it
 * landed.
 *
 * Split out from `commitDraw` so a failed first attempt has a retry path
 * that does not re-insert a row: `seed_commit`, `target_slot` and
 * `entries_root` are immutable once written, so retrying can only ever mean
 * "get THIS memo on chain and record its slot," never "start over."
 *
 * `commit_slot` is stored as a JS `number` via `Number(attestation.slot)` —
 * the same convention `target_slot` already uses in `commitDraw` above.
 * This is a `bigint` Postgres column, not `numeric`, so the precision-loss
 * risk `parseBaseUnits`'s docstring warns about (arbitrary-size token
 * amounts) does not apply: a slot number is nowhere near
 * `Number.MAX_SAFE_INTEGER`.
 */
export async function attestCommit(input: {
  client: AttestationClient;
  commit: string;
  drawId: string;
  entriesRoot: string;
  targetSlot: bigint;
}): Promise<Attestation> {
  const memo = commitMemo({
    commit: input.commit,
    drawId: input.drawId,
    entriesRoot: input.entriesRoot,
    targetSlot: input.targetSlot,
  });
  const attestation = await sendAttestation(input.client, memo);

  const { error } = await supabase
    .from("draws")
    .update({
      commit_signature: attestation.signature,
      commit_slot: Number(attestation.slot),
    })
    .eq("id", input.drawId);
  if (error) throw new Error(error.message);

  return attestation;
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
  client: AttestationClient;
  /**
   * The draw's `commit_signature`, straight from `DrawRow`. `null` means the
   * commit memo never landed — revealing over an unattested commitment would
   * produce a draw nobody can verify (spec §5.1), which is worse than no
   * draw at all, so this throws rather than proceeding. `DrawPanel` disables
   * the Reveal button for the same reason, but that is UI, not a guarantee —
   * this is the actual guard.
   */
  commitSignature: string | null;
  drawId: string;
  entries: readonly DrawnEntry[];
  orderedHashes: readonly string[];
  seed: Uint8Array;
  winnersCount: number;
}): Promise<{ winnerEntryIds: string[]; winners: string[] }> {
  if (input.commitSignature === null) {
    throw new Error(
      "This draw has not been attested on chain yet — it cannot be revealed."
    );
  }

  const winners = pickWinners(
    input.orderedHashes,
    input.winnersCount,
    input.seed,
    input.blockhash
  );

  // The payout (Task 14) and the event summary both read the ids, so resolve
  // them here rather than re-deriving the mapping at every call site.
  const winnerEntryIds = resolveWinnerEntryIds(winners, input.entries);

  // Same shape as the commit: `entriesRoot` over the winning hashes, in the
  // order `pickWinners` returned them. `DrawPanel`'s revealed state recomputes
  // this identically, from persisted columns, for reload-safe display.
  const winnersRoot = entriesRoot(winners);
  const seedHex = bytesToHex(input.seed);

  // Unlike `commitDraw`, a failed send here is NOT swallowed: it must throw
  // and leave the row exactly as it was (still `committed`, attested), so a
  // retry re-enters this same function rather than the product silently
  // showing "revealed" winners with no on-chain reveal memo to check them
  // against.
  const attestation = await sendAttestation(
    input.client,
    revealMemo({
      blockhash: input.blockhash,
      drawId: input.drawId,
      seed: seedHex,
      winnersRoot,
    })
  );

  const { error } = await supabase
    .from("draws")
    .update({
      chain_blockhash: input.blockhash,
      reveal_signature: attestation.signature,
      revealed_seed: seedHex,
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
  /** `null` until the commit memo lands — the signal `DrawPanel` gates reveal on. */
  commitSignature: string | null;
  commitSlot: number | null;
  drawId: string;
  entriesRoot: string;
  orderedHashes: string[];
  revealedSeed: string | null;
  revealSignature: string | null;
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
      "amount:amount_per_winner::text, chain_blockhash, commit_signature, commit_slot, entries_root, entry_hashes, id, reveal_signature, revealed_seed, seed_commit, status, target_slot, winner_entry_ids, winners_count"
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
    commitSignature: data.commit_signature,
    commitSlot: data.commit_slot,
    drawId: data.id,
    entriesRoot: data.entries_root,
    orderedHashes: data.entry_hashes,
    revealedSeed: data.revealed_seed,
    revealSignature: data.reveal_signature,
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
