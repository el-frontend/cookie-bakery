import { explorer } from "../lib/chain/explorer";
import { truncateAddress } from "../lib/format/address";
import { formatElapsed, useElapsed } from "../hooks/useElapsed";

export type TxPhase = "confirmed" | "failed" | "idle" | "pending" | "sent";

const LABEL: Record<TxPhase, string> = {
  confirmed: "Confirmed",
  failed: "Failed",
  idle: "Ready",
  pending: "Awaiting signature",
  sent: "Sent — confirming",
};

/**
 * Live status for one transaction, with the time it took to confirm.
 *
 * The elapsed time keeps running through `pending` and `sent` and freezes on a
 * terminal phase, so the confirmation duration stays on screen (AC-05.6).
 */
export function TxStatus({
  detail,
  phase,
  signature,
}: {
  detail?: string;
  phase: TxPhase;
  signature?: string | null;
}) {
  const isRunning = phase === "pending" || phase === "sent";
  const elapsedMs = useElapsed(isRunning);
  const isTerminal = phase === "confirmed" || phase === "failed";

  return (
    <div
      data-testid="tx-status"
      data-phase={phase}
      className="flex flex-wrap items-center gap-3 rounded-lg border border-border-low bg-cream px-3 py-2 text-xs"
    >
      <span className="flex items-center gap-2 font-medium">
        <span
          aria-hidden
          className={`h-2 w-2 rounded-full ${
            phase === "failed"
              ? "bg-foreground/30"
              : phase === "confirmed"
                ? "bg-primary/70"
                : "bg-border-strong"
          }`}
        />
        {LABEL[phase]}
      </span>

      {phase !== "idle" ? (
        <span data-testid="tx-elapsed" className="text-muted">
          {formatElapsed(elapsedMs)}
          {isTerminal ? "" : "…"}
        </span>
      ) : null}

      {detail ? <span className="text-muted">{detail}</span> : null}

      {signature ? (
        <a
          className="font-medium underline underline-offset-2"
          href={explorer.txUrl(signature)}
          target="_blank"
          rel="noreferrer"
        >
          {truncateAddress(signature)}
        </a>
      ) : null}
    </div>
  );
}
