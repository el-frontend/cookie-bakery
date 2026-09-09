import { useCallback, useState } from "react";
import type { Address } from "@solana/kit";
import { useClient } from "@solana/react";
import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";
import { BakeryMark } from "./BakeryMark";
import { chainConfig } from "../lib/chain/config";
import { useCookBalance } from "../hooks/useCookBalance";
import { useRpcHealth } from "../hooks/useRpcHealth";
import { formatCook } from "../lib/format/lamports";
import { truncateAddress } from "../lib/format/address";
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
}: {
  active: Section;
  onNavigate: (section: Section) => void;
}) {
  const client = useClient<AppClient>();
  const connected = useConnectedWallet(client);
  const address = connected?.account.address;
  const { lamports } = useCookBalance(address as Address | undefined);

  const getSlot = useCallback(
    async () => (await client.rpc.getSlot().send()) as bigint,
    [client]
  );
  const { isHealthy, latencyMs } = useRpcHealth(getSlot);

  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    if (!address) return;
    void navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  }, [address]);

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#211d19] px-6 py-[18px] sm:px-8">
      <div className="flex items-center gap-2.5">
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

      <div className="flex items-center gap-2.5">
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

        {address ? (
          <button
            onClick={copy}
            title="Copy address"
            className="flex items-center gap-[9px] rounded-md border border-border-low bg-card py-[7px] pl-3 pr-2 transition-[transform,border-color] duration-[160ms] [transition-timing-function:var(--ease-strong-out)] active:scale-[0.97] hover:border-border-strong"
          >
            <span className="font-mono text-[12.5px] text-ink">
              {copied ? "Copied" : truncateAddress(address)}
            </span>
            <span className="rounded-[6px] bg-raised px-[9px] py-1 text-[11.5px] font-semibold text-accent num">
              {lamports == null ? "…" : `${formatCook(lamports)} COOK`}
            </span>
          </button>
        ) : null}
      </div>
    </header>
  );
}
