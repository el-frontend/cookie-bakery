import { lazy, Suspense, useCallback, useState } from "react";
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
import { useToast } from "./hooks/useToast";
import type { Recipient } from "./lib/airdrop/buildPlan";
import { client, type AppClient } from "./providers";

/**
 * `@supabase/supabase-js` plus `swr` is real weight (this pushed the eager
 * bundle from ~512 kB to ~748 kB when imported directly), and Events is its
 * only consumer, on one of four screens — the same shape as `HoldersChart` in
 * `Oven.tsx`. Loading it eagerly would make Bake/Airdrop/Oven-only visitors
 * pay for a database client they never touch.
 */
const Events = lazy(() =>
  import("./app/Events").then((module) => ({ default: module.Events }))
);

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
  const [helpClosing, setHelpClosing] = useState(false);
  const [handoffToken, setHandoffToken] = useState<SelectedToken | null>(null);
  // The staggered entrance is an introduction, and an introduction only works
  // once. After the first navigation the same 360ms cascade is just latency on
  // the most repeated interaction in the app, so `data-nav` shortens it.
  const [hasNavigated, setHasNavigated] = useState(false);

  // The top bar already carries the address and balance, so the full wallet
  // panel is only worth its space while there is nothing connected.
  const connected = useConnectedWallet(useClient<AppClient>());
  const toast = useToast();

  const navigate = useCallback((next: Section) => {
    setSection(next);
    // Only the Oven's explicit handoff should preselect a token; arriving at
    // Airdrop from the nav must start clean.
    setHandoffToken(null);
    setHasNavigated(true);
  }, []);

  // The modal outlives its own close by the length of the scrim's fade: a
  // dialog unmounted on click cannot animate out.
  const closeHelp = useCallback(() => {
    setHelpClosing(true);
    setTimeout(() => {
      setHelpOpen(false);
      setHelpClosing(false);
    }, 140);
  }, []);

  const airdropToken = useCallback((token: SelectedToken) => {
    setHandoffToken(token);
    setSection("airdrop");
    setHasNavigated(true);
  }, []);

  // The Events panel's per-event "Send with Airdrop" hands over a token AND
  // a recipient list (a closed event's registrants). Only the token can be
  // pre-filled today — Airdrop's CSV importer is the only way in for rows,
  // and wiring a pre-filled recipient table through it is later tasks' work
  // (the draw and the richer manual-send tool). Surfacing the count here
  // keeps the hand-off honest about what actually carried over.
  const airdropRecipients = useCallback(
    (token: SelectedToken, recipients: Recipient[]) => {
      airdropToken(token);
      toast.show({
        detail:
          "Amounts aren't pre-filled yet — add them via the CSV importer below.",
        title: `${recipients.length} registered wallet${recipients.length === 1 ? "" : "s"} ready`,
        variant: "success",
      });
    },
    [airdropToken, toast]
  );

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

        <main
          className="flex flex-grow justify-center px-6 py-11 sm:px-8"
          data-nav={hasNavigated ? "repeat" : "first"}
        >
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
              ) : section === "events" ? (
                <Suspense
                  fallback={
                    <div className="h-40 animate-pulse rounded-xl border border-border-low bg-card" />
                  }
                >
                  <Events onAirdrop={airdropRecipients} />
                </Suspense>
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
        <GettingStartedModal isClosing={helpClosing} onClose={closeHelp} />
      ) : null}
    </div>
  );
}
