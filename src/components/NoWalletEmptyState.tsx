/**
 * Shown when discovery has settled and found nothing.
 *
 * This is the failure mode a wrong `VITE_WALLET_CHAIN` produces — wallets that
 * do not advertise the configured chain are filtered out silently, so an empty
 * list looks exactly like "no wallet installed". Naming the configured chain
 * here is what makes the two distinguishable without opening a console.
 */
export function NoWalletEmptyState({ chain }: { chain: string }) {
  return (
    <div
      data-testid="no-wallet-empty-state"
      className="space-y-3 rounded-xl border border-border-low bg-cream px-4 py-4 text-sm"
    >
      <p className="font-medium">No wallet found</p>
      <p className="text-muted">
        No installed wallet advertises{" "}
        <code className="font-mono text-xs">{chain}</code>. Install Nightly to
        use Cookie Bakery.
      </p>
      <p className="flex flex-wrap gap-3">
        <a
          className="font-medium underline underline-offset-2"
          href="https://nightly.app"
          target="_blank"
          rel="noreferrer"
        >
          Get Nightly
        </a>
        <a
          className="font-medium underline underline-offset-2"
          href="https://github.com/el-frontend/cookie-bakery#how-to-connect-nightly"
          target="_blank"
          rel="noreferrer"
        >
          How to connect Nightly
        </a>
      </p>
    </div>
  );
}
