import type { Address } from "@solana/kit";
import type { ClientWithWallet } from "@solana/kit-plugin-wallet";
import {
  useConnect,
  useConnectedWallet,
  useDisconnect,
  useWallets,
  useWalletStatus,
  WalletReadyGate,
} from "@solana/kit-plugin-wallet/react";
import { AddressChip } from "./AddressChip";
import { CookBalance } from "./CookBalance";
import { NoWalletEmptyState } from "./NoWalletEmptyState";
import { chainConfig } from "../lib/chain/config";

const STATUS_LABEL: Record<string, string> = {
  connected: "Connected",
  connecting: "Connecting…",
  disconnected: "Not connected",
  disconnecting: "Disconnecting…",
  pending: "Starting up…",
  reconnecting: "Reconnecting…",
};

/**
 * Inner panel. Rendered only once wallet discovery has settled, so it never
 * has to reason about the `pending` / `reconnecting` warm-up states.
 */
export function WalletPanel({ client }: { client: ClientWithWallet }) {
  const wallets = useWallets(client);
  const connected = useConnectedWallet(client);
  const status = useWalletStatus(client);
  const { dispatch: connect, isRunning: isConnecting } = useConnect(client);
  const { dispatch: disconnect, isRunning: isDisconnecting } =
    useDisconnect(client);

  const address = connected?.account.address;

  return (
    <section
      aria-label="Wallet connection"
      className="w-full max-w-3xl space-y-4 rounded-2xl border border-border-low bg-card p-6 shadow-[0_20px_80px_-50px_rgba(0,0,0,0.35)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-lg font-semibold">Wallet connection</p>
          <p className="text-sm text-muted">
            Wallets discovered through Wallet Standard for the configured chain.
          </p>
        </div>
        <span
          data-testid="wallet-status"
          className="rounded-full bg-cream px-3 py-1 text-xs font-semibold uppercase tracking-wide text-foreground/80"
        >
          {STATUS_LABEL[status] ?? status}
        </span>
      </div>

      {connected ? (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span data-testid="connected-address">
            <AddressChip address={address as string} />
          </span>
          <CookBalance address={address as Address} />
          <button
            onClick={() => disconnect()}
            disabled={isDisconnecting}
            className="inline-flex items-center gap-2 rounded-lg border border-border-low bg-card px-3 py-2 font-medium transition hover:-translate-y-0.5 hover:shadow-sm cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDisconnecting ? "Disconnecting…" : "Disconnect"}
          </button>
        </div>
      ) : wallets.length === 0 ? (
        <NoWalletEmptyState chain={chainConfig.chain} />
      ) : (
        <ul className="grid list-none gap-3 p-0 sm:grid-cols-2">
          {wallets.map((wallet) => (
            <li key={wallet.name}>
              <button
                onClick={() => connect(wallet)}
                disabled={isConnecting}
                className="group flex w-full items-center justify-between rounded-xl border border-border-low bg-card px-4 py-3 text-left text-sm font-medium transition hover:-translate-y-0.5 hover:shadow-sm cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="flex flex-col">
                  <span className="text-base">{wallet.name}</span>
                  <span className="text-xs text-muted">
                    {isConnecting ? "Connecting…" : "Tap to connect"}
                  </span>
                </span>
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 rounded-full bg-border-low transition group-hover:bg-primary/80"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Public entry point: holds the wallet UI back behind `WalletReadyGate` until
 * auto-reconnect settles, so a persisted wallet never flashes "not connected"
 * before it silently reconnects (AC-01.4).
 */
export function WalletButton({ client }: { client: ClientWithWallet }) {
  return (
    <WalletReadyGate
      client={client}
      fallback={
        <p data-testid="wallet-warmup" className="text-sm text-muted">
          Discovering wallets…
        </p>
      }
    >
      <WalletPanel client={client} />
    </WalletReadyGate>
  );
}
