import { getAddMemoInstruction } from "@solana-program/memo";
import type {
  ClientWithRpc,
  ClientWithTransactionSending,
  GetSignatureStatusesApi,
} from "@solana/kit";

/**
 * On-chain attestation of a draw's commit and its reveal (spec §5.1, §5.3.3).
 *
 * This is the load-bearing half of the whole "provably fair" claim. The
 * database can say anything — it is our own — so the thing an outsider can
 * actually check is a memo transaction on CookieScan: the commit memo's
 * SLOT (not its timestamp, not a claim we make) has to be strictly before
 * `target_slot`, which proves the creator fixed their secret seed and the
 * frozen entry list before the slot whose hash decides the outcome even
 * existed. `verifyDraw` runs that comparison; this module is what puts a
 * number on chain for it to compare against.
 *
 * Two independent things happen here, and callers must not confuse them:
 *   - `commitMemo`/`revealMemo` are pure string builders — no I/O, fully
 *     unit-testable, and the only place the wire format is defined.
 *   - `sendAttestation` is the one function that actually touches the chain.
 *     It is the only thing in this file that "consumes the Kit client".
 */

/**
 * Wire budget for a memo transaction: a legacy transaction is capped at 1232
 * bytes, and after the signature, the transaction message header, the fee
 * payer account, the memo program id and its account metadata, this is what
 * is left for the memo string itself, with a small safety margin. Both memo
 * shapes below stay far under it with real-sized fields — this constant
 * exists so a future field addition has something concrete to check against
 * before it ships, not because either builder needs to truncate today.
 */
export const MEMO_MAX_BYTES = 566;

/**
 * The commit memo (spec §5.3.3).
 *
 * Published once, before `target_slot` exists, over a mint the creator has
 * no reason yet to control the outcome of — the seed is committed (hashed,
 * never revealed) and the entry list is frozen (`entriesRoot`) before the
 * entropy source exists. `v1` is not decoration: a verifier reading this
 * five format-changes from now needs to know which shape it is parsing
 * before it splits the string on `:`.
 */
export function commitMemo(input: {
  commit: string;
  drawId: string;
  entriesRoot: string;
  targetSlot: bigint;
}): string {
  return [
    "cookie-bakery",
    "draw-commit",
    "v1",
    input.drawId,
    input.commit,
    input.targetSlot.toString(),
    input.entriesRoot,
  ].join(":");
}

/**
 * The reveal memo.
 *
 * Publishes the seed in the open (the commit already bound it) plus the
 * target block's real blockhash — the two inputs `verifyDraw` needs to
 * redo the shuffle — and the winners root, so a verifier can confirm the
 * winner list itself without re-deriving it from the full entry list first.
 */
export function revealMemo(input: {
  blockhash: string;
  drawId: string;
  seed: string;
  winnersRoot: string;
}): string {
  return [
    "cookie-bakery",
    "draw-reveal",
    "v1",
    input.drawId,
    input.seed,
    input.blockhash,
    input.winnersRoot,
  ].join(":");
}

/**
 * What `sendAttestation` needs from the app's client: enough to send a
 * transaction and then ask the chain which slot that signature landed in.
 * A structural subset of `AppClient` (`src/providers.tsx`) rather than that
 * type itself — same pattern as `estimateAirdropCost`'s
 * `ClientWithGetMinimumBalance` — so this module stays testable with a
 * plain object and does not pull the whole client-typing chain into `lib/`.
 */
export type AttestationClient = ClientWithTransactionSending &
  ClientWithRpc<GetSignatureStatusesApi>;

export type Attestation = {
  signature: string;
  slot: bigint;
};

/**
 * Send one memo transaction and confirm the slot it landed in.
 *
 * `client.sendTransaction` takes bare instructions, never a pre-built
 * message, so the planner fetches a fresh blockhash at the moment this is
 * sent (CLAUDE.md § Airdrop batching) — on Cookie Chain a blockhash can
 * expire while a human reads the wallet prompt, and a message built earlier
 * would carry a stale one.
 *
 * A successful send's result carries the signature at `context.signature`
 * (`ClientWithTransactionSending`'s documented shape) — but never a slot.
 * That is precisely the number this whole feature needs, so this makes one
 * more call, `getSignatureStatuses`, the one RPC method that reports the
 * slot a specific signature was actually processed in. Two RPC round trips,
 * not one, is the cost of being able to prove anything afterwards.
 *
 * Throws if the chain confirms the transaction but somehow reports no slot
 * for it — callers must never fall back to writing `null` or `0` in that
 * case, either of which would make `verifyDraw`'s timing check either
 * un-runnable or silently wrong instead of honestly absent.
 */
export async function sendAttestation(
  client: AttestationClient,
  memo: string
): Promise<Attestation> {
  const instruction = getAddMemoInstruction({ memo });
  const { context } = await client.sendTransaction([instruction]);

  const { value } = await client.rpc
    .getSignatureStatuses([context.signature])
    .send();
  const slot = value[0]?.slot;
  if (slot === undefined) {
    throw new Error(
      "Cookie Chain confirmed the memo but did not report the slot it landed in."
    );
  }

  return { signature: context.signature, slot };
}
