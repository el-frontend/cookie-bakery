import type { ReactNode } from "react";
import { BakeryMark } from "../components/BakeryMark";
import { Footer } from "../components/Footer";
import { buttonClass } from "../components/ui/Button";
import { COOKIE_DOCS_URL, REPO_URL } from "../lib/chain/links";
import { APP_BASENAME } from "../surface";

/**
 * The page at `/` — the only one a hackathon judge, or anyone who has not
 * already been sent a link, arrives at cold.
 *
 * Three things constrain it:
 *
 * It carries no wallet, no RPC client and no router. `main.tsx` picks the
 * surface with a plain pathname match and lazy-loads this module, so the
 * landing's chunk is this file, `Footer` and the design system —
 * nothing from `@solana/kit` or `react-router`. Importing `providers.tsx`
 * here, even for a type, would build the Kit client at module-eval time and
 * undo that. Links into the app are plain anchors for the same reason: a full
 * navigation to `/app` is exactly what should happen.
 *
 * Every claim on it is sourced from README.md, and the uncomfortable half is
 * on the page too. A landing for a verifiable-draw tool that quietly omitted
 * "this is not a VRF" would be making the same unfalsifiable promise the draw
 * exists to avoid — so the limits sit in the draw section, at the same type
 * size as the pitch, rather than in a footnote.
 *
 * The copy is English (CLAUDE.md § Closed decisions) even though the PRD is
 * Spanish.
 */

const APP_URL = APP_BASENAME;

const SECTION = "mx-auto w-full max-w-[1040px] px-6 sm:px-8";

/** The three creator screens, in the order someone uses them. */
const FLOW = [
  {
    body: "Creates a Token-2022 mint with metadata, your token account and the whole initial supply in one transaction. Transfer fee, mint-close authority and authority revoke are there when you want them, and out of the way when you do not.",
    n: "01",
    title: "Bake",
  },
  {
    body: "Paste address,amount or drop a CSV, up to 1,000 rows. Every row is validated, duplicates are merged, the run is priced before you sign anything, then it sends batch by batch — pausable, with per-batch retry.",
    n: "02",
    title: "Airdrop",
  },
  {
    body: "Supply, decimals, authorities and the Token-2022 extensions actually switched on. Top-20 holders with a distribution chart, and every airdrop you have run from this browser.",
    n: "03",
    title: "Oven",
  },
];

/** The events loop, from the creator's side. */
const EVENT_STEPS = [
  {
    body: "Open an event against one of your tokens. You get a /e/<slug> link and a copy button.",
    title: "Open an event",
  },
  {
    body: "Your audience registers itself at that link — one mobile-first page where someone pastes their Cookie Chain address.",
    title: "They sign up",
  },
  {
    body: "Close registration, then draw winners at random, pick them by hand, or split a pot across everyone.",
    title: "Close and draw",
  },
  {
    body: "Winners go straight into the airdrop engine above, so batching, simulation, pause and retry all come along unchanged.",
    title: "Pay",
  },
];

/** Commit-reveal, in the order it happens on chain. */
const DRAW_STEPS = [
  {
    body: "Your browser generates a secret seed, publishes only its SHA-256, and writes that commitment on chain as a memo transaction.",
    label: "Commit",
  },
  {
    body: "The entropy comes from the blockhash of a slot about 150 ahead — roughly a minute out. Knowing the seed buys you nothing, because the hash it mixes with has not been produced yet.",
    label: "Wait for a block that does not exist",
  },
  {
    body: "Seed, target slot and result go on chain as a second memo. Both transactions are public and both are linked from the event.",
    label: "Reveal",
  },
  {
    body: "/e/<slug>/verify recomputes the whole draw in the visitor's own browser and shows each check passing or failing, with links to both memos on CookieScan.",
    label: "Anyone verifies",
  },
];

const SHOTS = [
  {
    caption:
      "Bake — one transaction creates the mint, the account and the supply.",
    height: 840,
    src: "/shots/bake.png",
    width: 1436,
  },
  {
    caption:
      "Airdrop — the run priced and simulated before a single signature.",
    height: 817,
    src: "/shots/airdrop.png",
    width: 1484,
  },
  {
    caption: "Oven — supply, authorities, extensions and the top holders.",
    height: 840,
    src: "/shots/oven.png",
    width: 1436,
  },
];

const STACK = [
  "@solana/kit",
  "Token-2022",
  "React 19",
  "Tailwind 4",
  "Supabase (events only)",
  "MIT",
];

