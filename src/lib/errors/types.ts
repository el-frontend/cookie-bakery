/** Error kinds the UI knows how to talk about. */
export type ErrorKind =
  | "blockhash-expired"
  | "insufficient-funds"
  | "invalid-mint"
  | "program-error"
  | "rpc-unavailable"
  | "unknown"
  | "user-rejected";

export type ErrorAction = {
  href: string;
  label: string;
};

export type MappedError = {
  /** Optional call to action, e.g. a link to the bridge. */
  action?: ErrorAction;
  /** Human-readable detail. Safe to render as plain text. */
  detail: string;
  /** Program logs, when the failure came from on-chain execution. */
  logs?: readonly string[];
  /** Whether an automatic single retry is worth attempting. */
  retryable: boolean;
  title: string;
  kind: ErrorKind;
};

/**
 * Solana error codes observed against Cookie Chain, plus the ones the docs
 * name. Discriminating on codes rather than message substrings: messages are
 * prose and change between versions.
 */
export const SOLANA_ERROR_CODES = {
  /** Blockhash no longer valid; `context` carries the block heights. */
  BLOCKHASH_EXPIRED: 1,
  /** Account has never been funded. Seen on Cookie Chain with a fresh wallet. */
  INSUFFICIENT_FUNDS_NO_PRIOR_CREDIT: 7050003,
  /** Wrapper the transaction executor puts around a failed pre-send simulation. */
  SIMULATION_FAILED_WRAPPER: 11,
} as const;
