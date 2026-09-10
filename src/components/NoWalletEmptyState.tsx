import { EmptyState } from "./EmptyState";
import { NIGHTLY_URL, nightlyHelpUrl } from "../lib/chain/links";

/**
 * Shown when discovery has settled and found nothing.
 *
 * This is the failure mode a wrong `VITE_WALLET_CHAIN` produces — wallets that
 * do not advertise the configured chain are filtered out silently, so an empty
 * list looks exactly like "no wallet installed". Naming the configured chain
 * here is what makes the two distinguishable without opening a console.
 *
 * Built on the generic `EmptyState` (RF-06.2) rather than hand-rolled, so
 * there is one empty-state layout in the app instead of two that drift.
 */
export function NoWalletEmptyState({ chain }: { chain: string }) {
  return (
    <EmptyState
      action={{ href: NIGHTLY_URL, label: "Get Nightly" }}
      detail={`No installed wallet advertises ${chain}. Install Nightly to use Cookie Bakery.`}
      secondary={{ href: nightlyHelpUrl(), label: "How to connect Nightly" }}
      testId="no-wallet-empty-state"
      title="No wallet found"
    />
  );
}
