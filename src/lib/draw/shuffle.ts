import { sha256 } from "@noble/hashes/sha2";
import { utf8ToBytes } from "@noble/hashes/utils";
import { canonicalOrder } from "./hashEntry";

/**
 * The deterministic core of the draw (spec §5.3).
 *
 * Every value here is derived, never sampled: given the seed, the blockhash
 * and the entry list, anyone recomputes the same winners. That is the whole
 * claim the feature makes, so this file has no access to time, randomness or
 * the network.
 */

/** 32 bytes of entropy neither side alone controls. */
export function finalSeed(seed: Uint8Array, blockhash: string): Uint8Array {
  // The blockhash goes in as its base58 STRING — the one you read off
  // CookieScan — so a person can verify a draw by hand from the explorer.
  const tail = utf8ToBytes(blockhash);
  const buffer = new Uint8Array(seed.length + tail.length);
  buffer.set(seed, 0);
  buffer.set(tail, seed.length);
  return sha256(buffer);
}

const BLOCK_SIZE = 32;
const WORD_SIZE = 4;
const TWO_POW_32 = 0x1_0000_0000;

/**
 * SHA-256 in counter mode as an endless stream of 32-bit words.
 *
 * A counter-mode PRF rather than a fixed buffer because rejection sampling has
 * no upper bound on how many words it consumes — a pre-sized buffer would have
 * to either throw or fall back to biased sampling when it ran dry.
 */
export class DrawRandom {
  readonly #seed: Uint8Array;
  #block: Uint8Array = new Uint8Array(0);
  #offset = BLOCK_SIZE;
  #counter = 0;

  constructor(seed: Uint8Array) {
    this.#seed = seed;
  }

  #nextWord(): number {
    if (this.#offset + WORD_SIZE > this.#block.length) {
      const input = new Uint8Array(this.#seed.length + WORD_SIZE);
      input.set(this.#seed, 0);
      new DataView(input.buffer).setUint32(
        this.#seed.length,
        this.#counter,
        false
      );
      this.#block = sha256(input);
      this.#offset = 0;
      this.#counter += 1;
    }
    const b = this.#block;
    const o = this.#offset;
    this.#offset += WORD_SIZE;
    return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
  }

  /**
   * Uniform in [0, n) by REJECTION SAMPLING.
   *
   * `word % n` would be biased whenever n does not divide 2^32 — the low
   * remainders would come up more often, which for a giveaway means some
   * participants are quietly likelier to win. Discarding the short tail above
   * the last whole multiple of n removes that.
   */
  below(n: number): number {
    if (!Number.isInteger(n) || n <= 0) {
      throw new RangeError(`below(n) needs a positive integer, got ${n}`);
    }
    const limit = Math.floor(TWO_POW_32 / n) * n;
    let word = this.#nextWord();
    while (word >= limit) word = this.#nextWord();
    return word % n;
  }
}

/** Fisher-Yates, backwards. Returns a new array. */
export function shuffle<T>(items: readonly T[], rng: DrawRandom): T[] {
  const out = [...items];
  for (let i = out.length - 1; i >= 1; i--) {
    const j = rng.below(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The winners of one draw, as entry hashes.
 *
 * Orders canonically FIRST, so the result cannot be steered by the order the
 * list happens to arrive in.
 */
export function pickWinners(
  entryHashes: readonly string[],
  count: number,
  seed: Uint8Array,
  blockhash: string
): string[] {
  if (entryHashes.length === 0) {
    throw new RangeError("A draw needs at least one entry.");
  }
  const ordered = canonicalOrder(entryHashes);
  const rng = new DrawRandom(finalSeed(seed, blockhash));
  return shuffle(ordered, rng).slice(0, Math.min(count, ordered.length));
}
