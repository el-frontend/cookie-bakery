import { createClient } from "@solana/kit";
import { solanaRpc } from "@solana/kit-plugin-rpc";
import { walletSigner } from "@solana/kit-plugin-wallet";
import { ClientProvider } from "@solana/react";
import { PropsWithChildren } from "react";
import { chainConfig } from "./lib/chain/config";

/**
 * Cookie Chain is a separate SVM. The wallet only ever SIGNS — `solanaRpc`
 * supplies the planner and executor, so `client.sendTransaction` submits
 * through our own `rpcUrl`, never the wallet's. See PRD RT-03.
 *
 * Plugin order matters: `solanaRpc` requires a `payer`, which `walletSigner`
 * installs. TypeScript enforces it.
 */
export const client = createClient()
  .use(walletSigner({ chain: chainConfig.chain }))
  // maxConcurrency 4: the Cookie Chain RPC is community-run (PRD §4).
  .use(solanaRpc({ maxConcurrency: 4, rpcUrl: chainConfig.rpcUrl }));

/** Exported so every `useClient<AppClient>()` call is typed end-to-end. */
export type AppClient = Awaited<typeof client>;

export function Providers({ children }: PropsWithChildren) {
  return <ClientProvider client={client}>{children}</ClientProvider>;
}
