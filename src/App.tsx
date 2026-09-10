import { useState } from "react";
import { useClient } from "@solana/react";
import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";
import { Airdrop } from "./app/Airdrop";
import { Bake } from "./app/Bake";
import { TopBar, type Section } from "./components/TopBar";
import { WalletButton } from "./components/WalletButton";
import { client, type AppClient } from "./providers";

/**
 * The warm-dark shell.
 *
 * The single radial glow at the top is the only ambient treatment — it gives
 * the canvas depth without competing with the one accent. Everything else is
 * flat surfaces and hairlines.
 */
export default function App() {
  const [section, setSection] = useState<Section>("bake");
  // The top bar already carries the address and balance, so the full wallet
  // panel is only worth its space while there is nothing connected.
  const connected = useConnectedWallet(useClient<AppClient>());

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
        <TopBar active={section} onNavigate={setSection} />

        <main className="flex flex-grow justify-center px-6 py-11 sm:px-8">
          {/*
           * Airdrop is wider than Bake on purpose: it carries a recipient
           * table, and squeezing 44-character addresses into the form column
           * would wrap every row.
           */}
          <div
            className={
              "w-full " +
              (section === "airdrop" ? "max-w-[760px]" : "max-w-[560px]")
            }
          >
            {section === "oven" ? (
              <ComingSoon />
            ) : (
              <div className="flex flex-col gap-6">
                {connected ? null : <WalletButton client={client} />}
                {section === "bake" ? (
                  <Bake client={client} />
                ) : (
                  <Airdrop client={client} />
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

/** Only the Oven is left unbuilt; Bake and Airdrop are real screens. */
function ComingSoon() {
  const copy = {
    detail:
      "Supply, holders and the distribution of a mint you created, with the airdrops that produced it.",
    title: "Oven",
  };

  return (
    <section className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border-strong bg-card/40 px-6 py-14 text-center">
      <h2 className="font-display text-2xl font-bold tracking-[-0.03em]">
        {copy.title}
      </h2>
      <p className="max-w-[360px] text-sm leading-relaxed text-ink-2">
        {copy.detail}
      </p>
      <span className="mt-1 rounded-full bg-raised px-3 py-1 text-[11.5px] font-semibold text-ink-3">
        Designed, not built yet
      </span>
    </section>
  );
}
