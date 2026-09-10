/**
 * Airdrop history in localStorage (RF-03.8).
 *
 * Written incrementally, one batch at a time, because the point is surviving a
 * reload MID-RUN: if the tab dies after batch 3 of 9, the user has to be able
 * to see which three landed rather than guess or re-send. A run that is only
 * persisted at the end is worthless for exactly the case it exists for.
 *
 * Reads are forgiving for the same reason as `myTokens`: the transfers are on
 * chain regardless of what this cache says, so a corrupt entry must never take
 * down the screen.
 */

export const AIRDROP_HISTORY_KEY = "cookie-bakery:airdrops";
export const AIRDROP_HISTORY_VERSION = 1;

export type BatchStatus =
  "confirmed" | "failed" | "pending" | "sent" | "signing";

export type AirdropRecipient = {
  address: string;
  /** Base units, as a string — JSON has no bigint. */
  amount: string;
};

export type AirdropBatch = {
  /** Human-readable failure, when status is "failed". */
  error?: string;
  index: number;
  recipients: AirdropRecipient[];
  /** Present once the batch confirms. */
  signature?: string;
  status: BatchStatus;
};

export type AirdropRun = {
  batches: AirdropBatch[];
  decimals: number;
  /** Stable id supplied by the caller, so runs are addressable across reloads. */
  id: string;
  mint: string;
  /** ISO 8601. */
  startedAt: string;
  symbol: string;
};

type StoredShape = {
  runs: AirdropRun[];
  v: number;
};

export type StorageLike = Pick<Storage, "getItem" | "setItem">;

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

const BATCH_STATUSES: readonly string[] = [
  "confirmed",
  "failed",
  "pending",
  "sent",
  "signing",
];

function isBatch(value: unknown): value is AirdropBatch {
  if (typeof value !== "object" || value === null) return false;
  const batch = value as Record<string, unknown>;
  return (
    typeof batch.index === "number" &&
    Array.isArray(batch.recipients) &&
    typeof batch.status === "string" &&
    BATCH_STATUSES.includes(batch.status)
  );
}

function isRun(value: unknown): value is AirdropRun {
  if (typeof value !== "object" || value === null) return false;
  const run = value as Record<string, unknown>;
  return (
    typeof run.id === "string" &&
    run.id.length > 0 &&
    typeof run.mint === "string" &&
    typeof run.decimals === "number" &&
    Array.isArray(run.batches) &&
    run.batches.every(isBatch)
  );
}

export function loadRuns(
  storage: StorageLike | null = defaultStorage()
): AirdropRun[] {
  if (!storage) return [];

  let raw: string | null;
  try {
    raw = storage.getItem(AIRDROP_HISTORY_KEY);
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
  const { runs, v } = parsed as Partial<StoredShape>;
  if (v !== AIRDROP_HISTORY_VERSION || !Array.isArray(runs)) return [];

  return runs.filter(isRun);
}

export function saveRuns(
  runs: readonly AirdropRun[],
  storage: StorageLike | null = defaultStorage()
): void {
  if (!storage) return;
  const payload: StoredShape = {
    runs: [...runs],
    v: AIRDROP_HISTORY_VERSION,
  };
  try {
    storage.setItem(AIRDROP_HISTORY_KEY, JSON.stringify(payload));
  } catch {
    // Quota or disabled storage — the transfers still happened on chain.
  }
}

/** Insert or replace a run by id, newest first. */
export function upsertRun(
  run: AirdropRun,
  storage: StorageLike | null = defaultStorage()
): AirdropRun[] {
  const next = [run, ...loadRuns(storage).filter((r) => r.id !== run.id)];
  saveRuns(next, storage);
  return next;
}

export function findRun(
  id: string,
  storage: StorageLike | null = defaultStorage()
): AirdropRun | undefined {
  return loadRuns(storage).find((run) => run.id === id);
}

/**
 * Persist one batch's outcome immediately.
 *
 * Merges into the stored run rather than the caller's copy, so a stale
 * in-memory run cannot roll back a batch that already landed.
 */
export function recordBatch(
  runId: string,
  batch: AirdropBatch,
  storage: StorageLike | null = defaultStorage()
): AirdropRun | undefined {
  const runs = loadRuns(storage);
  const run = runs.find((r) => r.id === runId);
  if (!run) return undefined;

  const batches = run.batches.some((b) => b.index === batch.index)
    ? run.batches.map((b) => (b.index === batch.index ? batch : b))
    : [...run.batches, batch].sort((a, b) => a.index - b.index);

  const updated: AirdropRun = { ...run, batches };
  saveRuns(
    runs.map((r) => (r.id === runId ? updated : r)),
    storage
  );
  return updated;
}

export type RunProgress = {
  confirmed: number;
  failed: number;
  /** True when nothing is left pending, whatever the outcome. */
  finished: boolean;
  pending: number;
  total: number;
};

export function progressOf(run: AirdropRun): RunProgress {
  const total = run.batches.length;
  const confirmed = run.batches.filter((b) => b.status === "confirmed").length;
  const failed = run.batches.filter((b) => b.status === "failed").length;
  return {
    confirmed,
    failed,
    finished: confirmed + failed === total && total > 0,
    pending: total - confirmed - failed,
    total,
  };
}

/** Batches worth retrying — failed only, never the ones already confirmed. */
export function retryableBatches(run: AirdropRun): AirdropBatch[] {
  return run.batches.filter((batch) => batch.status === "failed");
}
