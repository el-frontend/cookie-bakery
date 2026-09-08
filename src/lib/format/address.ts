/**
 * Truncates a base58 address for display: `CookieAddr1111` → `Cook…1111`.
 *
 * Returns the address unchanged when truncating would not actually shorten it,
 * so short strings never gain a misleading ellipsis.
 */
export function truncateAddress(
  address: string,
  lead = 4,
  tail = 4,
  ellipsis = "…"
): string {
  if (lead < 0 || tail < 0) {
    throw new RangeError("lead and tail must be non-negative");
  }
  if (address.length <= lead + tail + ellipsis.length) {
    return address;
  }
  return `${address.slice(0, lead)}${ellipsis}${address.slice(-tail)}`;
}
