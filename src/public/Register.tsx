import { useEffect, useState, type FormEvent } from "react";
import { isAddress } from "@solana/kit";
import {
  getPublicEvent,
  registerEntry,
  type PublicEvent,
} from "../lib/supabase/events";
import { Button } from "../components/ui/Button";
import { Field, Input } from "../components/ui/Field";

/**
 * The public registration page (RF §3).
 *
 * The only screen in the project opened on a phone — typically one-handed,
 * with a livestream running in the other hand, by someone who has never held
 * a wallet before. Every choice here optimises for that: single column,
 * paste-first, no jargon, no signature, no gas.
 */

const STORAGE_PREFIX = "cookie-bakery:registered:";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * Forgiving read, following `src/store/myTokens.ts`: a blocked or corrupt
 * store reads as "not registered" rather than throwing. A follower's phone
 * with a junk value in storage should still see a working form.
 */
function readRegistered(
  slug: string,
  storage: StorageLike | null = defaultStorage()
): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(STORAGE_PREFIX + slug) === "1";
  } catch {
    return false;
  }
}

function writeRegistered(
  slug: string,
  storage: StorageLike | null = defaultStorage()
): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_PREFIX + slug, "1");
  } catch {
    // Best-effort only. Worst case the visitor sees the form again next time,
    // which is exactly what happens today without this cache.
  }
}

// --- Wallet Standard, hand-rolled --------------------------------------
//
// This page must not pull in `@solana/kit-plugin-wallet` — or even the tiny
// `@wallet-standard/app` — just to answer "is a wallet installed?". That
// weight belongs to the signed-in app; a link opened from stream chat should
// cost the majority (who have no wallet) nothing extra to load. The two
// `window` events below are the ENTIRE Wallet Standard discovery protocol
// (https://github.com/wallet-standard/wallet-standard/blob/master/packages/core/base/src/window.ts):
// an app dispatches "app-ready" for wallets already loaded, and listens for
// "register-wallet" for wallets that inject afterwards. Replicating that by
// hand here adds zero bytes to the bundle for everyone who never sees the
// button it enables.

type WalletAccountLike = { readonly address: string };
type StandardConnectFeature = {
  connect: (input?: {
    silent?: boolean;
  }) => Promise<{ accounts: readonly WalletAccountLike[] }>;
};
type WalletLike = {
  readonly features: Readonly<Record<string, unknown>>;
  readonly name: string;
};

const STANDARD_CONNECT = "standard:connect";

function connectFeatureOf(wallet: WalletLike): StandardConnectFeature | null {
  const feature = wallet.features[STANDARD_CONNECT];
  if (
    typeof feature === "object" &&
    feature !== null &&
    typeof (feature as StandardConnectFeature).connect === "function"
  ) {
    return feature as StandardConnectFeature;
  }
  return null;
}

/** The first discovered wallet that can actually connect, or null. */
function useDiscoveredWallet(): WalletLike | null {
  const [wallet, setWallet] = useState<WalletLike | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const register = (...found: WalletLike[]) => {
      const usable = found.find((candidate) => connectFeatureOf(candidate));
      if (usable) setWallet((current) => current ?? usable);
    };

    const onRegisterEvent = (event: Event) => {
      const detail = (
        event as CustomEvent<(api: { register: typeof register }) => void>
      ).detail;
      detail({ register });
    };

    window.addEventListener("wallet-standard:register-wallet", onRegisterEvent);
    window.dispatchEvent(
      new CustomEvent("wallet-standard:app-ready", { detail: { register } })
    );

    return () =>
      window.removeEventListener(
        "wallet-standard:register-wallet",
        onRegisterEvent
      );
  }, []);

  return wallet;
}

// --- The screen ----------------------------------------------------------

type LoadPhase =
  | { kind: "loading" }
  | { kind: "not-found" }
  | { kind: "load-error" }
  | { kind: "loaded"; event: PublicEvent };

