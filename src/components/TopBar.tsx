import { useCallback } from "react";
import { useClient } from "@solana/react";
import { BakeryMark } from "./BakeryMark";
import { WalletMenu } from "./WalletMenu";
import { chainConfig } from "../lib/chain/config";
import { useRpcHealth } from "../hooks/useRpcHealth";
import type { AppClient } from "../providers";

export type Section = "airdrop" | "bake" | "events" | "oven";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "bake", label: "Bake" },
  { id: "airdrop", label: "Airdrop" },
  { id: "oven", label: "Oven" },
  { id: "events", label: "Events" },
];

/** Host only — the full URL is noise in a status chip. */
function rpcHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function TopBar({
  active,
  onNavigate,
  onOpenHelp,
}: {
  active: Section;
  onNavigate: (section: Section) => void;
  /**
   * Opens "How to start" (RF-06.1). It lives in the header rather than on one
   * screen because AC-06.5 requires it to be reachable from all of them.
   */
  onOpenHelp: () => void;
}) {
  const client = useClient<AppClient>();

  const getSlot = useCallback(
    async () => (await client.rpc.getSlot().send()) as bigint,
    [client]
  );
  const { isHealthy, latencyMs } = useRpcHealth(getSlot);

  return (
    <header className="flex items-center justify-between gap-2 border-b border-[#211d19] px-6 py-[18px] sm:gap-3 sm:px-8">
      <div className="flex min-w-0 flex-1 items-center justify-start gap-2.5">
        <span className="shrink-0">
          <BakeryMark />
        </span>
        {/* The mark alone carries the brand once space is tight; the wordmark
            is the first thing to go so the nav never has to wrap. */}
        <span className="hidden truncate font-display text-[17px] font-bold tracking-[-0.02em] lg:inline">
          Cookie Bakery
        </span>
      </div>

      <nav className="flex shrink-0 items-center gap-1 rounded-full border border-border-low bg-card p-1">
        {SECTIONS.map((section) => {
          const on = section.id === active;
          return (
            <button
              key={section.id}
              onClick={() => onNavigate(section.id)}
              aria-current={on ? "page" : undefined}
              className={
                "rounded-full px-2 py-2 text-[13.5px] transition-colors duration-[160ms] [transition-timing-function:var(--ease-strong-out)] sm:px-[18px] " +
                (on
                  ? "bg-accent font-semibold text-accent-ink"
                  : "font-medium text-ink-2 hover:text-ink")
              }
            >
              {section.label}
            </button>
          );
        })}
      </nav>

      {/* Nothing here wraps. The header is one row at every width, so the
          side groups shrink and shed their least essential parts in order —
          latency, then the network label, then the help label — rather than
          stacking on top of each other. */}
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        <button
          aria-label="How to start"
          className="shrink-0 rounded-md border border-border-low bg-card px-3 py-2 text-[12.5px] font-medium text-ink-2 transition-colors duration-[160ms] [transition-timing-function:var(--ease-strong-out)] hover:border-border-strong hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          data-testid="open-help"
          onClick={onOpenHelp}
        >
          <span className="hidden lg:inline">How to start</span>
          <span aria-hidden className="lg:hidden">
            ?
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-[7px] rounded-md border border-border-low bg-card px-3 py-2">
          <span
            aria-hidden
            className={
              "h-1.5 w-1.5 shrink-0 rounded-full " +
              (isHealthy
                ? "bg-success shadow-[0_0_0_3px_rgba(95,191,140,0.16)]"
                : "bg-ink-4")
            }
          />
          <span className="hidden text-[12.5px] font-medium text-ink-2 md:inline">
            Cookie Chain
          </span>
          <span className="hidden font-mono text-[11.5px] text-ink-3 num xl:inline">
            {latencyMs != null ? `${latencyMs}ms` : rpcHost(chainConfig.rpcUrl)}
          </span>
          <span className="sr-only">
            {isHealthy
              ? `Cookie Chain connected${latencyMs != null ? `, ${latencyMs}ms` : ""}`
              : "Cookie Chain not responding"}
          </span>
        </div>

        <WalletMenu client={client} />
      </div>
    </header>
  );
}
