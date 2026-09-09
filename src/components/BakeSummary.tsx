import type { Lamports } from "@solana/kit";
import { chainConfig } from "../lib/chain/config";
import type { MappedError } from "../lib/errors/types";
import { formatCook, formatCookWithSymbol } from "../lib/format/lamports";
import { truncateAddress } from "../lib/format/address";
import type { BakeCost } from "../lib/token/sizing";
import { ProgramLogViewer } from "./ProgramLogViewer";
import { Button } from "./ui/Button";

/**
 * What the user sees immediately before signing (RF-02.5).
 *
 * Nothing reaches the wallet until the numbers are on screen and the
 * transaction has actually been planned. Planning simulates to estimate
 * resource limits, so a transaction the chain would reject fails HERE — with
 * its program logs — instead of after someone approved it in Nightly.
 */

export type BakeSummaryProps = {
  balance: Lamports | null;
  cost: BakeCost | null;
  decimals: number;
  freezeRevoked: boolean;
  isPlanning: boolean;
  isSending: boolean;
  /** Mint address the generated keypair will occupy, known before signing. */
  mint: string | null;
  mintRevoked: boolean;
  name: string;
  onSubmit: () => void;
  program: "token" | "token-2022";
  /** Failure from the planning/simulation pass, if any. */
  simulationError: MappedError | null;
  /** Human-readable supply, e.g. "1000000". */
  supply: string;
  symbol: string;
};

function Row({
  children,
  label,
  last = false,
  testId,
}: {
  children: React.ReactNode;
  label: string;
  last?: boolean;
  testId?: string;
}) {
  return (
    <div
      className={
        "flex items-baseline justify-between gap-4 py-3.5 " +
        (last ? "" : "border-b border-[#1e1a17]")
      }
    >
      <span className="text-[13.5px] text-ink-2">{label}</span>
      <span data-testid={testId} className="text-right">
        {children}
      </span>
    </div>
  );
}

function ProgramChip({ program }: { program: "token" | "token-2022" }) {
  return program === "token-2022" ? (
    <span className="rounded-full bg-accent/12 px-2.5 py-1 text-[11.5px] font-semibold text-accent">
      Token-2022
    </span>
  ) : (
    <span className="rounded-full bg-raised px-2.5 py-1 text-[11.5px] font-semibold text-ink-2">
      SPL Token
    </span>
  );
}

/** Two letters is enough to tell one token from another at a glance. */
function initials(name: string): string {
  const letters = name.trim().replace(/[^\p{L}\p{N}]/gu, "");
  return letters.slice(0, 2).toUpperCase() || "??";
}

function CostLine({
  detail,
  label,
  value,
}: {
  detail: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-[7px]">
      <span className="text-[13.5px] text-ink-2">
        {label} <span className="text-ink-4">{detail}</span>
      </span>
      <span className="font-mono text-[13px] num">{value}</span>
    </div>
  );
}

