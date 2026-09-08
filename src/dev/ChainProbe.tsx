import { getWallets } from "@wallet-standard/app";
import { useEffect, useState } from "react";

/**
 * RF-01.1 spike — temporary. Delete once VITE_WALLET_CHAIN is pinned.
 *
 * Enumerates Wallet Standard wallets using the RAW registry rather than
 * `useWallets(client)`, because the Kit wallet plugin filters discovery on
 * `uiWallet.chains.includes(chain)` — the exact filter whose correct input we
 * are trying to discover. Filtering here would hide the answer.
 */
type Row = {
  accounts: number;
  chains: readonly string[];
  features: readonly string[];
  name: string;
  version: string;
};

function snapshot(): Row[] {
  return getWallets()
    .get()
    .map((wallet) => ({
      accounts: wallet.accounts.length,
      chains: [...wallet.chains],
      features: Object.keys(wallet.features),
      name: wallet.name,
      version: wallet.version,
    }));
}

export function ChainProbe() {
  const [rows, setRows] = useState<Row[]>(snapshot);

  useEffect(() => {
    // Wallets register asynchronously; re-read on every registration event.
    const { on } = getWallets();
    const offRegister = on("register", () => setRows(snapshot()));
    const offUnregister = on("unregister", () => setRows(snapshot()));
    // Late registrants can land after the listeners attach.
    const timer = setInterval(() => setRows(snapshot()), 500);
    return () => {
      offRegister();
      offUnregister();
      clearInterval(timer);
    };
  }, []);

  const allChains = [...new Set(rows.flatMap((r) => r.chains))].sort();

  return (
    <div className="min-h-screen bg-bg1 p-8 font-mono text-foreground">
      <h1 className="mb-2 text-2xl font-semibold">
        Wallet Standard chain probe
      </h1>
      <p className="mb-6 text-sm text-muted">
        RF-01.1 · raw registry, unfiltered · {rows.length} wallet(s) detected
      </p>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold">
          Every advertised chain identifier
        </h2>
        <pre
          data-testid="all-chains"
          className="overflow-x-auto rounded-lg border border-border-low bg-card p-4 text-sm"
        >
          {allChains.length
            ? allChains.join("\n")
            : "(none — no wallets found)"}
        </pre>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Per wallet</h2>
        <pre
          data-testid="probe-json"
          className="overflow-x-auto rounded-lg border border-border-low bg-card p-4 text-xs"
        >
          {JSON.stringify(rows, null, 2)}
        </pre>
      </section>
    </div>
  );
}
