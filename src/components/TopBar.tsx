import { useCallback } from "react";
import { useClient } from "@solana/react";
import { BakeryMark } from "./BakeryMark";
import { WalletMenu } from "./WalletMenu";
import { chainConfig } from "../lib/chain/config";
import { useRpcHealth } from "../hooks/useRpcHealth";
import type { AppClient } from "../providers";

export type Section = "airdrop" | "bake" | "oven";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "bake", label: "Bake" },
  { id: "airdrop", label: "Airdrop" },
  { id: "oven", label: "Oven" },
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
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#211d19] px-6 py-[18px] sm:px-8">
      <div className="flex flex-1 items-center justify-start gap-2.5">
        <span className="text-accent">
          <BakeryMark />
        </span>
        <span className="font-display text-[17px] font-bold tracking-[-0.02em]">
          Cookie Bakery
        </span>
      </div>

      <nav className="flex items-center gap-1 rounded-full border border-border-low bg-card p-1">
        {SECTIONS.map((section) => {
          const on = section.id === active;
          return (
            <button
              key={section.id}
              onClick={() => onNavigate(section.id)}
              aria-current={on ? "page" : undefined}
              className={
                "rounded-full px-[18px] py-2 text-[13.5px] transition-colors duration-[160ms] [transition-timing-function:var(--ease-strong-out)] " +
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

      <div className="flex flex-1 items-center justify-end gap-2.5">
        <button
          className="rounded-md border border-border-low bg-card px-3 py-2 text-[12.5px] font-medium text-ink-2 transition-colors duration-[160ms] [transition-timing-function:var(--ease-strong-out)] hover:border-border-strong hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          data-testid="open-help"
          onClick={onOpenHelp}
        >
          How to start
        </button>

        <div className="flex items-center gap-[7px] rounded-md border border-border-low bg-card px-3 py-2">
          <span
            aria-hidden
            className={
              "h-1.5 w-1.5 rounded-full " +
              (isHealthy
                ? "bg-success shadow-[0_0_0_3px_rgba(95,191,140,0.16)]"
                : "bg-ink-4")
            }
          />
          <span className="text-[12.5px] font-medium text-ink-2">
            Cookie Chain
          </span>
          <span className="font-mono text-[11.5px] text-ink-3 num">
            {latencyMs != null ? `${latencyMs}ms` : rpcHost(chainConfig.rpcUrl)}
          </span>
        </div>

        <WalletMenu client={client} />
      </div>
    </header>
  );
}
