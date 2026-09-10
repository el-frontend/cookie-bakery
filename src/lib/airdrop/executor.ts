import type { Instruction } from "@solana/kit";
import { mapError } from "../errors/mapError";
import type { MappedError } from "../errors/types";
import type {
  AirdropBatch as StoredBatch,
  BatchStatus,
} from "../../store/airdropHistory";
import {
  buildAirdropInstructions,
  MAX_BATCH,
  MIN_BATCH,
  suggestedBatchSize,
  type BuildAirdropInput,
  type Recipient,
} from "./buildPlan";

/**
 * Run an airdrop batch by batch (RF-03.7).
 *
 * ## Why the app batches instead of handing the planner everything
 *
 * `client.sendTransactions(plan)` is one opaque promise: no per-batch
 * callback, no way to stop between transactions, and its abort signal kills
 * the whole run. RF-03 needs the opposite — a progress row per batch, a Pause
 * that takes effect between them, and a Retry that touches ONE failed batch
 * and leaves the confirmed ones alone. So the PRD's documented fallback
 * applies: the app decides how many recipients go in each transaction.
 *
 * That is *not* a reimplementation of the planner. Each batch is still handed
 * to `client.sendTransaction(instructions)`, which plans it internally —
 * blockhash, compute budget, size check — and refuses loudly if the batch does
 * not fit in one transaction. What the app took over is the pacing, nothing
 * else. See `docs/decisions.md`.
 *
 * ## Why the blockhash is fetched per batch, not once
 *
 * Measured on Cookie Chain, a human-approved transaction missed its window by
 * a single block: reading the wallet prompt outlives the blockhash. Planning
 * all N batches up front would therefore hand the LAST batches a blockhash
 * that expired while the user approved the first ones. Passing instructions
 * (never pre-built messages) means every batch gets its lifetime at the moment
 * it is sent, and each batch keeps one automatic retry on top of that.
 */

/** One transaction's worth of transfers. */
export type TransferBatch = {
  /** Position in the run. Also the key used for retries and persistence. */
  index: number;
  instructions: Instruction[];
  /** Recipients in this batch that need their token account created. */
  newAtas: number;
  recipients: readonly Recipient[];
};

/**
 * Cut the recipient list into batches and build each one's instructions.
 *
 * Recipients and probes are sliced together so a probe never drifts away from
 * the recipient it belongs to — `buildAirdropInstructions` throws if they do,
 * which is the guard that stops tokens landing in someone else's account.
 */
export function splitIntoBatches(
  input: BuildAirdropInput,
  perBatch: number = suggestedBatchSize(input.probes)
): TransferBatch[] {
  const size = Math.min(
    MAX_BATCH,
    Math.max(MIN_BATCH, Math.trunc(perBatch) || MIN_BATCH)
  );
  const batches: TransferBatch[] = [];

  for (let start = 0; start < input.recipients.length; start += size) {
    const recipients = input.recipients.slice(start, start + size);
    const probes = input.probes.slice(start, start + size);

    batches.push({
      index: batches.length,
      instructions: buildAirdropInstructions({ ...input, probes, recipients }),
      newAtas: probes.filter((probe) => !probe.exists).length,
      recipients,
    });
  }

  return batches;
}

export type BatchRun = {
  error: MappedError | null;
  index: number;
  recipients: readonly Recipient[];
  /** True once this batch has spent its one automatic retry. */
  retried: boolean;
  signature: string | null;
  status: BatchStatus;
};

export type RunnerState = {
  batches: readonly BatchRun[];
  /** Set by `pause()`, and by a failure — either way `start()` resumes. */
  isPaused: boolean;
  /** True while a batch is in flight. */
  isRunning: boolean;
};

/** Sends one batch and resolves with its signature. */
export type SendBatch = (batch: TransferBatch) => Promise<string>;

export type RunnerOptions = {
  batches: readonly TransferBatch[];
  /** Every single-batch transition, for incremental persistence. */
  onBatch?: (batch: BatchRun) => void;
  /** Every state change, for rendering. */
  onChange?: (state: RunnerState) => void;
  send: SendBatch;
};

export type AirdropRunner = {
  getState: () => RunnerState;
  /** Stops before the next batch. The one in flight is already gone. */
  pause: () => void;
  /** Re-sends ONE failed batch. Confirmed batches are never touched. */
  retry: (index: number) => Promise<void>;
  /** Sends every batch that is not already confirmed, in order. */
  start: () => Promise<void>;
};

