import { useEffect } from "react";
import { useAction, useClient } from "@solana/react";
import {
  useConnectedWallet,
  useWallets,
} from "@solana/kit-plugin-wallet/react";
import { useCreatorSession } from "../hooks/useCreatorSession";
import { useToast } from "../hooks/useToast";
import { chainConfig } from "../lib/chain/config";
import type { AppClient } from "../providers";
import { NoWalletEmptyState } from "./NoWalletEmptyState";
import { Button } from "./ui/Button";

/**
 * The gate rendered in place of the Events panel when signed out (RF §2).
 *
 * One primary action — sign in with the connected wallet — plus the same
 * "no wallet" empty state the rest of the app uses, so a missing wallet reads
 * the same way here as it does on Bake/Airdrop/Oven instead of inventing a
 * second explanation for the same problem.
 *
 * `useAction` (not a hand-rolled `useState` + `try/catch`) drives the click:
 * `dispatch` never throws, so a rejected signature or a failed
 * `signInWithWeb3` call surfaces through `error` instead of an unhandled
 * rejection in `onClick`.
 */
export function CreatorSignIn() {
  const client = useClient<AppClient>();
  const wallets = useWallets(client);
  const connected = useConnectedWallet(client);
  const { signIn } = useCreatorSession();
  const toast = useToast();

  const {
    dispatch: startSignIn,
    error: signInError,
    isRunning,
    reset: resetSignIn,
  } = useAction(signIn);

  // A failed sign-in is otherwise silent: the button just stops spinning.
  useEffect(() => {
    if (!signInError) return;
    toast.show({
      detail:
        signInError instanceof Error
          ? signInError.message
          : "Please try again.",
      title: "Sign-in failed",
      variant: "error",
    });
    resetSignIn();
  }, [signInError, resetSignIn, toast]);

  if (wallets.length === 0) {
    return <NoWalletEmptyState chain={chainConfig.chain} />;
  }

  return (
    <section
      aria-label="Sign in to manage events"
      className="flex flex-col items-center gap-4 rounded-2xl border border-border-low bg-card px-6 py-12 text-center shadow-[0_20px_80px_-50px_rgba(0,0,0,0.35)]"
      data-testid="creator-sign-in"
    >
      <h2 className="font-display text-2xl font-bold tracking-[-0.03em]">
        Sign in to manage your events
      </h2>
      <p className="max-w-[420px] text-sm leading-relaxed text-ink-2">
        One free signature proves you own this wallet — Cookie Bakery never asks
        you to approve a transaction just to sign in.
      </p>
      <Button
        disabled={!connected || isRunning}
        disabledReason={
          connected ? undefined : "Connect a wallet first to sign in."
        }
        onClick={() => startSignIn()}
      >
        {isRunning ? "Check your wallet…" : "Sign in with wallet"}
      </Button>
    </section>
  );
}
