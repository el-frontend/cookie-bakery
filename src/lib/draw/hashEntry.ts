import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";

/**
 * Entry commitments for a verifiable draw (spec §5.3.2, §5.4).
 *
 * The draw runs over these hashes, never over addresses, so a published draw
 * can be re-checked by anyone without handing them the handle-to-wallet map.
 * A participant still verifies their own inclusion: they know their wallet, so
 * they can compute their hash and find it in the list.
 *
 * Synchronous on purpose. `crypto.subtle` is async and jsdom does not
 * reliably implement it, and an async hash would force the whole draw — and
 * every golden test of it — through promises for no benefit.
 */

/** A 0x00 separator, so ("ab","c") and ("a","bc") cannot collide. */
export function hashEntry(eventId: string, walletAddress: string): string {
  const left = utf8ToBytes(eventId);
  const right = utf8ToBytes(walletAddress);
  const buffer = new Uint8Array(left.length + 1 + right.length);
  buffer.set(left, 0);
  buffer[left.length] = 0x00;
  buffer.set(right, left.length + 1);
  return bytesToHex(sha256(buffer));
}

/**
 * Ascending, and NEVER insertion order: publishing a root for one ordering and
 * drawing over another is exactly the manipulation this is here to prevent.
 *
 * Lowercase hex sorts the same by code unit as by byte, since '0'–'9' (0x30)
 * all precede 'a'–'f' (0x61), so the default comparator is correct here.
 */
export function canonicalOrder(hashes: readonly string[]): string[] {
  return [...hashes].sort();
}

/** SHA-256 over the ordered hashes joined by \n, with no trailing newline. */
export function entriesRoot(orderedHashes: readonly string[]): string {
  return bytesToHex(sha256(utf8ToBytes(orderedHashes.join("\n"))));
}
