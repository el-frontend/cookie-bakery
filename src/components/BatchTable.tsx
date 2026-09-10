import type { BatchStatus } from "../store/airdropHistory";
import type { BatchRun } from "../lib/airdrop/executor";
import { explorer } from "../lib/chain/explorer";
import { truncateAddress } from "../lib/format/address";
import { fromBaseUnits } from "../lib/token/bakeForm";
import { Button } from "./ui/Button";

/**
 * Per-batch progress with a CookieScan link per signature (RF-03.7).
 *
 * The signature is what makes a confirmed batch verifiable independently of
 * this app, so it is a link rather than text — and the run survives in
 * localStorage precisely so those links outlive the tab.
 *
 * Retry is offered ONLY on a failed batch. Re-sending a confirmed one would
 * transfer the tokens twice, and there is no undo for that.
 */

const PILL: Record<BatchStatus, string> = {
  confirmed: "bg-success/12 text-success",
  failed: "bg-danger/12 text-danger",
  pending: "bg-raised text-ink-3",
  sent: "bg-accent/12 text-accent",
  signing: "bg-accent/12 text-accent",
};

const LABEL: Record<BatchStatus, string> = {
  confirmed: "Confirmed",
  failed: "Failed",
  pending: "Waiting",
  sent: "Sent",
  signing: "Signing",
};

function totalOf(batch: BatchRun): bigint {
  return batch.recipients.reduce((sum, r) => sum + r.amount, 0n);
}

export function BatchTable({
  batches,
  decimals,
  isBusy,
  onRetry,
  symbol,
}: {
  batches: readonly BatchRun[];
  decimals: number;
  /** True while any batch is in flight — retries queue behind it. */
  isBusy: boolean;
  onRetry: (index: number) => void;
  symbol: string;
}) {
  return (
    <ul className="flex flex-col gap-2" data-testid="batch-table">
      {batches.map((batch) => (
        <li
          className="flex flex-col gap-2 rounded-lg border border-border-low bg-card px-4 py-3.5"
          key={batch.index}
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-sm font-semibold">
              Batch {batch.index + 1}
            </span>
            <span className="text-[12.5px] text-ink-3">
              {batch.recipients.length}{" "}
              {batch.recipients.length === 1 ? "recipient" : "recipients"} ·{" "}
              <span className="font-mono num">
                {fromBaseUnits(totalOf(batch), decimals)}
              </span>{" "}
              {symbol}
            </span>

            <span
              className={
                "ml-auto rounded-chip px-2.5 py-[3px] text-[11px] font-semibold " +
                PILL[batch.status]
              }
              data-testid={`batch-status-${batch.index}`}
            >
              {LABEL[batch.status]}
              {batch.retried && batch.status === "signing" ? " · retry" : null}
            </span>

            {batch.signature ? (
              <a
                className="font-mono text-[11.5px] text-accent underline underline-offset-2"
                href={explorer.txUrl(batch.signature)}
                referrerPolicy="no-referrer"
                rel="noreferrer"
                target="_blank"
              >
                {truncateAddress(batch.signature, 6, 6)}
              </a>
            ) : null}

            {batch.status === "failed" ? (
              <Button
                data-testid={`batch-retry-${batch.index}`}
                disabled={isBusy}
                onClick={() => onRetry(batch.index)}
                variant="secondary"
              >
                Retry
              </Button>
            ) : null}
          </div>

          {batch.error ? (
            <p className="text-[12.5px] leading-relaxed text-danger">
              <span className="font-semibold">{batch.error.title}</span> —{" "}
              {batch.error.detail}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