export default function Landing() {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-bg1 text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[560px]"
        style={{
          backgroundImage:
            "radial-gradient(1100px 520px at 50% -10%, rgba(232,163,61,0.13), transparent 70%)",
        }}
      />

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="border-b border-border-low">
          <div
            className={`${SECTION} flex items-center justify-between gap-3 py-[18px]`}
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <BakeryMark />
              <span className="truncate font-display text-[17px] font-bold tracking-[-0.02em]">
                Cookie Bakery
              </span>
            </span>

            <span className="flex items-center gap-1 sm:gap-2">
              <a
                className={buttonClass({ variant: "ghost" })}
                href={REPO_URL}
                rel="noreferrer"
                target="_blank"
              >
                GitHub
              </a>
              <a className={buttonClass()} href={APP_URL}>
                Open the app
              </a>
            </span>
          </div>
        </header>

        <main className="flex-grow">
          <Hero />
          <Flow />
          <Events />
          <Draw />
          <Screenshots />
          <BuiltOn />
          <Closing />
        </main>

        <Footer />
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className={`${SECTION} pt-16 pb-20 sm:pt-24 sm:pb-28`}>
      <p className="enter enter-1 inline-flex items-center rounded-full border border-border-strong bg-card px-3 py-1.5 text-[12.5px] font-medium text-ink-2">
        Superteam Earn · Create an App on Cookie Chain
      </p>

      <h1 className="enter enter-2 mt-6 max-w-[15ch] font-display text-[clamp(2.5rem,7vw,4.25rem)] leading-[1.03] font-bold tracking-[-0.035em] text-balance">
        Launch a token. Airdrop it. Prove the draw.
      </h1>

      <p className="enter enter-3 mt-6 max-w-[58ch] text-[17px] leading-[1.65] text-ink-2 text-pretty">
        A 100% client-side token launcher and airdrop tool for Cookie Chain.
        There is no backend, no database and no server that ever sees a key:
        your wallet signs, your browser sends, and everything that has to
        survive a reload stays in{" "}
        <code className="font-mono">localStorage</code>.
      </p>

      <div className="enter enter-3 mt-9 flex flex-wrap items-center gap-3">
        <a className={buttonClass({ size: "lg" })} href={APP_URL}>
          Open the app
        </a>
        <a
          className={buttonClass({ size: "lg", variant: "secondary" })}
          href={REPO_URL}
          rel="noreferrer"
          target="_blank"
        >
          Read the source
        </a>
      </div>
    </section>
  );
}

