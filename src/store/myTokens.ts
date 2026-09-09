/**
 * "Mis tokens" — the localStorage list written after each successful bake
 * (RF-02.7).
 *
 * Reads are deliberately forgiving. A corrupt or half-written entry must never
 * break the Bake screen: the token exists on-chain regardless of what this
 * cache says, so every failure path returns an empty list rather than throwing.
 */

export const MY_TOKENS_KEY = "cookie-bakery:my-tokens";
export const MY_TOKENS_VERSION = 1;

export type TokenProgramKind = "token" | "token-2022";

export type MyToken = {
  /** ISO 8601. */
  createdAt: string;
  decimals: number;
  /** Kept locally only; never written on-chain. */
  description: string;
  metadataUri: string;
  mint: string;
  name: string;
  program: TokenProgramKind;
  /** Signature of the creating transaction. */
  signature: string;
  /** Initial supply in base units, as a string — JSON has no bigint. */
  supply: string;
  symbol: string;
};

type StoredShape = {
  tokens: MyToken[];
  v: number;
};

/** Minimal storage surface, so tests can pass a plain in-memory object. */
export type StorageLike = Pick<Storage, "getItem" | "setItem">;

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    // Access itself throws when site data is blocked.
    return null;
  }
}

function isMyToken(value: unknown): value is MyToken {
  if (typeof value !== "object" || value === null) return false;
  const token = value as Record<string, unknown>;
  return (
    typeof token.mint === "string" &&
    token.mint.length > 0 &&
    typeof token.name === "string" &&
    typeof token.symbol === "string" &&
    typeof token.decimals === "number" &&
    Number.isInteger(token.decimals) &&
    typeof token.supply === "string" &&
    (token.program === "token" || token.program === "token-2022")
  );
}

export function loadMyTokens(
  storage: StorageLike | null = defaultStorage()
): MyToken[] {
  if (!storage) return [];

  let raw: string | null;
  try {
    raw = storage.getItem(MY_TOKENS_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (typeof parsed !== "object" || parsed === null) return [];
  const { tokens, v } = parsed as Partial<StoredShape>;
  // An unknown version is treated as absent rather than migrated blindly.
  if (v !== MY_TOKENS_VERSION || !Array.isArray(tokens)) return [];

  return tokens.filter(isMyToken);
}

export function saveMyTokens(
  tokens: readonly MyToken[],
  storage: StorageLike | null = defaultStorage()
): void {
  if (!storage) return;
  const payload: StoredShape = {
    tokens: [...tokens],
    v: MY_TOKENS_VERSION,
  };
  try {
    storage.setItem(MY_TOKENS_KEY, JSON.stringify(payload));
  } catch {
    // Quota exceeded or storage disabled — the mint still exists on-chain.
  }
}

/** Prepend a token, replacing any earlier entry for the same mint. */
export function addMyToken(
  token: MyToken,
  storage: StorageLike | null = defaultStorage()
): MyToken[] {
  const next = [
    token,
    ...loadMyTokens(storage).filter((t) => t.mint !== token.mint),
  ];
  saveMyTokens(next, storage);
  return next;
}
