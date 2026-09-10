import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePayer } from "@solana/react";
import type { Lamports } from "@solana/kit";
import { AirdropPlanSummary } from "../components/AirdropPlanSummary";
import { BatchTable } from "../components/BatchTable";
import { EmptyState } from "../components/EmptyState";
import {
  RecipientTable,
  type RecipientRow,
} from "../components/RecipientTable";
import { TokenSelector, type SelectedToken } from "../components/TokenSelector";
import { Button } from "../components/ui/Button";
import { useCookBalance } from "../hooks/useCookBalance";
import { readSignature } from "../hooks/useTrackedSend";
import { useToast } from "../hooks/useToast";
import {
  batchCount,
  DEFAULT_BATCH,
  estimateAirdropCost,
  suggestedBatchSize,
  type AirdropCost,
  type Recipient,
} from "../lib/airdrop/buildPlan";
import {
  createAirdropRunner,
  runProgress,
  splitIntoBatches,
  toStoredBatch,
  type AirdropRunner,
  type RunnerState,
  type TransferBatch,
} from "../lib/airdrop/executor";
import { exportFilename, exportRunToCsv } from "../lib/airdrop/exportCsv";
import { mergeDuplicates } from "../lib/airdrop/mergeDuplicates";
import { CsvError, parseCsv, type CsvRow } from "../lib/airdrop/parseCsv";
import { probeAtas, type AtaProbe } from "../lib/airdrop/probeAtas";
import { readSourceAccount } from "../lib/airdrop/sourceAccount";
import { validateRows } from "../lib/airdrop/validateRows";
import { mapError } from "../lib/errors/mapError";
import type { MappedError } from "../lib/errors/types";
import { fromBaseUnits } from "../lib/token/bakeForm";
import {
  loadRuns,
  progressOf,
  recordBatch,
  upsertRun,
  type AirdropRun,
} from "../store/airdropHistory";
import type { AppClient } from "../providers";

/**
 * The Airdrop screen (RF-03.7).
 *
 * Three steps, in this order for a reason:
 *
 *   compose (token + list, validated live)
 *     → prepare (probe accounts, price the run)
 *       → run (one batch at a time, pausable, retryable per batch)
 *
 * Preparing is a separate, explicit step because the cost cannot be known
 * without asking the chain which recipients already hold the token — rent for
 * an account that exists is zero, and guessing either way puts a wrong number
 * in front of someone about to spend money. AC-03.5 wants the real one.
 *
 * Nothing is signed until "Send airdrop", and from then on progress is
 * written to localStorage batch by batch so a reload can show what landed.
 */

/** Rows rendered at most, so a 1,000-row list cannot lock up the tab. */
const MAX_VISIBLE_ROWS = 120;

type Prepared = {
  cost: AirdropCost;
  perBatch: number;
  probes: AtaProbe[];
  recipients: Recipient[];
  /** The sender's token account. */
  source: string;
  transactionCount: number;
};

