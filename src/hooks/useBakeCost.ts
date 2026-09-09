import { useEffect, useMemo, useRef, useState } from "react";
import { address, type ClientWithGetMinimumBalance } from "@solana/kit";
import { estimateBakeCost, type BakeCost } from "../lib/token/sizing";
import { buildMintExtensions } from "../lib/token/sizing";
import type { ExtensionArgs } from "@solana-program/token-2022";

/**
 * Live cost preview for the Bake form.
 *
 * Account SIZES depend only on the shape of an address, never its value, so
 * the cost can be shown before the mint keypair exists. A fixed stand-in keeps
 * the estimate honest without generating a throwaway keypair per keystroke.
 */
const SIZE_PLACEHOLDER = address("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

/** Rent for a given size never changes, so one lookup per size is enough. */
const rentCache = new Map<number, bigint>();

function cachingClient(
  client: ClientWithGetMinimumBalance
): ClientWithGetMinimumBalance {
  return {
    ...client,
    getMinimumBalance: (async (space: number) => {
      const hit = rentCache.get(space);
      if (hit !== undefined) return hit;
      const value = BigInt(await client.getMinimumBalance(space));
      rentCache.set(space, value);
      return value;
    }) as ClientWithGetMinimumBalance["getMinimumBalance"],
  } as ClientWithGetMinimumBalance;
}

export type BakeCostInput = {
  mintCloseAuthority: boolean;
  name: string;
  symbol: string;
  token2022: boolean;
  transferFee: { basisPoints: number; maximumFee: bigint } | null;
  uri: string;
};

export function useBakeCost(
  client: ClientWithGetMinimumBalance,
  input: BakeCostInput | null
): BakeCost | null {
  const [cost, setCost] = useState<BakeCost | null>(null);
  const cached = useRef(cachingClient(client));

  // Only the fields that move the SIZE belong in the dependency key; retyping
  // a description must not re-estimate.
  const key = input
    ? JSON.stringify({
        c: input.mintCloseAuthority,
        f: input.transferFee
          ? [
              input.transferFee.basisPoints,
              input.transferFee.maximumFee.toString(),
            ]
          : null,
        n: input.name.length,
        s: input.symbol.length,
        t: input.token2022,
        u: input.uri.length,
      })
    : null;

  const extensions: ExtensionArgs[] = useMemo(() => {
    if (!input || !input.token2022) return [];
    return buildMintExtensions({
      authority: SIZE_PLACEHOLDER,
      mint: SIZE_PLACEHOLDER,
      mintCloseAuthority: input.mintCloseAuthority,
      name: input.name,
      symbol: input.symbol,
      transferFee: input.transferFee,
      uri: input.uri,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (key === null) {
      setCost(null);
      return;
    }
    let cancelled = false;
    // Debounced: typing a name should not fire a request per character.
    const timer = setTimeout(() => {
      void estimateBakeCost(cached.current, extensions)
        .then((next) => {
          if (!cancelled) setCost(next);
        })
        .catch(() => {
          if (!cancelled) setCost(null);
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [extensions, key]);

  return cost;
}