export function createAirdropRunner({
  batches,
  onBatch,
  onChange,
  send,
}: RunnerOptions): AirdropRunner {
  let runs: BatchRun[] = batches.map((batch, index) => ({
    error: null,
    index,
    recipients: batch.recipients,
    retried: false,
    signature: null,
    status: "pending",
  }));
  let isPaused = false;
  let isRunning = false;

  const getState = (): RunnerState => ({ batches: runs, isPaused, isRunning });
  const notify = () => onChange?.(getState());

  /**
   * Patch one batch and announce it.
   *
   * Runs are addressed BY POSITION, and a patch rebuilds only that entry, so a
   * failure can never write over a sibling that already confirmed.
   */
  function set(index: number, patch: Partial<BatchRun>): void {
    const next = { ...runs[index], ...patch };
    runs = runs.map((run, position) => (position === index ? next : run));
    onBatch?.(next);
    notify();
  }

  /**
   * One batch, with at most one automatic retry.
   *
   * The retry is the normal path rather than a safety net: on Cookie Chain the
   * blockhash routinely expires while a person reads the wallet prompt.
   * `mapError` decides what is worth retrying — an expired blockhash and an
   * unreachable RPC. A declined signature is not retried, because re-prompting
   * someone who just said no is worse than failing.
   */
  async function attempt(index: number): Promise<void> {
    set(index, {
      error: null,
      retried: false,
      signature: null,
      status: "signing",
    });

    for (let tries = 0; tries < 2; tries++) {
      try {
        const signature = await send(batches[index]);
        set(index, { error: null, signature, status: "confirmed" });
        return;
      } catch (raw) {
        const error = mapError(raw);
        if (error.retryable && tries === 0) {
          set(index, { retried: true });
          continue;
        }
        set(index, { error, signature: null, status: "failed" });
        return;
      }
    }
  }

  async function start(): Promise<void> {
    if (isRunning) return;
    isPaused = false;
    isRunning = true;
    notify();

    try {
      for (let index = 0; index < batches.length; index++) {
        if (runs[index].status === "confirmed") continue;
        // Checked BETWEEN batches only: a transaction already handed to the
        // network cannot be called back, so pausing mid-batch would lie.
        if (isPaused) return;

        await attempt(index);

        /*
         * A failure halts the run instead of ploughing on. Every batch costs
         * the user a wallet prompt, and the usual causes — not enough COOK, a
         * declined signature, an RPC that is down — will fail identically for
         * the batches behind it. Better to stop with one clear failure than to
         * make someone dismiss N doomed prompts.
         */
        if (runs[index].status === "failed") {
          isPaused = true;
          return;
        }
      }
    } finally {
      isRunning = false;
      notify();
    }
  }

  function pause(): void {
    if (isPaused) return;
    isPaused = true;
    notify();
  }

  async function retry(index: number): Promise<void> {
    if (isRunning) return;
    if (runs[index]?.status !== "failed") return;

    isRunning = true;
    notify();
    try {
      await attempt(index);
    } finally {
      isRunning = false;
      notify();
    }
  }

  return { getState, pause, retry, start };
}

export type RunSummary = {
  confirmed: number;
  failed: number;
  /** Every batch confirmed. */
  finished: boolean;
  pending: number;
  total: number;
};

export function runProgress(batches: readonly BatchRun[]): RunSummary {
  const confirmed = batches.filter((b) => b.status === "confirmed").length;
  const failed = batches.filter((b) => b.status === "failed").length;

  return {
    confirmed,
    failed,
    finished: batches.length > 0 && confirmed === batches.length,
    pending: batches.length - confirmed - failed,
    total: batches.length,
  };
}

/**
 * Shape one batch for `localStorage`.
 *
 * The error is flattened to its title and detail: a `MappedError` carries
 * program logs and an action link that are worth nothing after a reload, and
 * storing the raw object would let a future change to the error taxonomy
 * invalidate history that is otherwise still readable.
 */
export function toStoredBatch(run: BatchRun): StoredBatch {
  return {
    ...(run.error
      ? { error: `${run.error.title} — ${run.error.detail}` }
      : null),
    index: run.index,
    recipients: run.recipients.map((recipient) => ({
      address: recipient.address,
      amount: recipient.amount.toString(),
    })),
    ...(run.signature ? { signature: run.signature } : null),
    status: run.status,
  };
}
