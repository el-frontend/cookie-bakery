import type { Lamports } from "@solana/kit";
import { chainConfig } from "../lib/chain/config";
import type { MappedError } from "../lib/errors/types";
import { formatCookWithSymbol } from "../lib/format/lamports";
import { truncateAddress } from "../lib/format/address";
import type { BakeCost } from "../lib/token/sizing";
import { ProgramLogViewer } from "./ProgramLogViewer";
import { Button } from "./ui/Button";

/**
 * What the user sees immediately before signing (RF-02.5).
 *
 * The whole point is that nothing reaches the wallet until the numbers are on
 * screen and the transaction has actually been planned. Planning runs a
 * simulation to estimate resource limits, so a transaction the chain would
 * reject fails HERE — with the program logs — instead of after someone has
 * approved it in Nightly.
 */

export type BakeSummaryProps = {
  balance: Lamports | null;
  cost: BakeCost | null;
  decimals: number;
  isPlanning: boolean;
  isSending: boolean;
  /** Mint address the generated keypair will occupy, known before signing. */
  mint: string | null;
  onSubmit: () => void;
  /** Failure from the planning/simulation pass, if any. */
  simulationError: MappedError | null;
  /** Human-readable supply, e.g. "1000000". */
  supply: string;
  symbol: string;
};

function Row({
  children,
  label,
  testId,
}: {
  children: React.ReactNode;
  label: string;
  testId?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd data-testid={testId} className="font-mono text-xs">
        {children}
      </dd>
    </div>
  );
}

export function BakeSummary({
  balance,
  cost,
  decimals,
  isPlanning,
  isSending,
  mint,
  onSubmit,
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

  return (
    <section
      aria-label="Transaction summary"
      data-testid="bake-summary"
      className="space-y-4 rounded-2xl border border-border-low bg-card p-6"
    >
      <div className="space-y-1">
        <p className="text-lg font-semibold">Before you sign</p>
        <p className="text-sm text-muted">
          Creating the mint, your token account and the initial supply.
        </p>
      </div>

      <dl className="grid gap-2 rounded-lg border border-border-low bg-cream px-4 py-3 text-sm">
        <Row label="Mint address" testId="summary-mint">
          {mint ? truncateAddress(mint) : "—"}
        </Row>
        <Row label="Initial supply" testId="summary-supply">
          {supply} {symbol}
        </Row>
        <Row label="Decimals">{decimals}</Row>
      </dl>

      {cost ? (
        <dl
          data-testid="cost-breakdown"
          className="grid gap-2 rounded-lg border border-border-low bg-cream px-4 py-3 text-sm"
        >
          <Row label={`Mint rent (${cost.space.rentBearing} bytes)`}>
            {formatCookWithSymbol(cost.mintRent as Lamports)}
          </Row>
          <Row label={`Token account rent (${cost.ataSpace} bytes)`}>
            {formatCookWithSymbol(cost.ataRent as Lamports)}
          </Row>
          <Row label="Network fee">
            {formatCookWithSymbol(cost.fee as Lamports)}
          </Row>
          <Row label="Total" testId="cost-total">
            <span className="font-semibold">
              {formatCookWithSymbol(cost.total as Lamports)}
            </span>
          </Row>
          <Row label="Your balance" testId="cost-balance">
            <span
              className={
                affordable === false ? "font-semibold text-red-600" : undefined
              }
            >
              {balance == null ? "—" : formatCookWithSymbol(balance)}
            </span>
          </Row>
        </dl>
      ) : (
        <p className="text-sm text-muted">Estimating cost…</p>
      )}

      {affordable === false ? (
        <p
          data-testid="insufficient-balance"
          className="space-y-1 rounded-lg border border-border-low bg-cream px-4 py-3 text-sm"
        >
          <span className="block font-semibold">Not enough COOK</span>
          <span className="block text-muted">
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
        </p>
      ) : null}

      {simulationError ? (
        <div
          data-testid="simulation-error"
          className="space-y-2 rounded-lg border border-border-low bg-cream px-4 py-3 text-sm"
        >
          <p className="font-semibold">{simulationError.title}</p>
          <p className="text-muted">{simulationError.detail}</p>
          {simulationError.logs ? (
            <ProgramLogViewer logs={simulationError.logs} />
          ) : null}
        </div>
      ) : null}

      <Button
        data-testid="bake-submit"
        disabled={blocked}
        onClick={onSubmit}
        size="lg"
        className="w-full"
      >
        {isPlanning
          ? "Simulating…"
          : isSending
            ? "Waiting for signature…"
            : "Bake token"}
      </Button>
    </section>
  );
}
