import { chainConfig, type ChainConfig } from "./config";

/**
 * CookieScan link builders. Every explorer link in the app goes through here so
 * the base URL stays configurable and the path patterns live in one place.
 */
export function makeExplorerLinks(config: Pick<ChainConfig, "explorerUrl">) {
  const base = config.explorerUrl.replace(/\/+$/, "");
  return {
    addressUrl: (address: string) => `${base}/address/${address}`,
    tokenUrl: (mint: string) => `${base}/token/${mint}`,
    txUrl: (signature: string) => `${base}/tx/${signature}`,
  };
}

export const explorer = makeExplorerLinks(chainConfig);
