import type { Address } from "@solana/kit";
import { chainConfig } from "./config";

/**
 * Typed client for CookieScan's DAS API (RF-04.1).
 *
 * Everything here was verified against the live endpoint on 2026-09-10; the
 * findings are written up in `docs/decisions.md` (incógnita #5 closed). The
 * three that shape this module:
 *
 * 1. **`params` is an OBJECT, not the positional array every other JSON-RPC
 *    method on this chain takes.** Passing an array returns
 *    `-32602 "Either 'mint' or 'owner' parameter is required"`.
 * 2. **Results come back ordered by `amount` descending**, stable across
 *    calls. So a top-20 is page 1 with `limit: 20` — no client-side sort and
 *    no full pagination needed for the common case.
 * 3. **`limit` is silently CLAMPED to 1000**, not rejected: asking for 5,000
 *    returns a page that echoes `limit: 1000`. A caller that trusted its own
 *    number would quietly believe it had every holder. This module clamps
 *    before sending so the request and the response always agree.
 *
 * `amount` arrives as a string and becomes a `bigint` here. It never passes
 * through `number`: the probe's largest holder alone was 484,085,512,066,266
 * base units, and supplies go far past 2^53.
 */

/** The server clamps to this silently. Verified 2026-09-10. */
export const DAS_MAX_LIMIT = 1000;

/** Holders shown in the table, and the natural page size for a top-N. */
export const DAS_DEFAULT_LIMIT = 20;

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * The DAS is a community service and the whole point of RF-04.2's fallback is
 * reacting to it being down, so every transport, HTTP and protocol failure
 * collapses into this one type. Callers switch on the type, not on prose.
 */
export class DasUnavailableError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "DasUnavailableError";
    this.cause = cause;
  }
}

export type DasTokenAccount = {
  /** The token account itself, not its owner. */
  address: Address;
  /** Base units. */
  amount: bigint;
  frozen: boolean;
  mint: Address;
  owner: Address;
  /** Identifies Token vs Token-2022 without a second read. */
  tokenProgram: Address;
};

export type DasTokenAccountsPage = {
  accounts: DasTokenAccount[];
  /** What the server actually used, which may be lower than requested. */
  limit: number;
  page: number;
  /** Holder count for the whole mint, free of charge — no pagination needed. */
  total: number;
};

export type DasOptions = {
  dasUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

type RawAccount = {
  address?: unknown;
  amount?: unknown;
  frozen?: unknown;
  mint?: unknown;
  owner?: unknown;
  token_program?: unknown;
};

function asAddress(value: unknown, field: string): Address {
  if (typeof value !== "string" || value.length === 0) {
    throw new DasUnavailableError(
      `The DAS returned a token account with no ${field}.`
    );
  }
  return value as Address;
}

/**
 * `amount` is a decimal string. `BigInt("")` is 0 and `BigInt("1.5")` throws,
 * so the digits are checked before conversion rather than after — a silent 0
 * here would render a holder as owning nothing.
 */
function asAmount(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  throw new DasUnavailableError(
    `The DAS returned an unusable token amount: ${JSON.stringify(value)}`
  );
}

function parseAccount(raw: RawAccount): DasTokenAccount {
  return {
    address: asAddress(raw.address, "address"),
    amount: asAmount(raw.amount),
    frozen: raw.frozen === true,
    mint: asAddress(raw.mint, "mint"),
    owner: asAddress(raw.owner, "owner"),
    tokenProgram: asAddress(raw.token_program, "token_program"),
  };
}

async function rpc(
  method: string,
  params: Record<string, unknown>,
  options: DasOptions = {}
): Promise<unknown> {
  const {
    dasUrl = chainConfig.dasUrl,
    fetchImpl = fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetchImpl(dasUrl, {
      body: JSON.stringify({ id: 1, jsonrpc: "2.0", method, params }),
      headers: { "content-type": "application/json" },
      method: "POST",
      signal: controller.signal,
    });
  } catch (cause) {
    throw new DasUnavailableError(
      "The CookieScan DAS API could not be reached.",
      cause
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new DasUnavailableError(
      `The CookieScan DAS API answered ${response.status}.`
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (cause) {
    throw new DasUnavailableError(
      "The CookieScan DAS API returned a malformed response.",
      cause
    );
  }

  const envelope = body as { error?: { message?: string }; result?: unknown };
  if (envelope.error) {
    throw new DasUnavailableError(
      `The CookieScan DAS API returned an error: ${envelope.error.message ?? "unknown"}.`
    );
  }
  if (envelope.result == null || typeof envelope.result !== "object") {
    throw new DasUnavailableError("The CookieScan DAS API returned no result.");
  }

  return envelope.result;
}

/** Clamp to what the server will actually honour, so the two never disagree. */
export function clampLimit(limit: number): number {
  if (!Number.isFinite(limit)) return DAS_DEFAULT_LIMIT;
  return Math.min(DAS_MAX_LIMIT, Math.max(1, Math.trunc(limit)));
}

export async function getTokenAccounts(
  params: { limit?: number; mint: Address; page?: number },
  options: DasOptions = {}
): Promise<DasTokenAccountsPage> {
  const limit = clampLimit(params.limit ?? DAS_DEFAULT_LIMIT);
  const page = Math.max(1, Math.trunc(params.page ?? 1));

  const result = (await rpc(
    "getTokenAccounts",
    { limit, mint: params.mint, page },
    options
  )) as {
    limit?: unknown;
    page?: unknown;
    token_accounts?: unknown;
    total?: unknown;
  };

  const rawAccounts = Array.isArray(result.token_accounts)
    ? (result.token_accounts as RawAccount[])
    : [];

  return {
    accounts: rawAccounts.map(parseAccount),
    limit: typeof result.limit === "number" ? result.limit : limit,
    page: typeof result.page === "number" ? result.page : page,
    total: typeof result.total === "number" ? result.total : rawAccounts.length,
  };
}

/**
 * Every holder of a mint, paging until `total` is covered.
 *
 * `maxAccounts` is a real limit, not a formality: at 1,000 per page a mint with
 * 50,000 holders is 50 sequential requests against a community RPC to render a
 * table that shows twenty rows. Callers that only need a top-N should ask for
 * one page instead — the API already sorts by amount descending.
 *
 * Pages are requested one at a time on purpose. Concurrency here would be four
 * simultaneous reads for a screen nobody is blocked on.
 */
export async function getAllTokenAccounts(
  mint: Address,
  options: DasOptions & { maxAccounts?: number } = {}
): Promise<{ accounts: DasTokenAccount[]; total: number; truncated: boolean }> {
  const { maxAccounts = 5_000, ...dasOptions } = options;
  const accounts: DasTokenAccount[] = [];
  let total = 0;

  for (let page = 1; ; page++) {
    const result = await getTokenAccounts(
      { limit: DAS_MAX_LIMIT, mint, page },
      dasOptions
    );
    total = result.total;
    accounts.push(...result.accounts);

    // Three independent stop conditions, because trusting only `total` would
    // loop forever against a server that reports more than it will hand over.
    if (result.accounts.length === 0) break;
    if (accounts.length >= total) break;
    if (accounts.length >= maxAccounts) break;
  }

  return {
    accounts: accounts.slice(0, maxAccounts),
    total,
    truncated: accounts.length > maxAccounts || total > maxAccounts,
  };
}