export function BakeSummary({
  balance,
  cost,
  decimals,
  freezeRevoked,
  isPlanning,
  isSending,
  mint,
  mintRevoked,
  name,
  onSubmit,
  program,
  simulationError,
  supply,
  symbol,
}: BakeSummaryProps) {
  // Unknown balance is not the same as insufficient balance: while it loads,
  // the button stays enabled rather than flashing a false "can't afford".
  const affordable =
    cost != null && balance != null ? balance >= cost.total : null;

  const blocked =
    cost == null ||
    affordable === false ||
    simulationError != null ||
    isPlanning ||
    isSending;

  const authorities =
    (freezeRevoked ? "Freeze revoked" : "Freeze kept") +
    " · " +
    (mintRevoked ? "mint revoked" : "mint kept");

  return (
    <section
      aria-label="Transaction summary"
      data-testid="bake-summary"
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-[3px]">
        <h2 className="font-display text-[28px] font-bold tracking-[-0.03em]">
          Before you sign
        </h2>
        <p className="text-[13.5px] text-ink-3">
          Simulated against Cookie Chain · nothing has been sent yet
        </p>
      </div>

      <div className="flex flex-col rounded-xl border border-border-low bg-card px-[22px] pb-1 pt-[22px]">
        <div className="flex items-center gap-3 border-b border-border-low pb-[18px]">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-[linear-gradient(145deg,#e8a33d,#c9781f)] font-display text-[17px] font-bold text-accent-ink">
            {initials(name)}
          </div>
          <div className="flex flex-grow flex-col gap-0.5">
            <span className="text-base font-semibold">{name}</span>
            <span className="font-mono text-[12.5px] text-ink-3">
              {symbol} · {decimals} decimals
            </span>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span
              data-testid="summary-supply"
              className="font-display text-[22px] font-bold tracking-[-0.02em] num"
            >
              {supply}
            </span>
            <span className="text-[11.5px] text-ink-3">initial supply</span>
          </div>
        </div>

        <Row label="Mint address" testId="summary-mint">
          <span className="font-mono text-[13px]">
            {mint ? truncateAddress(mint) : "—"}
          </span>
        </Row>
        <Row label="Token program">
          <ProgramChip program={program} />
        </Row>
        <Row label="Authorities" last>
          <span className="text-[13px]">{authorities}</span>
        </Row>
      </div>

      {cost ? (
        <div
          data-testid="cost-breakdown"
          className="flex flex-col rounded-xl border border-border-low bg-card px-[22px] py-5"
        >
          <span className="mb-3.5 text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">
            Cost breakdown
          </span>

          <CostLine
            detail={`${cost.space.rentBearing} bytes`}
            label="Mint rent"
            value={formatCook(cost.mintRent as Lamports)}
          />
          <CostLine
            detail={`${cost.ataSpace} bytes`}
            label="Token account rent"
            value={formatCook(cost.ataRent as Lamports)}
          />
          <div className="border-b border-border-low pb-3.5">
            <CostLine
              detail="2 signatures"
              label="Network fee"
              value={formatCook(cost.fee as Lamports)}
            />
          </div>

          <div className="flex items-baseline justify-between gap-4 pb-1.5 pt-3.5">
            <span className="text-[14.5px] font-semibold">Total</span>
            <span
              data-testid="cost-total"
              className="font-mono text-base font-semibold text-accent num"
            >
              {formatCookWithSymbol(cost.total as Lamports)}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-[12.5px] text-ink-3">Your balance</span>
            <span
              data-testid="cost-balance"
              className={
                "font-mono text-[12.5px] num " +
                (affordable === false
                  ? "font-semibold text-danger"
                  : "text-ink-3")
              }
            >
              {balance == null ? "—" : formatCookWithSymbol(balance)}
            </span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink-3">Estimating cost…</p>
      )}

      {affordable === false ? (
        <div
          data-testid="insufficient-balance"
          className="flex flex-col gap-1 rounded-lg border border-border-low bg-raised px-4 py-3.5 text-sm"
        >
          <span className="font-semibold">Not enough COOK</span>
          <span className="text-ink-2">
            Bridge more COOK to cover the rent and fees, then try again.
          </span>
          <a
            className="font-medium underline underline-offset-2"
            href={chainConfig.bridgeUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open the bridge
          </a>
        </div>
      ) : null}

      {simulationError ? (
        <div
          data-testid="simulation-error"
          className="flex flex-col gap-2 rounded-lg border border-danger/30 bg-danger/[0.06] px-4 py-3.5 text-sm"
        >
          <p className="font-semibold">{simulationError.title}</p>
          <p className="text-ink-2">{simulationError.detail}</p>
          {simulationError.logs ? (
            <ProgramLogViewer logs={simulationError.logs} />
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-2.5">
        <Button
          data-testid="bake-submit"
          disabled={blocked}
          onClick={onSubmit}
          size="lg"
          className="w-full"
        >
          {isPlanning ? null : (
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <path
                d="M7 11V8a5 5 0 0110 0v3"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
              />
              <rect
                x="5"
                y="11"
                width="14"
                height="9"
                rx="2.5"
                stroke="currentColor"
                strokeWidth="1.9"
              />
            </svg>
          )}
          {isPlanning
            ? "Simulating…"
            : isSending
              ? "Waiting for signature…"
              : "Bake token"}
        </Button>
        <span className="text-center text-[12.5px] text-ink-3">
          Nightly will ask you to sign · the app submits to{" "}
          {new URL(chainConfig.rpcUrl).host}
        </span>
      </div>
    </section>
  );
}