function download(run: AirdropRun): void {
  const blob = new Blob([exportRunToCsv(run)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = exportFilename(run);
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

export function Airdrop({
  client,
  initialToken = null,
  onBake,
}: {
  client: AppClient;
  /** Preselected when the Oven hands a mint over via "Airdrop more". */
  initialToken?: SelectedToken | null;
  /** Sends someone with no tokens to the screen that makes one. */
  onBake: () => void;
}) {
  const payer = usePayer(client);
  const { lamports } = useCookBalance(payer?.address);
  const toast = useToast();

  const [token, setToken] = useState<SelectedToken | null>(initialToken);
  const [csv, setCsv] = useState("");
  const [merged, setMerged] = useState(false);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState<MappedError | string | null>(
    null
  );
  const [runId, setRunId] = useState<string | null>(null);
  const [runState, setRunState] = useState<RunnerState | null>(null);
  const [history, setHistory] = useState<AirdropRun[]>([]);
  const runnerRef = useRef<AirdropRunner | null>(null);

  useEffect(() => {
    setHistory(loadRuns());
  }, []);

  /** Any change to the inputs invalidates a price that was already fetched. */
  const invalidate = useCallback(() => {
    setPrepared(null);
    setPrepareError(null);
  }, []);

  const parsed = useMemo(() => {
    if (csv.trim() === "") return { error: null, rows: [] as CsvRow[] };
    try {
      return { error: null, rows: parseCsv(csv).rows };
    } catch (raw) {
      return {
        error:
          raw instanceof CsvError
            ? raw.message
            : "Could not read that list. Expected one `address,amount` per line.",
        rows: [] as CsvRow[],
      };
    }
  }, [csv]);

  // Amounts are scaled by the mint's decimals, so there is nothing to validate
  // until a token is chosen — validating against 0 decimals would reject every
  // fractional amount for the wrong reason.
  const validation = useMemo(
    () => (token ? validateRows(parsed.rows, token.decimals) : null),
    [parsed.rows, token]
  );

  const mergedRows = useMemo(
    () => (validation && merged ? mergeDuplicates(validation.valid) : null),
    [merged, validation]
  );

  const blockingErrors = useMemo(
    () => validation?.errors.filter((e) => e.issue !== "duplicate") ?? [],
    [validation]
  );
  const duplicateCount = validation?.duplicates.size ?? 0;

  const recipients = useMemo<Recipient[]>(() => {
    if (!validation) return [];
    const rows = mergedRows ?? validation.valid;
    return rows.map((row) => ({ address: row.address, amount: row.amount }));
  }, [mergedRows, validation]);

  const total = useMemo(
    () => recipients.reduce((sum, r) => sum + r.amount, 0n),
    [recipients]
  );

  const errorCount = merged
    ? blockingErrors.length
    : (validation?.errors.length ?? 0);
  const canPrepare =
    token != null &&
    payer != null &&
    recipients.length > 0 &&
    blockingErrors.length === 0 &&
    (duplicateCount === 0 || merged);

  /**
   * Why "Prepare airdrop" is unavailable (RF-06.4).
   *
   * Derived from the same conditions as `canPrepare` and in the same order, so
   * the explanation can never disagree with the disabled state.
   */
  const prepareBlockedReason = !payer
    ? "Connect a wallet first."
    : !token
      ? "Pick a token to airdrop."
      : recipients.length === 0
        ? "Add at least one recipient."
        : blockingErrors.length > 0
          ? `Fix the ${blockingErrors.length} row${blockingErrors.length === 1 ? "" : "s"} flagged above.`
          : duplicateCount > 0 && !merged
            ? "Merge the duplicate addresses, or remove them."
            : null;

  /** Rows for the table: every problem row, then as many clean ones as fit. */
  const displayRows = useMemo<RecipientRow[]>(() => {
    if (!token || !validation) return [];

    const decimals = token.decimals;
    const existsByOwner = new Map(
      prepared?.probes.map((probe) => [probe.owner as string, probe.exists]) ??
        []
    );
    const ataOf = (owner: string): RecipientRow["ata"] => {
      const exists = existsByOwner.get(owner);
      return exists === undefined ? null : exists ? "exists" : "new";
    };

    if (mergedRows) {
      return [
        ...mergedRows.map((row) => ({
          address: row.address as string,
          amount: fromBaseUnits(row.amount, decimals),
          ata: ataOf(row.address),
          error: null,
          line: row.line,
          mergedFrom: row.sourceLines.length > 1 ? row.sourceLines : null,
        })),
        ...blockingErrors.map((error) => ({
          address: error.rawAddress,
          amount: "—",
          ata: null,
          error: error.message,
          line: error.line,
          mergedFrom: null,
        })),
      ].sort((a, b) => a.line - b.line);
    }

    const errorByLine = new Map(validation.errors.map((e) => [e.line, e]));
    const amountByLine = new Map(
      validation.valid.map((row) => [row.line, row.amount])
    );

    return parsed.rows.map((row) => {
      const error = errorByLine.get(row.line);
      const amount = amountByLine.get(row.line);
      return {
        address: row.rawAddress,
        amount:
          !error && amount !== undefined
            ? fromBaseUnits(amount, decimals)
            : row.rawAmount || "—",
        ata: error ? null : ataOf(row.rawAddress),
        error: error?.message ?? null,
        line: row.line,
        mergedFrom: null,
      };
    });
  }, [blockingErrors, mergedRows, parsed.rows, prepared, token, validation]);

  const visibleRows = useMemo(() => {
    if (displayRows.length <= MAX_VISIBLE_ROWS) return displayRows;
    const bad = displayRows.filter((row) => row.error);
    const good = displayRows.filter((row) => !row.error);
    // Problem rows always survive the cut: they are the ones to act on.
    return [
      ...bad,
      ...good.slice(0, Math.max(0, MAX_VISIBLE_ROWS - bad.length)),
    ]
      .slice(0, MAX_VISIBLE_ROWS)
      .sort((a, b) => a.line - b.line);
  }, [displayRows]);

  const perBatch = prepared?.perBatch ?? DEFAULT_BATCH;
  const transactionCount =
    prepared?.transactionCount ?? batchCount(recipients.length, perBatch);

  const prepare = useCallback(async () => {
    if (!token || !payer || recipients.length === 0) return;

    setIsPreparing(true);
    setPrepareError(null);
    try {
      const source = await readSourceAccount(
        client.rpc,
        payer.address,
        token.mint,
        token.programAddress
      );

      if (!source.exists) {
        setPrepareError(
          "The connected wallet holds no account for this token, so there is nothing to send from."
        );
        return;
      }
      if (source.amount < total) {
        setPrepareError(
          `This run sends ${fromBaseUnits(total, token.decimals)} but the wallet holds ${fromBaseUnits(source.amount, token.decimals)}.`
        );
        return;
      }

      const probes = await probeAtas(
        client.rpc,
        recipients.map((recipient) => recipient.address),
        token.mint,
        token.programAddress
      );
      const size = suggestedBatchSize(probes);
      const count = batchCount(recipients.length, size);
      const cost = await estimateAirdropCost(client, probes, count);

      setPrepared({
        cost,
        perBatch: size,
        probes,
        recipients,
        source: source.ata,
        transactionCount: count,
      });
    } catch (raw) {
      setPrepareError(mapError(raw));
    } finally {
      setIsPreparing(false);
    }
  }, [client, payer, recipients, token, total]);

  /**
   * One batch, sent through OUR RPC.
   *
   * The instructions are handed over, never a pre-built message: that lets the
   * planner fetch the blockhash at the moment this batch is sent rather than
   * when the run started, which on Cookie Chain is the difference between
   * landing and expiring while the user reads the wallet prompt.
   */
  const send = useCallback(
    async (batch: TransferBatch) => {
      const result = await client.sendTransaction(batch.instructions);
      const signature = readSignature(result);
      if (!signature) {
        throw new Error("The network confirmed without returning a signature.");
      }
      return signature;
    },
    [client]
  );

  const start = useCallback(async () => {
    if (!token || !payer || !prepared) return;

    const id = crypto.randomUUID();
    const batches = splitIntoBatches(
      {
        authority: payer,
        decimals: token.decimals,
        mint: token.mint,
        probes: prepared.probes,
        recipients: prepared.recipients,
        source: prepared.source as never,
        tokenProgram: token.programAddress,
      },
      prepared.perBatch
    );

    upsertRun({
      batches: [],
      decimals: token.decimals,
      id,
      mint: token.mint,
      startedAt: new Date().toISOString(),
      symbol: token.symbol,
    });

    const runner = createAirdropRunner({
      batches,
      onBatch: (batch) => {
        recordBatch(id, toStoredBatch(batch));
      },
      onChange: setRunState,
      send,
    });

    runnerRef.current = runner;
    setRunId(id);
    setRunState(runner.getState());

    await runner.start();

    const summary = runProgress(runner.getState().batches);
    toast.show({
      detail: `${summary.confirmed} of ${summary.total} batches confirmed.`,
      title: summary.finished ? "Airdrop complete" : "Airdrop stopped",
      variant: summary.finished ? "success" : "error",
    });
    setHistory(loadRuns());
  }, [payer, prepared, send, toast, token]);

  const resume = useCallback(async () => {
    const runner = runnerRef.current;
    if (!runner) return;
    await runner.start();
    setHistory(loadRuns());
  }, []);

  const retry = useCallback(async (index: number) => {
    const runner = runnerRef.current;
    if (!runner) return;
    await runner.retry(index);
    setHistory(loadRuns());
  }, []);

  const exportCurrent = useCallback(() => {
    if (!runId) return;
    const run = loadRuns().find((entry) => entry.id === runId);
    if (run) download(run);
  }, [runId]);

  const summary = runState ? runProgress(runState.batches) : null;

  if (runState && summary) {
    return (
      <section aria-label="Airdrop progress" className="flex flex-col gap-5">
        <div className="enter enter-1 flex flex-col gap-[7px]">
          <h2 className="font-display text-[30px] font-bold leading-[1.1] tracking-[-0.03em]">
            {summary.finished ? "Airdrop complete" : "Sending the airdrop"}
          </h2>
          <p className="text-[14.5px] leading-relaxed text-ink-2">
            {summary.confirmed} of {summary.total} batches confirmed
            {summary.failed > 0 ? ` · ${summary.failed} failed` : null}.
          </p>
        </div>

        <div
          aria-label="Progress"
          aria-valuemax={summary.total}
          aria-valuemin={0}
          aria-valuenow={summary.confirmed}
          className="h-2 w-full overflow-hidden rounded-full bg-raised"
          role="progressbar"
        >
          {/*
           * scaleX, not width: the track already clips this to a rounded
           * shape, so the fill stays square and the browser never leaves the
           * compositor. `origin-left` is what keeps it growing from the start
           * of the bar rather than from its middle.
           */}
          <div
            className="h-full w-full origin-left bg-accent transition-transform duration-[320ms] [transition-timing-function:var(--ease-strong-out)]"
            style={{
              transform: `scaleX(${summary.total === 0 ? 0 : summary.confirmed / summary.total})`,
            }}
          />
        </div>

        <BatchTable
          batches={runState.batches}
          decimals={token?.decimals ?? 0}
          isBusy={runState.isRunning}
          onRetry={(index) => void retry(index)}
          symbol={token?.symbol ?? ""}
        />

        <div className="flex flex-wrap gap-2.5">
          {runState.isRunning ? (
            <Button
              data-testid="airdrop-pause"
              onClick={() => runnerRef.current?.pause()}
              variant="secondary"
            >
              Pause after this batch
            </Button>
          ) : null}

          {!runState.isRunning && !summary.finished ? (
            <Button data-testid="airdrop-resume" onClick={() => void resume()}>
              Resume
            </Button>
          ) : null}

          <Button
            data-testid="airdrop-export"
            onClick={exportCurrent}
            variant="secondary"
          >
            Export CSV
          </Button>
        </div>

        <p className="text-[12.5px] leading-relaxed text-ink-3">
          Pausing stops before the next batch — a transaction already sent
          cannot be called back. Confirmed batches are never re-sent.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Airdrop" className="flex flex-col gap-[22px]">
      <div className="enter enter-1 flex flex-col gap-[7px]">
        <h2 className="font-display text-[34px] font-bold leading-[1.1] tracking-[-0.03em]">
          Airdrop
        </h2>
        <p className="text-[14.5px] leading-relaxed text-ink-2">
          Paste <span className="font-mono text-[13.5px]">address,amount</span>{" "}
          or drop a CSV · up to 1,000 rows.
        </p>
      </div>

      {/*
       * The empty state names the next action rather than the absence
       * (AC-06.3): the recipient list is meaningless until a token fixes the
       * decimals, so "pick a token" is the only useful instruction here.
       */}
      {!token ? (
        <EmptyState
          action={{ label: "Bake a token first", onClick: onBake }}
          detail="Pick one of your tokens or paste a mint address below. Amounts are scaled by the mint's decimals, so the list cannot be validated until then."
          testId="airdrop-empty-state"
          title="Choose what to airdrop"
        />
      ) : null}

      <div className="enter enter-2 flex flex-col gap-4">
        <TokenSelector
          onChange={(next) => {
            setToken(next);
            setMerged(false);
            invalidate();
          }}
          rpc={client.rpc}
          value={token}
        />

        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const file = event.dataTransfer.files[0];
            if (!file) return;
            void file.text().then((text) => {
              setCsv(text);
              setMerged(false);
              invalidate();
            });
          }}
        >
          <label
            className="mb-[7px] block text-xs font-semibold uppercase tracking-[0.06em] text-ink-3"
            htmlFor="airdrop-csv"
          >
            Recipients
          </label>
          <textarea
            aria-label="Recipients"
            className="h-[168px] w-full resize-y rounded-md border border-border-strong bg-bg1 p-3.5 font-mono text-[13px] outline-none transition-[border-color,box-shadow] duration-[160ms] [transition-timing-function:var(--ease-strong-out)] focus:border-accent focus:shadow-[0_0_0_3px_rgba(232,163,61,0.15)]"
            id="airdrop-csv"
            onChange={(event) => {
              setCsv(event.target.value);
              setMerged(false);
              invalidate();
            }}
            placeholder={"address,amount\n7pKfR2mNv…,12500\n3xQvR9LmK…,8000"}
            value={csv}
          />
          <div className="mt-2.5 flex flex-wrap items-center gap-3">
            <input
              accept=".csv,text/csv,text/plain"
              aria-label="Upload a CSV"
              className="text-[12.5px] text-ink-2 file:mr-3 file:rounded-chip file:border file:border-border-strong file:bg-raised file:px-3 file:py-1.5 file:text-[12.5px] file:font-semibold file:text-ink"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                void file.text().then((text) => {
                  setCsv(text);
                  setMerged(false);
                  invalidate();
                });
              }}
              type="file"
            />
            {csv ? (
              <button
                className="text-[12.5px] font-medium text-ink-2 underline underline-offset-2"
                onClick={() => {
                  setCsv("");
                  setMerged(false);
                  invalidate();
                }}
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>

        {parsed.error ? (
          <p className="text-[12.5px] text-danger" role="alert">
            {parsed.error}
          </p>
        ) : null}

        {!token && parsed.rows.length > 0 ? (
          <p className="text-[12.5px] text-ink-3">
            Pick a token to validate these {parsed.rows.length} rows — amounts
            depend on its decimals.
          </p>
        ) : null}

        {duplicateCount > 0 && !merged ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-accent/25 bg-accent/[0.06] px-4 py-3">
            <p className="text-[12.5px] leading-relaxed text-ink-2">
              {duplicateCount}{" "}
              {duplicateCount === 1 ? "address appears" : "addresses appear"}{" "}
              more than once. Merging adds their amounts together.
            </p>
            <Button
              className="ml-auto"
              data-testid="airdrop-merge"
              onClick={() => {
                setMerged(true);
                invalidate();
              }}
              variant="secondary"
            >
              Merge duplicates
            </Button>
          </div>
        ) : null}
      </div>

      {visibleRows.length > 0 ? (
        <div className="enter enter-3 flex flex-col gap-2">
          <RecipientTable rows={visibleRows} symbol={token?.symbol ?? ""} />
          {displayRows.length > visibleRows.length ? (
            <p className="text-[12px] text-ink-3">
              Showing {visibleRows.length} of {displayRows.length} rows. Every
              row with a problem is shown; the rest are validated but not
              listed.
            </p>
          ) : null}
        </div>
      ) : null}

      {token ? (
        <div className="enter enter-3 flex flex-col gap-4">
          <AirdropPlanSummary
            balance={lamports as Lamports | null}
            confirmed={0}
            cost={prepared?.cost ?? null}
            errorCount={errorCount}
            footnote={
              errorCount > 0
                ? "Fix the rows above to continue. Batches sign one at a time with a fresh blockhash."
                : "Batches sign one at a time with a fresh blockhash — one wallet prompt per transaction."
            }
            newAtaCount={prepared ? Number(prepared.cost.newAtaCount) : null}
            perBatch={perBatch}
            recipientCount={recipients.length}
            symbol={token.symbol}
            total={fromBaseUnits(total, token.decimals)}
            transactionCount={transactionCount}
          />

          {prepareError ? (
            <div
              className="rounded-lg border border-danger/30 bg-danger/[0.07] px-4 py-3 text-[12.5px] leading-relaxed text-danger"
              role="alert"
            >
              {typeof prepareError === "string" ? (
                prepareError
              ) : (
                <>
                  <span className="font-semibold">{prepareError.title}</span> —{" "}
                  {prepareError.detail}
                </>
              )}
            </div>
          ) : null}

          {prepared ? (
            <Button
              className="w-full"
              data-testid="airdrop-send"
              onClick={() => void start()}
              size="lg"
            >
              Send airdrop
            </Button>
          ) : (
            <Button
              className={isPreparing ? "w-full indeterminate" : "w-full"}
              data-testid="airdrop-prepare"
              disabled={!canPrepare || isPreparing}
              disabledReason={prepareBlockedReason ?? undefined}
              onClick={() => void prepare()}
              size="lg"
            >
              {payer
                ? isPreparing
                  ? "Checking accounts…"
                  : "Prepare airdrop"
                : "Connect a wallet to airdrop"}
            </Button>
          )}
        </div>
      ) : null}

      {history.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">
            Previous runs
          </span>
          <ul className="flex flex-col gap-1.5" data-testid="airdrop-history">
            {history.map((run) => {
              const done = progressOf(run);
              return (
                <li
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border-low bg-card px-4 py-3"
                  key={run.id}
                >
                  <span className="text-[13px] font-semibold">
                    {run.symbol || "Token"}
                  </span>
                  <span className="font-mono text-[11.5px] text-ink-3">
                    {run.startedAt.slice(0, 16).replace("T", " ")}
                  </span>
                  <span className="text-[12.5px] text-ink-2">
                    {done.confirmed}/{done.total} batches
                    {done.failed > 0 ? ` · ${done.failed} failed` : null}
                  </span>
                  <Button
                    className="ml-auto"
                    onClick={() => download(run)}
                    variant="secondary"
                  >
                    Export CSV
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
