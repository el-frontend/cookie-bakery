import {
  formatDecimalFixedPoint,
  lamportsToSol,
  type Lamports,
} from "@solana/kit";

/**
 * COOK is the Cookie Chain native token: 9 decimals, same lamport arithmetic
 * as SOL, so Kit's helpers apply unchanged.
 *
 * Never divide by 1e9. Lamport counts exceed Number.MAX_SAFE_INTEGER at ~9M
 * COOK, and float division silently corrupts the value past that point — the
 * balance would quietly disagree with the wallet.
 */
export const COOK_SYMBOL = "COOK";

const DEFAULT_FORMATTER = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 9,
});

/** Formats a lamport amount as a COOK figure, e.g. `1,234.56789`. */
export function formatCook(
  amount: Lamports,
  formatter: Intl.NumberFormat = DEFAULT_FORMATTER
): string {
  return formatDecimalFixedPoint(formatter, lamportsToSol(amount));
}

/** Formats with the unit appended, e.g. `1,234.56789 COOK`. */
export function formatCookWithSymbol(
  amount: Lamports,
  formatter?: Intl.NumberFormat
): string {
  return `${formatCook(amount, formatter)} ${COOK_SYMBOL}`;
}
