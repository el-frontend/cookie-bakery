import type { Lamports } from "@solana/kit";
import type { ReactNode } from "react";
import { formatCook, formatCookWithSymbol } from "../lib/format/lamports";
import type { AirdropCost } from "../lib/airdrop/buildPlan";

/**
 * What the run will cost, before anything reaches the wallet (RF-03.6,
 * AC-03.5).
 *
 * The transaction count is stated as `n × m per batch` rather than a bare
 * total because the number that actually costs the user something is the
 * number of WALLET PROMPTS: every transaction is one signature they have to
 * approve, and at 1,000 recipients without accounts that is around 150 of
 * them. Burying it in a total would be a nasty surprise a third of the way in.
 *
 * Cost is `—` until the accounts have been probed. Guessing rent for accounts
 * that may already exist would show a number that is simply wrong.
 */

function Stat({
  danger = false,
  label,
  value,
}: {
  danger?: boolean;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border-low bg-bg1 p-3.5">
      <span
        className={
          "font-display text-[26px] font-bold leading-none tracking-[-0.02em] num " +
          (danger ? "text-danger" : "")
        }
      >
        {value}
      </span>
      <span className="text-xs text-ink-3">{label}</span>
    </div>
  );
}

function Line({
  emphasis = false,
  label,
  value,
}: {
  emphasis?: boolean;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-[13px] text-ink-2">{label}</span>
      <span
        className={
          "font-mono text-[13px] num " +
          (emphasis ? "font-semibold text-accent" : "")
        }
      >
        {value}
      </span>
    </div>
  );
}

export function AirdropPlanSummary({
  balance,
  confirmed,
  cost,
  errorCount,
  footnote,
  newAtaCount,
  perBatch,
  recipientCount,
  symbol,
  total,
  transactionCount,
}: {
  /** The sender's COOK balance, for the "can they afford it" comparison. */
  balance: Lamports | null;
  /** Batches confirmed so far. */
  confirmed: number;
  cost: AirdropCost | null;
  errorCount: number;
  footnote?: ReactNode;
  /** Null until the accounts have been probed. */
  newAtaCount: number | null;
  perBatch: number;
  recipientCount: number;
  symbol: string;
  /** Total tokens to send, formatted. */
  total: string;
  transactionCount: number;
}) {
  const short = cost != null && balance != null && balance < cost.total;

  return (
    <section
      aria-label="Execution plan"
      className="flex flex-col gap-3.5 rounded-xl border border-border-low bg-card p-5"
      data-testid="plan-summary"
    >
      <span className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">
        Execution plan
      </span>

      <div className="grid grid-cols-2 gap-2.5">
        <Stat label="recipients" value={recipientCount} />
        <Stat
          danger={errorCount > 0}
          label={errorCount === 1 ? "row with errors" : "rows with errors"}
          value={errorCount}
        />
      </div>

      <div className="flex flex-col gap-2.5">
        <Line
          label="Transactions"
          value={`${transactionCount} × ${perBatch} per batch`}
        />
        <Line
          label="New token accounts"
          value={newAtaCount == null ? "—" : newAtaCount}
        />
        <Line label="Total to send" value={`${total} ${symbol}`.trim()} />
        <Line
          emphasis
          label="Estimated cost"
          value={cost ? formatCook(cost.total as Lamports) : "—"}
        />
        <Line label="Progress" value={`${confirmed} / ${transactionCount}`} />
      </div>

      {short ? (
        <p className="text-[12.5px] leading-relaxed text-danger" role="alert">
          This run costs more than your balance of{" "}
          {formatCookWithSymbol(balance)}.
        </p>
      ) : null}

      {footnote ? (
        <p className="text-[12.5px] leading-relaxed text-ink-3">{footnote}</p>
      ) : null}
    </section>
  );
}
