import { useEffect, useMemo, useState } from "react";
import { hexToBytes } from "@noble/hashes/utils";
import { useAction, useClient } from "@solana/react";
import useSWR from "swr";
import { Button, ButtonLink } from "./ui/Button";
import { Field, Input } from "./ui/Field";
import { explorer } from "../lib/chain/explorer";
import { formatElapsed, useElapsed } from "../hooks/useElapsed";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { useToast } from "../hooks/useToast";
import { entriesRoot, hashEntry } from "../lib/draw/hashEntry";
import {
  attestCommit,
  canReveal,
  commitDraw,
  getDrawForEvent,
  getDrawSeed,
  revealDraw,
  TARGET_SLOT_LEAD,
} from "../lib/draw/runDraw";
import { pickWinners } from "../lib/draw/shuffle";
import type { DrawnEntry } from "../lib/draw/toRecipients";
import { formatTokenAmountWithSymbol } from "../lib/format/tokenAmount";
import { listEntries, type EventRow } from "../lib/supabase/events";
import { toBaseUnits } from "../lib/token/bakeForm";
import type { AppClient } from "../providers";

/**
 * The draw itself: commit, attest on chain, wait for a slot that does not
 * exist yet, reveal.
 *
 * Lives beside `EventCard` rather than inside it (`EventCard` is a finished,
 * reviewed component from an earlier task) — `Events.tsx` renders one of
 * these per event, and it renders nothing until the event is `closed` or
 * `paid`. Everything is keyed off the database, not local component state,
 * so a reload mid-wait — or an audience member arriving after the fact —
 * lands on the right one of the states below rather than back at zero.
 *
 * Setup → committed-but-unattested (only when the commit memo failed to
 * land — see `attestCommit` in `runDraw.ts`) → waiting → revealed. The
 * middle state is not cosmetic: `verifyDraw`'s whole timing proof is
 * `commit_slot < target_slot`, so nothing here ever offers Reveal without a
 * `commit_signature` already on the row.
 */

