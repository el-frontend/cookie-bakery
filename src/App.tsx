import { lazy, Suspense, useCallback, useState } from "react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
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
import type { PayoutEventContext } from "./lib/supabase/payouts";
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
 * The shell owns the one piece of cross-screen state: the token (and,
 * optionally, a recipient list) the Oven or an event hands to the Airdrop
 * screen. Keeping it here rather than in a store means it cannot outlive the
 * navigation that created it — a preselected token that survived a reload
 * would be a confusing default.
 */
type AirdropHandoff = {
  /** Present only when the recipients came from an event; drives the `payouts` mirror. */
  eventContext?: PayoutEventContext;
  /** Null for a bare token hand-off (Oven's "Airdrop more") — nothing to preload yet. */
  recipients: Recipient[] | null;
  token: SelectedToken;
};

/**
 * Marks the one history entry a hand-off created.
 *
 * The payload stays in React state — recipient lists are too big for the
 * history entry, and `history.state` survives a reload, which is exactly the
 * confusing default the comment above rules out. What goes in the history
 * entry is this flag, so the Airdrop screen preloads only when the CURRENT
 * entry is the one that carried the hand-off. Clicking "Airdrop" in the top
 * bar pushes an entry without it and gets a clean screen; going Back past the
 * hand-off does too; going Forward onto it again restores the preload. After
 * a reload the flag outlives the payload, and a null payload preloads
 * nothing — which is the behaviour we want anyway.
 */
type HandoffMarker = { handoff?: boolean };

const SECTION_PATHS: Record<Section, string> = {
  airdrop: "/airdrop",
  bake: "/bake",
  events: "/events",
  oven: "/oven",
};

/**
 * Which nav pill is lit, derived from the URL rather than held alongside it.
 *
 * Two sources of truth for "where am I" is how a back button ends up moving
 * the URL without moving the screen. Unknown paths report `bake` to match the
 * catch-all route below, so the highlight never goes blank mid-redirect.
 */
export function sectionFromPathname(pathname: string): Section {
  const first = pathname.split("/").filter(Boolean)[0];
  if (first === "airdrop" || first === "events" || first === "oven") {
    return first;
  }
  return "bake";
}

export default function App() {
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpClosing, setHelpClosing] = useState(false);
  const [handoff, setHandoff] = useState<AirdropHandoff | null>(null);
  const [hasNavigated, setHasNavigated] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const section = sectionFromPathname(location.pathname);
  const carriesHandoff = (location.state as HandoffMarker | null)?.handoff;

  const connected = useConnectedWallet(useClient<AppClient>());
  const toast = useToast();

  const go = useCallback(
    (next: Section) => {
      setHasNavigated(true);
      navigate(SECTION_PATHS[next]);
    },
    [navigate]
  );

  const closeHelp = useCallback(() => {
    setHelpClosing(true);
    setTimeout(() => {
      setHelpOpen(false);
      setHelpClosing(false);
    }, 140);
  }, []);

  const airdropToken = useCallback(
    (token: SelectedToken) => {
      setHandoff({ recipients: null, token });
      setHasNavigated(true);
      navigate(SECTION_PATHS.airdrop, { state: { handoff: true } });
    },
    [navigate]
  );

  /**
   * The Events panel's one way into Airdrop, shared by two callers:
   * `EventCard`'s "Send with Airdrop" (a closed event's registrants, still
   * `0n` placeholder amounts — nothing safe to preload, so this only carries
   * the token over, same as the Oven) and `EventPayout`'s three payout tools
   * (real, already-validated amounts plus `eventContext`, so the Airdrop
   * screen can skip straight to the plan/summary stage).
   */
  const airdropRecipients = useCallback(
    (
      token: SelectedToken,
      recipients: Recipient[],
      eventContext?: PayoutEventContext
    ) => {
      if (!eventContext) {
        airdropToken(token);
        toast.show({
          detail:
            "Amounts aren't pre-filled yet — add them via the CSV importer below.",
          title: `${recipients.length} registered wallet${recipients.length === 1 ? "" : "s"} ready`,
          variant: "success",
        });
        return;
      }
      setHandoff({ eventContext, recipients, token });
      setHasNavigated(true);
      navigate(SECTION_PATHS.airdrop, { state: { handoff: true } });
    },
    [airdropToken, navigate, toast]
  );

  const active = carriesHandoff ? handoff : null;

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
          onNavigate={go}
          onOpenHelp={() => setHelpOpen(true)}
        />

        <main
          className="flex flex-grow justify-center px-6 py-11 sm:px-8"
          data-nav={hasNavigated ? "repeat" : "first"}
        >
          <div
            className={
              "w-full " +
              (section === "bake" ? "max-w-[560px]" : "max-w-[760px]")
            }
          >
            <div className="flex flex-col gap-6">
              {connected ? null : <WalletButton client={client} />}

              <Routes>
                <Route path="/bake" element={<Bake client={client} />} />
                <Route
                  path="/airdrop"
                  element={
                    <Airdrop
                      client={client}
                      initialToken={active?.token ?? null}
                      onBake={() => go("bake")}
                      preloaded={
                        active?.recipients
                          ? {
                              eventContext: active.eventContext,
                              recipients: active.recipients,
                              token: active.token,
                            }
                          : null
                      }
                    />
                  }
                />
                <Route
                  path="/oven"
                  element={
                    <Oven
                      client={client}
                      onAirdrop={airdropToken}
                      onBake={() => go("bake")}
                    />
                  }
                />
                <Route
                  path="/events"
                  element={
                    <Suspense
                      fallback={
                        <div className="h-40 animate-pulse rounded-xl border border-border-low bg-card" />
                      }
                    >
                      <Events onAirdrop={airdropRecipients} />
                    </Suspense>
                  }
                />
                {/* `/app` itself, and anything unrecognised below it, is Bake. */}
                <Route
                  path="*"
                  element={<Navigate replace to={SECTION_PATHS.bake} />}
                />
              </Routes>
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
