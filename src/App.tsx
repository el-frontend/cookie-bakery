import {
  useConnect,
  useConnectedWallet,
  useDisconnect,
  useWallets,
  useWalletStatus,
  WalletReadyGate,
} from "@solana/kit-plugin-wallet/react";
import { client } from "./providers";

function WalletPanel() {
  const wallets = useWallets(client);
  const connected = useConnectedWallet(client);
  const status = useWalletStatus(client);
  const { dispatch: connect, isRunning: isConnecting } = useConnect(client);
  const { dispatch: disconnect } = useDisconnect(client);

  const address = connected?.account.address;

  return (
    <section className="w-full max-w-3xl space-y-4 rounded-2xl border border-border-low bg-card p-6 shadow-[0_20px_80px_-50px_rgba(0,0,0,0.35)]">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-lg font-semibold">Wallet connection</p>
          <p className="text-sm text-muted">
            Wallets discovered through Wallet Standard for the configured chain.
          </p>
        </div>
        <span className="rounded-full bg-cream px-3 py-1 text-xs font-semibold uppercase tracking-wide text-foreground/80">
          {status}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {wallets.map((wallet) => (
          <button
            key={wallet.name}
            onClick={() => connect(wallet)}
            disabled={isConnecting}
            className="group flex items-center justify-between rounded-xl border border-border-low bg-card px-4 py-3 text-left text-sm font-medium transition hover:-translate-y-0.5 hover:shadow-sm cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
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
        ))}
      </div>

      {wallets.length === 0 ? (
        <p className="text-sm text-muted">
          No wallets advertise this chain. Install{" "}
          <a
            className="font-medium underline underline-offset-2"
            href="https://nightly.app"
            target="_blank"
            rel="noreferrer"
          >
            Nightly
          </a>{" "}
          to continue.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-border-low pt-4 text-sm">
        <span className="rounded-lg border border-border-low bg-cream px-3 py-2 font-mono text-xs">
          {address ?? "No wallet connected"}
        </span>
        <button
          onClick={() => disconnect()}
          disabled={!connected}
          className="inline-flex items-center gap-2 rounded-lg border border-border-low bg-card px-3 py-2 font-medium transition hover:-translate-y-0.5 hover:shadow-sm cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
        >
          Disconnect
        </button>
      </div>
    </section>
  );
}

export default function App() {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-bg1 text-foreground">
      <main className="relative z-10 mx-auto flex min-h-screen max-w-4xl flex-col gap-10 border-x border-border-low px-6 py-16">
        <header className="space-y-3">
          <p className="text-sm uppercase tracking-[0.18em] text-muted">
            Cookie Chain
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Cookie Bakery
          </h1>
          <p className="max-w-3xl text-base leading-relaxed text-muted">
            Launch a token and airdrop it to your community — no CLI required.
          </p>
        </header>

        <WalletReadyGate
          client={client}
          fallback={<p className="text-sm text-muted">Discovering wallets…</p>}
        >
          <WalletPanel />
        </WalletReadyGate>
      </main>
    </div>
  );
}
