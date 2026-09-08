import type { Address } from "@solana/kit";
import { useCookBalance } from "../hooks/useCookBalance";
import { COOK_SYMBOL, formatCook } from "../lib/format/lamports";

/** Live COOK balance for the connected account. */
export function CookBalance({ address }: { address: Address }) {
  const { error, isLoading, lamports } = useCookBalance(address);

  if (error) {
    return (
      <span
        data-testid="cook-balance"
        className="rounded-lg border border-border-low bg-cream px-3 py-2 text-xs text-muted"
      >
        Balance unavailable
      </span>
    );
  }

  return (
    <span
      data-testid="cook-balance"
      className="rounded-lg border border-border-low bg-cream px-3 py-2 font-mono text-xs"
    >
      {isLoading || lamports == null
        ? `— ${COOK_SYMBOL}`
        : `${formatCook(lamports)} ${COOK_SYMBOL}`}
    </span>
  );
}
