/**
 * Network configuration, read once from the Vite env and validated eagerly so a
 * misconfigured deploy fails at startup with a readable message instead of
 * surfacing as a mysterious empty wallet list or a silent RPC timeout.
 */

/** A Wallet Standard chain identifier: `namespace:reference`. */
export type ChainIdentifier = `${string}:${string}`;

export type ChainConfig = {
  readonly bridgeUrl: string;
  readonly chain: ChainIdentifier;
  readonly dasUrl: string;
  readonly explorerUrl: string;
  readonly rpcUrl: string;
};

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

/** Raw env shape, kept separate so tests can supply their own record. */
export type RawEnv = Readonly<Record<string, string | undefined>>;

/** The five variables `.env.example` documents. All are mandatory. */
export type RequiredVar =
  | "VITE_BRIDGE_URL"
  | "VITE_DAS_URL"
  | "VITE_EXPLORER_URL"
  | "VITE_RPC_URL"
  | "VITE_WALLET_CHAIN";

function requireVar(env: RawEnv, name: RequiredVar): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new ConfigError(
      `Missing ${name}. Copy .env.example to .env and fill it in.`
    );
  }
  return value;
}

function requireHttpsUrl(env: RawEnv, name: RequiredVar): string {
  const value = requireVar(env, name);
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ConfigError(`${name} is not a valid URL: "${value}"`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new ConfigError(
      `${name} must be an http(s) URL, got "${parsed.protocol}//"`
    );
  }
  return value.replace(/\/+$/, "");
}

/**
 * Validates the SHAPE of the chain identifier, not membership of a fixed list.
 *
 * `walletSigner` types this as `SolanaChain | (IdentifierString & {})` and is
 * chain-agnostic at runtime, so a custom namespace is legitimate — Cookie Chain
 * may advertise one. A non-`solana` namespace is worth a warning, not a failure.
 */
export function parseChainIdentifier(
  value: string,
  warn: (message: string) => void = console.warn
): ChainIdentifier {
  if (!/^[^\s:]+:[^\s:]+$/.test(value)) {
    throw new ConfigError(
      `VITE_WALLET_CHAIN must look like "namespace:reference" (e.g. "solana:mainnet"), got "${value}"`
    );
  }
  if (!value.startsWith("solana:")) {
    warn(
      `VITE_WALLET_CHAIN="${value}" uses a non-solana namespace. That is allowed, ` +
        `but wallets that do not advertise this exact chain are filtered out of ` +
        `discovery and the wallet list will look empty.`
    );
  }
  return value as ChainIdentifier;
}

export function loadChainConfig(
  env: RawEnv,
  warn: (message: string) => void = console.warn
): ChainConfig {
  return {
    bridgeUrl: requireHttpsUrl(env, "VITE_BRIDGE_URL"),
    chain: parseChainIdentifier(requireVar(env, "VITE_WALLET_CHAIN"), warn),
    dasUrl: requireHttpsUrl(env, "VITE_DAS_URL"),
    explorerUrl: requireHttpsUrl(env, "VITE_EXPLORER_URL"),
    rpcUrl: requireHttpsUrl(env, "VITE_RPC_URL"),
  };
}

export const chainConfig: ChainConfig = loadChainConfig(import.meta.env);
