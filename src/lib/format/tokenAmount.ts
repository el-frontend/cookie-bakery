import { fromBaseUnits } from "../token/bakeForm";

/**
 * Group a token amount for reading (RF-04.6).
 *
 * `fromBaseUnits` is the EXACT representation and must stay that way: it feeds
 * the airdrop CSV export, where inserting thousands separators would put commas
 * inside a comma-separated field and shift every column after it. So grouping
 * is a separate, display-only step rather than a change to the exact formatter.
 *
 * Only the integer part is grouped. The fraction is passed through digit for
 * digit — `Intl.NumberFormat` on the whole value would go through `number` and
 * round away the tail of anything past 2^53, which is most supplies at nine
 * decimals.
 */

const GROUPER = new Intl.NumberFormat("en-US");

export function groupDigits(integer: string): string {
  const negative = integer.startsWith("-");
  const digits = negative ? integer.slice(1) : integer;
  if (!/^\d+$/.test(digits)) return integer;
  // BigInt keeps every digit; NumberFormat only ever sees an exact integer.
  return `${negative ? "-" : ""}${GROUPER.format(BigInt(digits))}`;
}

/** e.g. `1234567890n` at 6 decimals → `1,234.56789`. */
export function formatTokenAmount(amount: bigint, decimals: number): string {
  const exact = fromBaseUnits(amount, decimals);
  const [integer, fraction] = exact.split(".");
  return fraction
    ? `${groupDigits(integer)}.${fraction}`
    : groupDigits(integer);
}

/** Amount with the symbol appended, when there is one. */
export function formatTokenAmountWithSymbol(
  amount: bigint,
  decimals: number,
  symbol: string
): string {
  const formatted = formatTokenAmount(amount, decimals);
  return symbol ? `${formatted} ${symbol}` : formatted;
}
