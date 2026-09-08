import { chainConfig } from "../chain/config";
import { SOLANA_ERROR_CODES, type ErrorKind, type MappedError } from "./types";

type ErrorLike = {
  cause?: unknown;
  context?: Record<string, unknown>;
  message?: string;
  name?: string;
};

/**
 * Walks the `cause` chain to its root.
 *
 * This matters more than it looks: `solanaRpc` simulates before signing, and
 * wraps a failed simulation in a generic "failed to send" SolanaError. The
 * actionable cause sits two levels down. Reading only the top message would
 * report every pre-flight failure as the same unhelpful string.
 */
export function unwrapCause(error: unknown, maxDepth = 6): ErrorLike {
  let current = error as ErrorLike;
  let depth = 0;
  while (current?.cause != null && depth < maxDepth) {
    current = current.cause as ErrorLike;
    depth += 1;
  }
  return current ?? ({} as ErrorLike);
}

/** Collects every error code in the cause chain, root included. */
export function collectCodes(error: unknown, maxDepth = 6): number[] {
  const codes: number[] = [];
  let current = error as ErrorLike;
  let depth = 0;
  while (current != null && depth <= maxDepth) {
    const code = current.context?.__code;
    if (typeof code === "number") codes.push(code);
    current = current.cause as ErrorLike;
    depth += 1;
  }
  return codes;
}

function extractLogs(error: unknown, maxDepth = 6): string[] | undefined {
  let current = error as ErrorLike;
  let depth = 0;
  while (current != null && depth <= maxDepth) {
    const logs = current.context?.logs;
    if (Array.isArray(logs) && logs.length > 0) {
      return logs.filter((l): l is string => typeof l === "string");
    }
    current = current.cause as ErrorLike;
    depth += 1;
  }
  return undefined;
}

/**
 * User rejection never carries a stable Solana code — it originates in the
 * wallet, not the runtime — so this is the one case where we must sniff text.
 * Kept narrow and matched case-insensitively.
 */
const REJECTION_PATTERNS = [
  /user rejected/i,
  /user denied/i,
  /request rejected/i,
  /rejected the request/i,
  /declined/i,
];

function looksRejected(error: unknown): boolean {
  let current = error as ErrorLike;
  let depth = 0;
  while (current != null && depth <= 6) {
    const message = current.message ?? "";
    if (REJECTION_PATTERNS.some((p) => p.test(message))) return true;
    if (current.name === "WalletSignTransactionError") return true;
    current = current.cause as ErrorLike;
    depth += 1;
  }
  return false;
}

const RPC_PATTERNS = [
  /failed to fetch/i,
  /network ?error/i,
  /econnrefused/i,
  /socket hang up/i,
  /gateway/i,
  /timed? out/i,
];

function looksRpcDown(error: unknown): boolean {
  let current = error as ErrorLike;
  let depth = 0;
  while (current != null && depth <= 6) {
    const message = current.message ?? "";
    if (RPC_PATTERNS.some((p) => p.test(message))) return true;
    if (current.name === "TypeError" && /fetch/i.test(message)) return true;
    current = current.cause as ErrorLike;
    depth += 1;
  }
  return false;
}

function build(
  kind: ErrorKind,
  title: string,
  detail: string,
  extra: Partial<MappedError> = {}
): MappedError {
  return { detail, kind, retryable: false, title, ...extra };
}

/**
 * Maps any thrown value to something worth showing a user.
 *
 * Never throws: an unmappable error still has to render, and an error inside
 * the error handler is the worst possible time to fail.
 */
export function mapError(error: unknown): MappedError {
  try {
    // Ordered by confidence: rejection first, since a user who cancelled
    // should never see a scary chain error.
    if (looksRejected(error)) {
      return build(
        "user-rejected",
        "Signature declined",
        "You dismissed the request in your wallet. Nothing was sent."
      );
    }

    const codes = collectCodes(error);
    const root = unwrapCause(error);
    const logs = extractLogs(error);

    if (codes.includes(SOLANA_ERROR_CODES.BLOCKHASH_EXPIRED)) {
      return build(
        "blockhash-expired",
        "Transaction expired",
        "The network moved past the block this transaction was valid for — approving in the wallet took longer than the window. Retrying with a fresh blockhash.",
        { retryable: true }
      );
    }

    if (codes.includes(SOLANA_ERROR_CODES.INSUFFICIENT_FUNDS_NO_PRIOR_CREDIT)) {
      return build(
        "insufficient-funds",
        "Not enough COOK",
        "This account has no COOK to cover rent and fees on Cookie Chain.",
        {
          action: { href: chainConfig.bridgeUrl, label: "Bridge COOK" },
        }
      );
    }

    if (looksRpcDown(error)) {
      return build(
        "rpc-unavailable",
        "Cookie Chain RPC unreachable",
        "The network could not be reached. Your transaction was not sent — check the connection indicator and try again.",
        { retryable: true }
      );
    }

    if (logs && logs.length > 0) {
      return build(
        "program-error",
        "The program rejected this transaction",
        root.message ?? "A program returned an error during execution.",
        { logs }
      );
    }

    if (/invalid|not a valid|malformed/i.test(root.message ?? "")) {
      return build("invalid-mint", "Invalid address", root.message ?? "");
    }

    return build(
      "unknown",
      "Something went wrong",
      root.message ?? String(error ?? "Unknown error")
    );
  } catch {
    return build(
      "unknown",
      "Something went wrong",
      "An unexpected error occurred."
    );
  }
}
