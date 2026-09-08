import { NetworkIndicator } from "./components/NetworkIndicator";
import { WalletButton } from "./components/WalletButton";
import { client } from "./providers";

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

        <NetworkIndicator />
        <WalletButton client={client} />
      </main>
    </div>
  );
}