const SLOT_POLL_MS = 1_000;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function DrawPanel({ event }: { event: EventRow }) {
  const client = useClient<AppClient>();
  const toast = useToast();
  const prefersReducedMotion = usePrefersReducedMotion();

  const [amountInput, setAmountInput] = useState("");
  const [winnersInput, setWinnersInput] = useState("1");

  const isRelevant = event.status === "closed" || event.status === "paid";

  const {
    data: draw,
    error: drawError,
    isLoading: isDrawLoading,
    mutate: mutateDraw,
  } = useSWR(isRelevant ? ["draw", event.id] : null, () =>
    getDrawForEvent(event.id)
  );

  const hasEntries = event.entry_count > 0;
  const { data: entryRows, isLoading: entriesLoading } = useSWR(
    isRelevant && hasEntries ? ["draw-entries", event.id] : null,
    () => listEntries(event.id)
  );

  const drawnEntries: DrawnEntry[] = useMemo(
    () =>
      (entryRows ?? []).map((row) => ({
        entryId: row.id,
        hash: hashEntry(event.id, row.wallet_address),
        walletAddress: row.wallet_address,
      })),
    [entryRows, event.id]
  );

  const isWaiting = draw != null && draw.status === "committed";

  const { data: liveSlot } = useSWR(
    isWaiting ? ["draw-live-slot", event.id] : null,
    () => client.rpc.getSlot().send() as Promise<bigint>,
    { refreshInterval: SLOT_POLL_MS }
  );

  const elapsedMs = useElapsed(isWaiting);

  const totalPreview = useMemo(() => {
    try {
      const amount = toBaseUnits(amountInput || "0", event.mint_decimals);
      if (amount <= 0n) return null;
      const count = Math.min(
        Math.max(1, Math.trunc(Number(winnersInput) || 0)),
        Math.max(1, event.entry_count)
      );
      return formatTokenAmountWithSymbol(
        amount * BigInt(count),
        event.mint_decimals,
        event.mint_symbol ?? ""
      );
    } catch {
      return null;
    }
  }, [
    amountInput,
    winnersInput,
    event.mint_decimals,
    event.entry_count,
    event.mint_symbol,
  ]);

  const commitAction = useAction(async () => {
    if (drawnEntries.length === 0) {
      throw new Error("This event has no entries to draw from yet.");
    }
    const amountPerWinner = toBaseUnits(amountInput, event.mint_decimals);
    if (amountPerWinner <= 0n) {
      throw new RangeError("The amount per winner must be greater than zero.");
    }
    const winnersCount = Math.min(
      Math.max(1, Math.trunc(Number(winnersInput) || 0)),
      drawnEntries.length
    );
    // Read RIGHT BEFORE committing — this slot, plus the fixed lead, is the
    // whole anti-grinding guarantee. See TARGET_SLOT_LEAD in runDraw.ts.
    const currentSlot = (await client.rpc.getSlot().send()) as bigint;
    await commitDraw({
      amountPerWinner,
      client,
      currentSlot,
      entries: drawnEntries,
      eventId: event.id,
      winnersCount,
    });
    await mutateDraw();
  });

  // Retries JUST the on-chain memo for a draw that already exists in the
  // database — never re-commits. Only reachable from the "not yet attested"
  // state below, which is exactly when `commitDraw`'s own attempt failed.
  const attestAction = useAction(async () => {
    if (!draw) throw new Error("Nothing to attest yet.");
    await attestCommit({
      client,
      commit: draw.seedCommit,
      drawId: draw.drawId,
      entriesRoot: draw.entriesRoot,
      targetSlot: draw.targetSlot,
    });
    await mutateDraw();
  });

  const revealAction = useAction(async () => {
    if (!draw) throw new Error("Nothing to reveal yet.");
    if (
      liveSlot == null ||
      !canReveal({ currentSlot: liveSlot, targetSlot: draw.targetSlot })
    ) {
      // Belt and suspenders: the button is already disabled until this is
      // true, but nothing here may take the chain's word for it either.
      throw new Error(
        "Cookie Chain has not reached the target slot yet — hang on."
      );
    }
    const block = await client.rpc
      .getBlock(draw.targetSlot, {
        rewards: false,
        transactionDetails: "none",
      })
      .send();
    if (!block) {
      throw new Error(
        "Cookie Chain has not published that block yet — try again in a moment."
      );
    }
    const seed = await getDrawSeed(draw.drawId);
    const result = await revealDraw({
      blockhash: block.blockhash,
      client,
      commitSignature: draw.commitSignature,
      drawId: draw.drawId,
      entries: drawnEntries,
      orderedHashes: draw.orderedHashes,
      seed,
      winnersCount: draw.winnersCount,
    });
    await mutateDraw();
    return result;
  });

  // A failed commit/reveal is otherwise silent: the button just stops
  // spinning. Same pattern as EventCard's own actions.
  useEffect(() => {
    if (!commitAction.error) return;
    toast.show({
      detail:
        commitAction.error instanceof Error
          ? commitAction.error.message
          : "Please try again.",
      title: "Could not start the draw",
      variant: "error",
    });
    commitAction.reset();
  }, [commitAction, toast]);

  useEffect(() => {
    if (!attestAction.error) return;
    toast.show({
      detail:
        attestAction.error instanceof Error
          ? attestAction.error.message
          : "Please try again.",
      title: "Could not attest the draw",
      variant: "error",
    });
    attestAction.reset();
  }, [attestAction, toast]);

  useEffect(() => {
    if (!revealAction.error) return;
    toast.show({
      detail:
        revealAction.error instanceof Error
          ? revealAction.error.message
          : "Please try again.",
      title: "Could not reveal the draw",
      variant: "error",
    });
    revealAction.reset();
  }, [revealAction, toast]);

  if (!isRelevant) return null;

  if (isDrawLoading) {
    return (
      <div
        className="h-24 animate-pulse rounded-xl border border-border-low bg-card"
        data-testid="draw-loading"
      />
    );
  }

  if (drawError) {
    return (
      <p className="rounded-xl border border-border-low bg-card px-4 py-5 text-sm text-danger">
        Could not load the draw for this event.{" "}
        {drawError instanceof Error ? drawError.message : ""}
      </p>
    );
  }

  // SETUP — no draw yet (or a prior one was abandoned).
  if (!draw || draw.status === "abandoned") {
    // `paid` with no draw on record means this event was settled some other
    // way (a manual send) — offering a fresh draw here would be a second,
    // unrelated payout for the same event.
    if (event.status !== "closed") return null;

    const canSubmit =
      hasEntries && !entriesLoading && amountInput.trim() !== "";
    const disabledReason = !hasEntries
      ? "Close registration and collect at least one entry first."
      : entriesLoading
        ? "Loading entries…"
        : "Enter an amount per winner first.";

    return (
      <div
        className="flex flex-col gap-4 rounded-xl border border-border-low bg-card p-5"
        data-testid="draw-setup"
      >
        <h4 className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">
          Run the draw
        </h4>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            hint={event.mint_symbol ?? undefined}
            label="Amount per winner"
          >
            <Input
              aria-label="Amount per winner"
              disabled={!hasEntries}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder="0"
              value={amountInput}
            />
          </Field>
          <Field hint={`of ${event.entry_count}`} label="Winners">
            <Input
              aria-label="Winners"
              disabled={!hasEntries}
              max={Math.max(1, event.entry_count)}
              min={1}
              onChange={(e) => setWinnersInput(e.target.value)}
              type="number"
              value={winnersInput}
            />
          </Field>
        </div>

        {totalPreview ? (
          <p className="text-[12.5px] text-ink-2">
            Total payout:{" "}
            <span className="num font-mono text-ink">{totalPreview}</span>
          </p>
        ) : null}

        <Button
          className="self-start"
          data-testid="start-draw"
          disabled={!canSubmit || commitAction.isRunning}
          disabledReason={disabledReason}
          onClick={() => commitAction.dispatch()}
        >
          {commitAction.isRunning ? "Committing…" : "Start the draw"}
        </Button>
      </div>
    );
  }

  // NOT YET ATTESTED — committed in the database, but the commit memo never
  // landed on chain (or `commitDraw`'s attempt failed). This is NOT the
  // normal wait: `verifyDraw`'s entire timing proof is `commit_slot <
  // target_slot`, and there is no `commit_slot` to compare without this memo,
  // so revealing from here would produce a draw nobody could verify. Nothing
  // below offers a Reveal button — only a retry for the attestation itself.
  if (draw.status === "committed" && draw.commitSignature === null) {
    return (
      <div
        className="flex flex-col gap-4 rounded-xl border border-dashed border-border-strong bg-card/40 p-5"
        data-testid="draw-unattested"
      >
        <span className="inline-flex w-fit items-center rounded-full bg-danger/12 px-2.5 py-1 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-danger">
          Not yet attested
        </span>
        <p className="text-[14.5px] leading-relaxed text-ink-2">
          This draw's commitment hasn't been recorded on Cookie Chain yet, so it
          can't be revealed — the timing proof needs that transaction on chain
          first. Retry sending it below.
        </p>
        <Button
          className="self-start"
          data-testid="attest-draw"
          disabled={attestAction.isRunning}
          onClick={() => attestAction.dispatch()}
        >
          {attestAction.isRunning ? "Attesting…" : "Retry attestation"}
        </Button>
      </div>
    );
  }

  // WAITING — committed and attested, the target slot has not happened yet
  // (or reveal is in flight). This is the whole point of the feature, not a
  // spinner to get past: the copy says exactly what is being waited on and
  // why.
  if (draw.status === "committed") {
    const startSlot = draw.targetSlot - TARGET_SLOT_LEAD;
    const progress =
      liveSlot != null
        ? clamp01(Number(liveSlot - startSlot) / Number(TARGET_SLOT_LEAD))
        : 0;
    const ready =
      liveSlot != null &&
      canReveal({ currentSlot: liveSlot, targetSlot: draw.targetSlot });

    return (
      <div
        className="flex flex-col gap-4 rounded-xl border border-border-low bg-card p-5"
        data-testid="draw-waiting"
      >
        <div className="flex flex-col gap-[7px]">
          <h4 className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">
            Waiting for Cookie Chain
          </h4>
          <p className="text-[14.5px] leading-relaxed text-ink-2">
            The draw uses the hash of block{" "}
            <span className="num font-mono text-ink">
              {draw.targetSlot.toString()}
            </span>
            , which Cookie Chain has not produced yet.
          </p>
        </div>

        <div
          aria-label="Progress toward the target slot"
          aria-valuemax={Number(TARGET_SLOT_LEAD)}
          aria-valuemin={0}
          aria-valuenow={Math.round(progress * Number(TARGET_SLOT_LEAD))}
          className="h-2 w-full overflow-hidden rounded-full bg-raised"
          role="progressbar"
        >
          <div
            className={
              "h-full w-full origin-left bg-accent " +
              (prefersReducedMotion
                ? ""
                : "transition-transform duration-[320ms] [transition-timing-function:var(--ease-strong-out)]")
            }
            style={{ transform: `scaleX(${progress})` }}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-ink-2">
          <span className="num font-mono" data-testid="live-slot">
            slot {liveSlot != null ? liveSlot.toString() : "…"} /{" "}
            {draw.targetSlot.toString()}
          </span>
          <span className="num font-mono">
            {formatElapsed(elapsedMs)} elapsed
          </span>
        </div>

        {draw.commitSignature ? (
          <a
            className="self-start text-[12.5px] font-medium text-accent underline underline-offset-2"
            href={explorer.txUrl(draw.commitSignature)}
            rel="noreferrer"
            target="_blank"
          >
            View commit tx on CookieScan →
          </a>
        ) : null}

        <Button
          className="self-start"
          data-testid="reveal-draw"
          disabled={!ready || revealAction.isRunning}
          disabledReason="Waiting for Cookie Chain to reach the target slot."
          onClick={() => revealAction.dispatch()}
        >
          {revealAction.isRunning ? "Revealing…" : "Reveal the winners"}
        </Button>
      </div>
    );
  }

  // REVEALED — winners, the seed, the blockhash, and a way to check all of it
  // independently. `winnersRoot` is recomputed from public columns rather
  // than stored anywhere: it is exactly what the reveal memo (`attest.ts`)
  // committed on-chain, and the verifier (verifyDraw.ts) recomputes the same
  // value the same way.
  const addressByEntryId = new Map(
    drawnEntries.map((entry) => [entry.entryId, entry.walletAddress])
  );
  const winnerAddresses = (draw.winnerEntryIds ?? []).map(
    (entryId) => addressByEntryId.get(entryId) ?? entryId
  );
  const winnersRoot =
    draw.revealedSeed && draw.chainBlockhash
      ? entriesRoot(
          pickWinners(
            draw.orderedHashes,
            draw.winnersCount,
            hexToBytes(draw.revealedSeed),
            draw.chainBlockhash
          )
        )
      : null;

  return (
    <div
      className="flex flex-col gap-4 rounded-xl border border-border-low bg-card p-5"
      data-testid="draw-revealed"
    >
      <h4 className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">
        Winners
      </h4>

      <ul className="flex flex-col gap-1.5" data-testid="winners-list">
        {winnerAddresses.map((address, index) => (
          <li
            className="flex items-center gap-2.5 rounded-md border border-border-low bg-bg1 px-3 py-2 font-mono text-[12.5px]"
            key={`${address}-${index}`}
          >
            <span className="text-accent">#{index + 1}</span>
            <span className="min-w-0 flex-1 truncate">{address}</span>
          </li>
        ))}
      </ul>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-xs uppercase tracking-[0.06em] text-ink-3">
            Seed
          </dt>
          <dd className="break-all font-mono text-[11.5px] text-ink-2">
            {draw.revealedSeed}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs uppercase tracking-[0.06em] text-ink-3">
            Blockhash
          </dt>
          <dd className="break-all font-mono text-[11.5px] text-ink-2">
            {draw.chainBlockhash}
          </dd>
        </div>
        {winnersRoot ? (
          <div className="min-w-0 sm:col-span-2">
            <dt className="text-xs uppercase tracking-[0.06em] text-ink-3">
              Winners root
            </dt>
            <dd className="break-all font-mono text-[11.5px] text-ink-2">
              {winnersRoot}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {draw.commitSignature ? (
          <a
            className="text-[12.5px] font-medium text-accent underline underline-offset-2"
            href={explorer.txUrl(draw.commitSignature)}
            rel="noreferrer"
            target="_blank"
          >
            View commit tx →
          </a>
        ) : null}
        {draw.revealSignature ? (
          <a
            className="text-[12.5px] font-medium text-accent underline underline-offset-2"
            href={explorer.txUrl(draw.revealSignature)}
            rel="noreferrer"
            target="_blank"
          >
            View reveal tx →
          </a>
        ) : null}
      </div>

      <ButtonLink
        className="self-start"
        href={`/e/${event.slug}/verify`}
        variant="secondary"
      >
        Verify this draw →
      </ButtonLink>
    </div>
  );
}
