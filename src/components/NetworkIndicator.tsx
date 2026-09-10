import { useCallback } from "react";
import { useClient } from "@solana/react";
import { chainConfig } from "../lib/chain/config";
import { useRpcHealth } from "../hooks/useRpcHealth";
import type { AppClient } from "../providers";

/** Host only — the full URL is noise in a status chip. */
function rpcHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function NetworkIndicator() {
  const { rpc } = useClient<AppClient>();
  const getSlot = useCallback(
    async () => (await rpc.getSlot().send()) as bigint,
    [rpc]
  );
  const { isHealthy, latencyMs, refresh, slot } = useRpcHealth(getSlot);

  return (
    <div className="space-y-2">
      <p
        data-testid="network-indicator"
        className="flex flex-wrap items-center gap-2 text-xs text-muted"
      >
        <span
          aria-hidden
          className={`h-2 w-2 rounded-full ${
            isHealthy ? "bg-primary/70" : "bg-foreground/30"
          }`}
        />
        <span>Cookie Chain · {rpcHost(chainConfig.rpcUrl)}</span>
        {slot != null ? (
          <span data-testid="slot">slot {String(slot)}</span>
        ) : null}
        {latencyMs != null ? <span>{latencyMs} ms</span> : null}
      </p>

      {isHealthy ? null : (
        <div
          role="alert"
          data-testid="rpc-error-banner"
          className="flex flex-wrap items-center gap-3 rounded-lg border border-border-strong bg-cream px-3 py-2 text-sm"
        >
          <span>
            The Cookie Chain RPC is not responding. Transactions will fail until
            it recovers.
          </span>
          <button
            onClick={refresh}
            className="rounded-lg border border-border-low bg-card px-2 py-1 text-xs font-medium cursor-pointer transition-[transform,background-color,border-color,color] duration-[160ms] [transition-timing-function:var(--ease-strong-out)] hover:border-border-strong active:scale-[0.97]"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
