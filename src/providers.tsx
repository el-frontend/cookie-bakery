import { createClient } from "@solana/kit";
import { solanaRpc } from "@solana/kit-plugin-rpc";
import { walletSigner } from "@solana/kit-plugin-wallet";
import { ClientProvider } from "@solana/react";
import { PropsWithChildren } from "react";

/**
 * Cookie Chain is a separate SVM. The wallet only ever SIGNS — `solanaRpc`
 * supplies the planner and executor, so `client.sendTransaction` submits
 * through our own `rpcUrl`, never the wallet's. See PRD RT-03.
 *
 * Plugin order matters: `solanaRpc` requires a `payer`, which `walletSigner`
 * installs. TypeScript enforces it.
 */
const rpcUrl = import.meta.env.VITE_RPC_URL ?? "https://rpc.cookiescan.io";

/**
 * Wallet Standard chain identifier. Discovery filters on
 * `uiWallet.chains.includes(chain)`, so a value no wallet advertises yields an
 * empty wallet list with no error. Resolved by the RF-01.1 spike.
 *
 * The plugin accepts any `namespace:reference` identifier, not just the four
 * `solana:*` literals — Cookie Chain may well advertise its own. We only
 * enforce the shape here; RF-01.2 moves this into `src/lib/chain/config.ts`.
 */
function asChainIdentifier(value: string): `${string}:${string}` {
  if (!/^[^:]+:[^:]+$/.test(value)) {
    throw new Error(
      `VITE_WALLET_CHAIN must look like "namespace:reference" (e.g. "solana:mainnet"), got "${value}"`
    );
  }
  return value as `${string}:${string}`;
}

const chain = asChainIdentifier(
  import.meta.env.VITE_WALLET_CHAIN ?? "solana:mainnet"
);

export const client = createClient()
  .use(walletSigner({ chain }))
  // maxConcurrency 4: the Cookie Chain RPC is community-run (PRD §4).
  .use(solanaRpc({ maxConcurrency: 4, rpcUrl }));

/** Exported so every `useClient<AppClient>()` call is typed end-to-end. */
export type AppClient = Awaited<typeof client>;

export function Providers({ children }: PropsWithChildren) {
  return <ClientProvider client={client}>{children}</ClientProvider>;
}
