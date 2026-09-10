import { chainConfig, type ChainConfig } from "./config";

/**
 * Off-app destinations, in one place (RF-06.3).
 *
 * The two that vary by deployment — the explorer and the bridge — are read
 * from `chainConfig` rather than written down again here. A footer with a
 * hardcoded `cookiescan.io` would keep pointing at mainnet from a deploy
 * configured for anything else, which is precisely the class of bug that
 * `VITE_EXPLORER_URL` exists to prevent.
 *
 * The rest are project constants: they belong to the Cookie Chain ecosystem,
 * not to this deployment, so an env var for them would be ceremony. Sources
 * are PRD §12.
 */

/** PRD §11: the public repo for this project. */
export const REPO_URL = "https://github.com/el-frontend/cookie-bakery";

/** The anchor the "no wallet" empty state and the help modal both point at. */
export const NIGHTLY_HELP_ANCHOR = "#how-to-connect-nightly";

export const NIGHTLY_URL = "https://nightly.app";
export const COOKIE_DOCS_URL = "https://docs.cookiechain.wtf/getting-started";
export const COOKIE_TELEGRAM_URL = "https://t.me/TheCookieNetChain";

/** CookieSwap, for the "create a pool" action in the Oven (PRD §1.5). */
export const COOKIESWAP_URL = "https://cookieswap.io";

export type EcosystemLink = {
  /** Why someone would click it — the footer shows this as a title. */
  description: string;
  href: string;
  label: string;
};

export function makeEcosystemLinks(
  config: Pick<ChainConfig, "bridgeUrl" | "explorerUrl">
): EcosystemLink[] {
  return [
    {
      description: "Source code, setup and the demo token addresses",
      href: REPO_URL,
      label: "GitHub",
    },
    {
      description: "Cookie Chain block explorer",
      href: config.explorerUrl,
      label: "CookieScan",
    },
    {
      description: "Cookie Chain developer documentation",
      href: COOKIE_DOCS_URL,
      label: "Docs",
    },
    {
      description: "Bridge assets in to get COOK for fees",
      href: config.bridgeUrl,
      label: "Bridge",
    },
    {
      description: "The Cookie Chain community",
      href: COOKIE_TELEGRAM_URL,
      label: "Telegram",
    },
  ];
}

export const ecosystemLinks = makeEcosystemLinks(chainConfig);

/** Deep link that pre-selects the mint on CookieSwap's pool creation form. */
export function cookieSwapPoolUrl(mint: string): string {
  return `${COOKIESWAP_URL}/pool/create?base=${encodeURIComponent(mint)}`;
}

/** The README section the empty states link to for wallet setup. */
export function nightlyHelpUrl(): string {
  return `${REPO_URL}${NIGHTLY_HELP_ANCHOR}`;
}