export function Register({ slug }: { slug: string }) {
  const [phase, setPhase] = useState<LoadPhase>({ kind: "loading" });
  const [localRegistered, setLocalRegistered] = useState(() =>
    readRegistered(slug)
  );
  const [submitResult, setSubmitResult] = useState<"already-registered" | null>(
    null
  );
  const [address, setAddress] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const wallet = useDiscoveredWallet();

  useEffect(() => {
    let cancelled = false;
    setPhase({ kind: "loading" });

    getPublicEvent(slug)
      .then((event) => {
        if (cancelled) return;
        // A draft is a creator's unpublished work. It must be indistinguishable
        // from a slug that never existed — never "closed", never anything that
        // confirms it exists at all.
        if (event === null || event.status === "draft") {
          setPhase({ kind: "not-found" });
          return;
        }
        setPhase({ kind: "loaded", event });
      })
      .catch(() => {
        if (!cancelled) setPhase({ kind: "load-error" });
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function handleConnect() {
    if (!wallet) return;
    const feature = connectFeatureOf(wallet);
    if (!feature) return;
    setConnecting(true);
    try {
      const { accounts } = await feature.connect();
      const account = accounts[0];
      if (account) {
        setAddress(account.address);
        setValidationError(null);
      }
    } catch {
      // The user closed the wallet prompt, or it failed. Pasting still works.
    } finally {
      setConnecting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (phase.kind !== "loaded") return;

    const trimmed = address.trim();
    if (!isAddress(trimmed)) {
      setValidationError(
        "That doesn't look like a valid base58 Cookie Chain address."
      );
      return;
    }

    setValidationError(null);
    setServerError(null);
    setSubmitting(true);
    try {
      const outcome = await registerEntry(phase.event.id, trimmed);
      // Either way this wallet is now on file — cache it locally so the two
      // outcomes converge to the same state next time this page loads.
      writeRegistered(slug);
      if (outcome === "already-registered") {
        setSubmitResult("already-registered");
      } else {
        setLocalRegistered(true);
      }
    } catch (error) {
      setServerError(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-dvh justify-center bg-bg1 px-4 py-10 text-ink sm:py-16">
      <div className="w-full max-w-md">
        {phase.kind === "loading" ? (
          <p
            role="status"
            className="animate-pulse py-24 text-center text-sm text-ink-2"
          >
            Loading giveaway…
          </p>
        ) : phase.kind === "not-found" ? (
          <NoticeCard
            title="We couldn't find that giveaway"
            body="Double-check the link the creator shared — it may be mistyped, or this giveaway may no longer be available."
          />
        ) : phase.kind === "load-error" ? (
          <NoticeCard
            title="Something went wrong"
            body="We couldn't load this giveaway. Check your connection and try reloading the page."
          />
        ) : localRegistered ? (
          <ConfirmedCard title={phase.event.title} />
        ) : phase.event.status === "closed" ? (
          <NoticeCard
            title="Registration closed"
            body={`This giveaway isn't taking new entries anymore${
              phase.event.entryCount > 0
                ? ` — ${phase.event.entryCount} people entered`
                : ""
            }. Keep an eye on the creator's channel for the results.`}
            eyebrow={phase.event.title}
          />
        ) : phase.event.status === "paid" ? (
          <NoticeCard
            title="Winners have been paid"
            body="This giveaway is over and prizes have already been sent out on-chain. Thanks for playing — watch for the next one!"
            eyebrow={phase.event.title}
          />
        ) : submitResult === "already-registered" ? (
          <NoticeCard
            title="Already registered"
            body={`This wallet has already entered ${phase.event.title} — you're all set, no need to do anything else.`}
          />
        ) : (
          <RegisterForm
            address={address}
            connecting={connecting}
            event={phase.event}
            onAddressChange={(value) => {
              setAddress(value);
              if (validationError) setValidationError(null);
            }}
            onConnect={handleConnect}
            onSubmit={handleSubmit}
            serverError={serverError}
            submitting={submitting}
            validationError={validationError}
            wallet={wallet}
          />
        )}
      </div>
    </main>
  );
}

/** A plain centred message — for states with no further action to offer. */
function NoticeCard({
  body,
  eyebrow,
  title,
}: {
  body: string;
  eyebrow?: string;
  title: string;
}) {
  return (
    <section className="enter flex flex-col items-center gap-3 rounded-xl border border-border-low bg-card px-6 py-12 text-center">
      {eyebrow ? (
        <p className="break-words font-display text-lg font-bold tracking-[-0.02em] text-ink-2">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="break-words font-display text-2xl font-bold tracking-[-0.03em]">
        {title}
      </h1>
      <p className="max-w-[320px] text-sm leading-relaxed text-ink-2">{body}</p>
    </section>
  );
}

/** The confirmation shown right after a successful registration, and again
 * on every later visit once `localStorage` remembers it. */
function ConfirmedCard({ title }: { title: string }) {
  return (
    <section className="pop-in flex flex-col items-center gap-4 rounded-xl border border-border-low bg-card px-6 py-12 text-center">
      <div className="flex h-[58px] w-[58px] items-center justify-center rounded-full border border-success/30 bg-success/12">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            className="check-draw"
            d="M5 12.5l4.5 4.5L19 7.5"
            stroke="var(--success)"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h1 className="break-words font-display text-2xl font-bold tracking-[-0.03em]">
        You're in!
      </h1>
      <p className="max-w-[320px] text-sm leading-relaxed text-ink-2">
        Your wallet is registered for {title}. Good luck — winners are picked
        and paid directly on-chain, so there's nothing else for you to do.
      </p>
    </section>
  );
}

function RegisterForm({
  address,
  connecting,
  event,
  onAddressChange,
  onConnect,
  onSubmit,
  serverError,
  submitting,
  validationError,
  wallet,
}: {
  address: string;
  connecting: boolean;
  event: PublicEvent;
  onAddressChange: (value: string) => void;
  onConnect: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  serverError: string | null;
  submitting: boolean;
  validationError: string | null;
  wallet: WalletLike | null;
}) {
  return (
    <section className="enter space-y-5 rounded-xl border border-border-low bg-card p-6">
      <header className="space-y-2 text-center">
        {event.mintSymbol ? (
          <span className="inline-flex items-center rounded-full bg-accent/12 px-2.5 py-1 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-accent">
            {event.mintSymbol} giveaway
          </span>
        ) : null}
        <h1 className="break-words font-display text-2xl font-bold tracking-[-0.03em]">
          {event.title}
        </h1>
        <p className="text-sm text-ink-2">
          <span className="num font-semibold text-ink">{event.entryCount}</span>{" "}
          {event.entryCount === 1 ? "person has" : "people have"} registered
        </p>
      </header>

      <p className="rounded-lg border border-border-low bg-bg1 px-3.5 py-3 text-[13px] leading-relaxed text-ink-2">
        Free to enter — no COOK, no gas fees, and no wallet signature required.
      </p>

      <form className="space-y-4" noValidate onSubmit={onSubmit}>
        <Field
          error={validationError ?? undefined}
          hint="paste it from your wallet app"
          label="Your Cookie Chain address"
        >
          <Input
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect="off"
            disabled={submitting}
            inputMode="text"
            invalid={Boolean(validationError)}
            onChange={(e) => onAddressChange(e.target.value)}
            placeholder="Paste your address here"
            spellCheck={false}
            // 16px, not the Field default: anything smaller makes iOS Safari
            // zoom the whole page on focus, which is disorienting one-handed.
            style={{ fontSize: "16px" }}
            value={address}
          />
        </Field>

        {wallet ? (
          <button
            className="text-sm font-medium text-ink-2 underline underline-offset-2 hover:text-ink disabled:opacity-50"
            disabled={connecting || submitting}
            onClick={onConnect}
            type="button"
          >
            {connecting ? "Connecting…" : `Or connect ${wallet.name}`}
          </button>
        ) : null}

        {serverError ? (
          <p role="alert" className="text-xs text-danger">
            {serverError}
          </p>
        ) : null}

        <Button
          className="w-full"
          disabled={submitting}
          size="lg"
          type="submit"
        >
          {submitting ? "Registering…" : "Count me in"}
        </Button>
      </form>
    </section>
  );
}
