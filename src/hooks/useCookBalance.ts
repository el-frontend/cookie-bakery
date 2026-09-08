import type { Address, Lamports } from "@solana/kit";
import { useClient } from "@solana/react";
import { useTrackedDataSWR } from "@solana/react/swr";
import { useMemo } from "react";
import type { AppClient } from "../providers";

/**
 * Live COOK balance for an account.
 *
 * Uses `useTrackedDataSWR` rather than a hand-rolled `getBalance` +
 * `accountNotifications` pair: it fires both together and slot-dedupes them, so
 * an out-of-order websocket frame can never make the displayed balance go
 * backwards. Cookie Chain exposes a websocket (verified in docs/decisions.md),
 * so no polling fallback is needed.
 */
export function useCookBalance(accountAddress?: Address) {
  const { rpc, rpcSubscriptions } = useClient<AppClient>();

  // Passing `null` is what gates the hook off when there is no address. The
  // spec must be memoised: its identity drives teardown and re-subscription.
  const spec = useMemo(
    () =>
      accountAddress
        ? {
            initialValueSource: rpc.getBalance(accountAddress, {
              commitment: "confirmed" as const,
            }),
            initialValueMapper: (value: Lamports) => value,
            streamSource: rpcSubscriptions.accountNotifications(
              accountAddress,
              {
                commitment: "confirmed" as const,
              }
            ),
            streamValueMapper: ({ lamports }: { lamports: Lamports }) =>
              lamports,
          }
        : null,
    [rpc, rpcSubscriptions, accountAddress]
  );

  const { data, error } = useTrackedDataSWR(
    accountAddress ? ["cook-balance", accountAddress] : null,
    spec
  );

  return {
    error,
    isLoading: accountAddress != null && data == null && error == null,
    lamports: data?.value ?? null,
  };
}
