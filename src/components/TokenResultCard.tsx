import { explorer } from "../lib/chain/explorer";
import { fromBaseUnits } from "../lib/token/bakeForm";
import { Button } from "./ui/Button";
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

      <dl className="flex flex-col rounded-lg border border-border-low bg-bg1 px-[18px]">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[#1e1a17] py-3.5">
          <dt className="text-[13.5px] text-ink-2">Mint</dt>
          <dd className="min-w-0">
            <a
              data-testid="result-mint-link"
              className="break-all font-mono text-xs underline-offset-2 hover:underline"
              href={explorer.tokenUrl(token.mint)}
              target="_blank"
              rel="noreferrer"
            >
              {token.mint}
            </a>
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[#1e1a17] py-3.5">
          <dt className="text-[13.5px] text-ink-2">Transaction</dt>
          <dd>
            <a
              data-testid="result-tx-link"
              className="inline-flex items-center gap-1.5 font-mono text-xs underline-offset-2 hover:underline"
              href={explorer.txUrl(token.signature)}
              target="_blank"
              rel="noreferrer"
            >
              {truncateAddress(token.signature)}
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
              >
                <path
                  d="M14 5h5v5M19 5l-8 8"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </a>
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-3 py-3.5">
          <dt className="text-[13.5px] text-ink-2">Program</dt>
          <dd>
            {token.program === "token-2022" ? (
              <span className="rounded-full bg-accent/12 px-2.5 py-1 text-[11.5px] font-semibold text-accent">
                Token-2022
              </span>
            ) : (
              <span className="rounded-full bg-raised px-2.5 py-1 text-[11.5px] font-semibold text-ink-2">
                SPL Token
              </span>
            )}
          </dd>
        </div>
      </dl>

      <div className="grid grid-cols-2 gap-3">
        <Button disabled title="Airdrop ships with RF-03">
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
          >
            <path
              d="M12 3v12M7.5 10.5L12 15l4.5-4.5"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M4.5 18.5h15"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
            />
          </svg>
          Airdrop it
        </Button>
        <Button disabled title="Oven ships with RF-04" variant="secondary">
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
          >
            <path
              d="M4 19V9M10 19V5M16 19v-7M22 19H2"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          View in Oven
        </Button>
      </div>

      <div className="flex items-center justify-center gap-1.5 text-[13px] text-ink-3">
        <span>Saved to</span>
        <button
          data-testid="bake-another"
          onClick={onBakeAnother}
          className="font-semibold text-ink-2 underline underline-offset-2 transition-colors duration-[160ms] [transition-timing-function:var(--ease-strong-out)] hover:text-ink"
        >
          My tokens
        </button>
        <span>on this device · bake another</span>
      </div>
    </section>
  );
}
