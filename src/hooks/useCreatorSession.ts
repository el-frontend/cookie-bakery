import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { useClient } from "@solana/react";
import {
  useConnectedWallet,
  useSignMessage,
} from "@solana/kit-plugin-wallet/react";
import { supabase } from "../lib/supabase/client";
import type { AppClient } from "../providers";

/**
 * The creator's wallet IS the account (spec §2).
 *
 * Sign-In-With-Solana signs a message OFF-CHAIN, so Cookie Chain's wallet
 * chain identifier never enters here — this is the one place in the app where
 * the chain does not matter.
 *
 * WHY THIS DOES NOT PASS `wallet` TO `signInWithWeb3`:
 *
 * `@supabase/auth-js`'s `SolanaWallet` type wants a `window.solana`-shaped
 * object — `signIn?()`, `publicKey?.toBase58()`, `signMessage?()` as directly
 * callable members. `useConnectedWallet(client).wallet` from
 * `@solana/kit-plugin-wallet/react` is a `UiWallet` (`@wallet-standard/ui`):
 * a handle carrying `chains`/`icon`/`name`/`version`/`accounts` only — no
 * callable `signIn`/`signMessage`/`publicKey`, by design (features are
 * resolved separately so a `UiWallet` can cross a realm boundary). Handing
 * `connected.wallet` to `signInWithWeb3({ wallet })` would fail at runtime
 * with "Wallet does not have a compatible signMessage() and
 * publicKey.toBase58() API" the moment auth-js's `'signMessage' in
 * resolvedWallet` check runs.
 *
 * So this hook drives the wallet itself, through the Kit plugin (which has
 * already resolved the Wallet Standard feature), and hands `signInWithWeb3`
 * the OTHER shape `SolanaWeb3Credentials` accepts: the pre-signed
 * `{ chain: "solana", message, signature }`, built from a plain `string` and
 * `Uint8Array` — no cast needed on either side.
 *
 * It also deliberately uses `solana:signMessage` rather than `solana:signIn`:
 * the spike in docs/decisions.md only confirmed Nightly's Solana entry
 * advertises `solana:signTransaction` and `solana:signAndSendTransaction`;
 * `solana:signIn` support was never checked, and one of the two open
 * upstream issues against `signInWithWeb3` is a wallet's `solana:signIn`
 * failing outright (Ledger). `solana:signMessage` is the one feature every
 * Wallet Standard Solana wallet is expected to implement, so the SIWS message
 * is built by hand below — mirroring the exact template `auth-js` itself
 * falls back to for a legacy `window.solana` wallet — and signed with a plain
 * message-signing prompt instead.
 *
 * UNVERIFIED end to end: this has not been run against a live Nightly and the
 * real Supabase auth server (Task 1's spike never happened). See
 * `.superpowers/sdd/2026-09-10-creator-events-phase-1/task-8-report.md` for
 * the full trace through both packages and what is still genuinely unknown.
 */

export function siwsStatement(): string {
  return "Sign in to Cookie Bakery to manage your airdrop events.";
}

export type CreatorSessionStatus = "loading" | "signed-in" | "signed-out";

export function useCreatorSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<CreatorSessionStatus>("loading");

  const client = useClient<AppClient>();
  const connected = useConnectedWallet(client);
  const { dispatchAsync: signMessage } = useSignMessage(client);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setStatus(data.session ? "signed-in" : "signed-out");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setStatus(next ? "signed-in" : "signed-out");
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async () => {
    if (!connected) {
      throw new Error(
        "Connect a wallet before signing in — use the connector at the top of the page."
      );
    }

    const domain = window.location.host;
    const uri = window.location.href;
    const issuedAt = new Date().toISOString();

    // The EIP-4361 / SIWS template auth-js's own fallback path builds for a
    // `window.solana`-shaped wallet — reproduced here so the message the
    // backend receives matches what it already knows how to parse.
    const message = [
      `${domain} wants you to sign in with your Solana account:`,
      connected.account.address,
      "",
      siwsStatement(),
      "",
      "Version: 1",
      `URI: ${uri}`,
      `Issued At: ${issuedAt}`,
    ].join("\n");

    const signature = await signMessage(new TextEncoder().encode(message));

    const { error } = await supabase.auth.signInWithWeb3({
      chain: "solana",
      message,
      signature,
    });
    if (error) throw new Error(error.message);
  }, [connected, signMessage]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return { session, signIn, signOut, status };
}