function Flow() {
  return (
    <section className={`${SECTION} py-14 sm:py-20`}>
      <div className="reveal">
        <Heading
          eyebrow="The flow"
          title="Three screens, in the order you need them."
        />
      </div>

      <ol className="mt-10 grid gap-4 sm:grid-cols-3">
        {FLOW.map((step) => (
          <li
            className="reveal rounded-xl border border-border-low bg-card p-6"
            key={step.title}
          >
            <span className="num font-mono text-[12px] font-medium tracking-[0.08em] text-accent">
              {step.n}
            </span>
            <h3 className="mt-3 font-display text-[21px] font-bold tracking-[-0.02em]">
              {step.title}
            </h3>
            <p className="mt-2.5 text-[14.5px] leading-[1.6] text-ink-2">
              {step.body}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Events() {
  return (
    <section className={`${SECTION} py-14 sm:py-20`}>
      <div className="reveal">
        <Heading
          eyebrow="Airdrop events"
          title="Your audience builds the list."
        />
        <p className="mt-6 max-w-[62ch] text-[17px] leading-[1.65] text-ink-2 text-pretty">
          The Airdrop screen starts with a CSV. Nobody has one. A creator with
          an audience has names in a chat, not a column of base58 addresses —
          and that gap is where the tool stopped being useful. Events close it.
        </p>
      </div>

      <ol className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border-low bg-border-low sm:grid-cols-2">
        {EVENT_STEPS.map((step, i) => (
          <li className="reveal bg-card p-6" key={step.title}>
            <h3 className="flex items-center gap-2.5 font-display text-[17px] font-bold tracking-[-0.02em]">
              <span
                aria-hidden
                className="num inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-raised font-mono text-[12px] font-medium text-accent"
              >
                {i + 1}
              </span>
              {step.title}
            </h3>
            <p className="mt-2.5 text-[14.5px] leading-[1.6] text-ink-2">
              {step.body}
            </p>
          </li>
        ))}
      </ol>

      <div className="reveal">
        <p className="mt-6 text-[14.5px] text-ink-3">
          Registering costs a follower nothing — no COOK, no gas, no signature.
        </p>
      </div>
    </section>
  );
}

function Draw() {
  return (
    <section className={`${SECTION} py-14 sm:py-20`}>
      <div className="reveal">
        <Heading
          eyebrow="Verifiable draws"
          title="The draw is checkable by anyone."
        />
        <p className="mt-6 max-w-[62ch] text-[17px] leading-[1.65] text-ink-2 text-pretty">
          A giveaway where the host announces a winner and nobody can check is
          the normal case, and it is worth nothing. So the draw is
          commit-reveal, seeded by a Cookie Chain block that does not exist yet
          when the commitment is made.
        </p>
      </div>

      <ol className="mt-10 flex flex-col gap-px overflow-hidden rounded-xl border border-border-low bg-border-low">
        {DRAW_STEPS.map((step, i) => (
          <li
            className="reveal flex flex-col gap-2 bg-card p-6 sm:flex-row sm:gap-8"
            key={step.label}
          >
            <h3 className="font-display text-[16px] font-bold tracking-[-0.02em] sm:w-[16rem] sm:shrink-0">
              <span
                aria-hidden
                className="num mr-2 font-mono text-[12px] font-medium text-accent"
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              {step.label}
            </h3>
            <p className="text-[14.5px] leading-[1.6] text-ink-2">
              {step.body}
            </p>
          </li>
        ))}
      </ol>

      <div className="reveal mt-4 grid gap-4 sm:grid-cols-2">
        <p className="rounded-xl border border-border-low bg-raised p-6 text-[14.5px] leading-[1.6] text-ink-2">
          <strong className="font-semibold text-ink">
            It is not a VRF, and it does not make the entry list honest.
          </strong>{" "}
          A validator producing the target block has marginal influence over the
          outcome, and a creator could have padded the list with their own
          wallets. This makes the draw checkable, not the creator trustworthy.
        </p>
        <p className="rounded-xl border border-border-low bg-raised p-6 text-[14.5px] leading-[1.6] text-ink-2">
          <strong className="font-semibold text-ink">
            Nobody learns who holds which wallet.
          </strong>{" "}
          The draw runs over salted commitments — SHA-256 of the event id and
          the address — never over addresses. No address ever appears on the
          verify page; a participant checks their own inclusion by hashing their
          own address locally.
        </p>
      </div>
    </section>
  );
}

function Screenshots() {
  return (
    <section className={`${SECTION} py-14 sm:py-20`}>
      <div className="reveal">
        <Heading eyebrow="Screens" title="What it actually looks like." />
      </div>

      <div className="mt-10 flex flex-col gap-10">
        {SHOTS.map((shot) => (
          <div className="reveal" key={shot.src}>
            <figure>
              <img
                alt={shot.caption}
                className="w-full rounded-xl border border-border-low"
                decoding="async"
                height={shot.height}
                loading="lazy"
                referrerPolicy="no-referrer"
                src={shot.src}
                width={shot.width}
              />
              <figcaption className="mt-3 text-[13.5px] text-ink-3">
                {shot.caption}
              </figcaption>
            </figure>
          </div>
        ))}
      </div>
    </section>
  );
}

function BuiltOn() {
  return (
    <section className={`${SECTION} py-14 sm:py-20`}>
      <div className="reveal">
        <Heading
          eyebrow="Built on"
          title="No backend. No database. No private keys."
        />
        <p className="mt-6 max-w-[62ch] text-[17px] leading-[1.65] text-ink-2 text-pretty">
          Everything runs in your browser. The wallet signs, the app sends
          through Cookie Chain's own RPC, and nothing is ever custodied. The one
          server in the picture belongs to airdrop events, where an anonymous
          visitor can insert their own entry and can never read one back —
          enforced by row-level security, which has its own suite running
          against real Postgres.
        </p>

        <ul className="mt-8 flex flex-wrap gap-2">
          {STACK.map((item) => (
            <li
              className="rounded-full border border-border-strong bg-card px-3.5 py-1.5 font-mono text-[12.5px] text-ink-2"
              key={item}
            >
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Closing() {
  return (
    <section className={`${SECTION} pt-10 pb-24 sm:pb-32`}>
      <div className="reveal rounded-xl border border-border-low bg-card px-6 py-12 text-center sm:px-10 sm:py-16">
        <h2 className="mx-auto max-w-[20ch] font-display text-[clamp(1.75rem,4vw,2.5rem)] leading-[1.1] font-bold tracking-[-0.03em] text-balance">
          Bake something and give it away.
        </h2>
        <p className="mx-auto mt-4 max-w-[46ch] text-[15.5px] leading-[1.6] text-ink-2 text-pretty">
          You need a Cookie Chain wallet with a little COOK for fees. Nothing
          else — no sign-up, no account, no key ever leaves your browser.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a className={buttonClass({ size: "lg" })} href={APP_URL}>
            Open the app
          </a>
          <a
            className={buttonClass({ size: "lg", variant: "secondary" })}
            href={COOKIE_DOCS_URL}
            rel="noreferrer"
            target="_blank"
          >
            New to Cookie Chain?
          </a>
        </div>
      </div>
    </section>
  );
}

function Heading({ eyebrow, title }: { eyebrow: string; title: ReactNode }) {
  return (
    <>
      <p className="font-mono text-[12px] font-medium tracking-[0.12em] text-accent uppercase">
        {eyebrow}
      </p>
      <h2 className="mt-3 max-w-[20ch] font-display text-[clamp(1.75rem,4vw,2.5rem)] leading-[1.1] font-bold tracking-[-0.03em] text-balance">
        {title}
      </h2>
    </>
  );
}
