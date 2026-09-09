import { explorer } from "../lib/chain/explorer";
import { fromBaseUnits } from "../lib/token/bakeForm";
import { truncateAddress } from "../lib/format/address";
import type { MyToken } from "../store/myTokens";

/**
 * Shown once the mint is confirmed on-chain (RF-02.6).
 *
 * The mint address is rendered in full as well as linked: it is the one value
 * the user needs to keep, and the bounty submission asks for it.
 */
export function TokenResultCard({
  onBakeAnother,
  token,
}: {
  onBakeAnother: () => void;
  token: MyToken;
}) {
  return (
    <section
      aria-label="Token created"
      data-testid="token-result"
      className="pop-in space-y-4 rounded-xl border border-border-low bg-card p-6"
    >
      <div className="flex flex-col items-center gap-4 pb-2 text-center">
        <div className="flex h-[62px] w-[62px] items-center justify-center rounded-[20px] border border-success/30 bg-success/12">
          <svg
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
          >
            <path
              className="check-draw"
              d="M5 12.5l4.5 4.5L19 7.5"
              stroke="var(--success)"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="font-display text-[28px] font-bold tracking-[-0.03em]">
            {token.name} is live
          </p>
          <p className="text-sm text-ink-2">
            <span className="num">
              {fromBaseUnits(BigInt(token.supply), token.decimals)}
            </span>{" "}
            {token.symbol} minted to your token account
          </p>
        </div>
      </div>

      <dl className="grid gap-2 rounded-lg border border-border-low bg-cream px-4 py-3 text-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <dt className="text-muted">Mint</dt>
          <dd>
            <a
              data-testid="result-mint-link"
              className="break-all font-mono text-xs underline underline-offset-2"
              href={explorer.tokenUrl(token.mint)}
              target="_blank"
              rel="noreferrer"
            >
              {token.mint}
            </a>
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <dt className="text-muted">Transaction</dt>
          <dd>
            <a
              data-testid="result-tx-link"
              className="font-mono text-xs underline underline-offset-2"
              href={explorer.txUrl(token.signature)}
              target="_blank"
              rel="noreferrer"
            >
              {truncateAddress(token.signature)}
            </a>
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <dt className="text-muted">Program</dt>
          <dd className="font-mono text-xs">
            {token.program === "token-2022" ? "Token-2022" : "SPL Token"}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-3">
        <button
          data-testid="bake-another"
          onClick={onBakeAnother}
          className="rounded-lg border border-border-low px-4 py-2 text-sm font-medium transition hover:shadow-sm"
        >
          Bake another
        </button>
        <button
          disabled
          title="Airdrop ships with RF-03"
          className="rounded-lg border border-border-low px-4 py-2 text-sm font-medium opacity-50"
        >
          Go to Airdrop
        </button>
        <button
          disabled
          title="Oven ships with RF-04"
          className="rounded-lg border border-border-low px-4 py-2 text-sm font-medium opacity-50"
        >
          View in Oven
        </button>
      </div>
    </section>
  );
}
