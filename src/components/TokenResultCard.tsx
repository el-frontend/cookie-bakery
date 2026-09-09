import { explorer } from "../lib/chain/explorer";
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
      className="space-y-4 rounded-2xl border border-border-low bg-card p-6"
    >
      <div className="space-y-1">
        <p className="text-lg font-semibold">
          {token.name} ({token.symbol}) is live
        </p>
        <p className="text-sm text-muted">
          The initial supply is in your associated token account.
        </p>
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
