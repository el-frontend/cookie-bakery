import { useCallback, useState } from "react";
import { useClient } from "@solana/react";
import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";
import { Airdrop } from "./app/Airdrop";
import { Bake } from "./app/Bake";
import { Oven } from "./app/Oven";
import { Footer } from "./components/Footer";
import { GettingStartedModal } from "./components/GettingStartedModal";
import { TopBar, type Section } from "./components/TopBar";
import type { SelectedToken } from "./components/TokenSelector";
import { WalletButton } from "./components/WalletButton";
import { client, type AppClient } from "./providers";

/**
 * The warm-dark shell.
 *
 * The single radial glow at the top is the only ambient treatment — it gives
 * the canvas depth without competing with the one accent. Everything else is
 * flat surfaces and hairlines.
 *
 * The shell owns the one piece of cross-screen state: the token the Oven hands
 * to the Airdrop when someone clicks "Airdrop more". Keeping it here rather
 * than in a store means it cannot outlive the navigation that created it —
 * a preselected token that survived a reload would be a confusing default.
 */
export default function App() {
  const [section, setSection] = useState<Section>("bake");
  const [helpOpen, setHelpOpen] = useState(false);
  const [handoffToken, setHandoffToken] = useState<SelectedToken | null>(null);

  // The top bar already carries the address and balance, so the full wallet
  // panel is only worth its space while there is nothing connected.
  const connected = useConnectedWallet(useClient<AppClient>());

  const navigate = useCallback((next: Section) => {
    setSection(next);
    // Only the Oven's explicit handoff should preselect a token; arriving at
    // Airdrop from the nav must start clean.
    setHandoffToken(null);
  }, []);

  const airdropToken = useCallback((token: SelectedToken) => {
    setHandoffToken(token);
    setSection("airdrop");
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-clip bg-bg1 text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
        style={{
          backgroundImage:
            "radial-gradient(900px 420px at 50% -8%, rgba(232,163,61,0.10), transparent 70%)",
        }}
      />

      <div className="relative z-10 flex min-h-screen flex-col">
        <TopBar
          active={section}
          onNavigate={navigate}
          onOpenHelp={() => setHelpOpen(true)}
        />

        <main className="flex flex-grow justify-center px-6 py-11 sm:px-8">
          {/*
           * Airdrop and Oven are wider than Bake on purpose: both carry
           * tables, and squeezing 44-character addresses into the form column
           * would wrap every row.
           */}
          <div
            className={
              "w-full " +
              (section === "bake" ? "max-w-[560px]" : "max-w-[760px]")
            }
          >
            <div className="flex flex-col gap-6">
              {connected ? null : <WalletButton client={client} />}

              {section === "bake" ? (
                <Bake client={client} />
              ) : section === "airdrop" ? (
                <Airdrop
                  client={client}
                  initialToken={handoffToken}
                  onBake={() => navigate("bake")}
                />
              ) : (
                <Oven
                  client={client}
                  onAirdrop={airdropToken}
                  onBake={() => navigate("bake")}
                />
              )}
            </div>
          </div>
        </main>

        <Footer />
      </div>

      {helpOpen ? (
        <GettingStartedModal onClose={() => setHelpOpen(false)} />
      ) : null}
    </div>
  );
}
