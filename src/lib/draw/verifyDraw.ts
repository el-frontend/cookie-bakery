import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils";
import { canonicalOrder, entriesRoot as computeRoot } from "./hashEntry";

/**
 * Independent verification of a published draw (spec §5.3.3).
 *
 * Deliberately does NOT import `pickWinners`. A verifier that shares its
 * implementation with the thing it verifies only proves the code is
 * self-consistent — it would pass a draw whose shuffle was subtly wrong. The
 * shuffle below is a second, hand-written implementation of the same spec.
 *
 * Returns every failure rather than the first, so the public page can tell
 * someone exactly what does not add up instead of one symptom at a time.
 */

export type PublishedDraw = {
  blockhash: string;
  commit: string;
  /** Slot the commit memo transaction landed in. */
  commitSlot: number;
  entriesRoot: string;
  entryHashes: readonly string[];
  revealedSeed: string;
  targetSlot: number;
  winners: readonly string[];
  winnersCount: number;
};

export type VerifyFailure =
  | "commit-mismatch"
  | "commit-not-before-target"
  | "not-canonical-order"
  | "root-mismatch"
  | "winners-count-mismatch"
  | "winners-mismatch";

export type VerifyResult =
  { ok: true } | { failures: VerifyFailure[]; ok: false };

const TWO_POW_32 = 0x1_0000_0000;

/**
 * Second implementation of the counter-mode word stream.
 *
 * Written as a generator rather than the `DrawRandom` class in `shuffle.ts`
 * on purpose: same algorithm, different code, so the two implementations
 * cannot share a bug by sharing a line of source.
 */
function* words(seed: Uint8Array): Generator<number> {
  for (let counter = 0; ; counter++) {
    const input = new Uint8Array(seed.length + 4);
    input.set(seed, 0);
    new DataView(input.buffer).setUint32(seed.length, counter, false);
    const block = sha256(input);
    for (let o = 0; o + 4 <= block.length; o += 4) {
      yield ((block[o] << 24) |
        (block[o + 1] << 16) |
        (block[o + 2] << 8) |
        block[o + 3]) >>>
        0;
    }
  }
}

function recomputeWinners(
  ordered: readonly string[],
  seedHex: string,
  blockhash: string,
  count: number
): string[] {
  const seed = hexToBytes(seedHex);
  const tail = utf8ToBytes(blockhash);
  const mixed = new Uint8Array(seed.length + tail.length);
  mixed.set(seed, 0);
  mixed.set(tail, seed.length);

  const stream = words(sha256(mixed));
  const below = (n: number): number => {
    const limit = Math.floor(TWO_POW_32 / n) * n;
    let word = stream.next().value as number;
    while (word >= limit) word = stream.next().value as number;
    return word % n;
  };

  const out = [...ordered];
  for (let i = out.length - 1; i >= 1; i--) {
    const j = below(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.slice(0, Math.min(count, out.length));
}

export function verifyDraw(draw: PublishedDraw): VerifyResult {
  const failures: VerifyFailure[] = [];

  if (bytesToHex(sha256(hexToBytes(draw.revealedSeed))) !== draw.commit) {
    failures.push("commit-mismatch");
  }

  // On-chain and independent of any database timestamp: the commit must have
  // landed before the target slot existed, or the seed was never fixed
  // ahead of the entropy it is supposed to be combined with.
  if (draw.commitSlot >= draw.targetSlot) {
    failures.push("commit-not-before-target");
  }

  const ordered = canonicalOrder(draw.entryHashes);
  if (ordered.join("\n") !== draw.entryHashes.join("\n")) {
    failures.push("not-canonical-order");
  }

  if (computeRoot(draw.entryHashes) !== draw.entriesRoot) {
    failures.push("root-mismatch");
  }

  const expectedCount = Math.min(draw.winnersCount, ordered.length);
  if (draw.winners.length !== expectedCount) {
    failures.push("winners-count-mismatch");
  }

  const recomputed = recomputeWinners(
    ordered,
    draw.revealedSeed,
    draw.blockhash,
    draw.winnersCount
  );
  if (recomputed.join("\n") !== draw.winners.join("\n")) {
    failures.push("winners-mismatch");
  }

  return failures.length === 0 ? { ok: true } : { failures, ok: false };
}
