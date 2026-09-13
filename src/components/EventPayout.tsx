import { useCallback, useEffect, useState } from "react";
import { isAddress } from "@solana/kit";
import { useAction, useClient } from "@solana/react";
import useSWR from "swr";
import { Button } from "./ui/Button";
import { Field, Input } from "./ui/Field";
import type { SelectedToken } from "./TokenSelector";
import { explorer } from "../lib/chain/explorer";
import { useToast } from "../hooks/useToast";
import type { Recipient } from "../lib/airdrop/buildPlan";
import {
  selectionToRecipients,
  splitPool,
  toRecipients,
  type DrawnEntry,
  type ManualSelection,
} from "../lib/draw/toRecipients";
import { formatTokenAmountWithSymbol } from "../lib/format/tokenAmount";
import { truncateAddress } from "../lib/format/address";
import type { EventRow } from "../lib/supabase/events";
import {
  listPayouts,
  summarise,
  type PayoutEventContext,
} from "../lib/supabase/payouts";
import { toBaseUnits } from "../lib/token/bakeForm";
import { inspectMint } from "../lib/token/inspectMint";
import type { AppClient } from "../providers";

/**
 * The three payout tools of spec §6.3, all ending in the same handoff to the
 * Airdrop screen — no new send logic lives here (§7: "cero arquitectura
 * nueva"). Every button turns its inputs into a `Recipient[]` through the
 * Task 5 adapters, resolves the event's mint into a real `SelectedToken`
 * (mirroring `EventCard`'s "Send with Airdrop"), and calls `onAirdrop`.
 */

function entryIdByAddress(
  entries: readonly DrawnEntry[]
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const entry of entries) map[entry.walletAddress] = entry.entryId;
  return map;
}

async function resolveToken(
  client: AppClient,
  event: EventRow
): Promise<SelectedToken> {
  if (!isAddress(event.mint)) {
    throw new Error("This event's mint is not a valid address.");
  }
  const mint = await inspectMint(client.rpc, event.mint);
  return {
    decimals: mint.decimals,
    mint: mint.address,
    name: event.mint_symbol ?? `Mint ${truncateAddress(event.mint)}`,
    program: mint.program,
    programAddress: mint.programAddress,
    supply: mint.supply,
    symbol: event.mint_symbol ?? "",
  };
}

export function EventPayout({
  drawId,
  entries,
  event,
  onAirdrop,
  winners,
}: {
  drawId: string | null;
  entries: readonly DrawnEntry[];
  event: EventRow;
  /** Same hand-off `EventCard` already uses — an event is just another source. */
  onAirdrop: (
    token: SelectedToken,
    recipients: Recipient[],
    eventContext: PayoutEventContext
  ) => void;
  /** Hash-based winners from the revealed draw, or null before reveal. */
  winners: readonly string[] | null;
}) {
  const client = useClient<AppClient>();
  const toast = useToast();

  const [amountPerWinner, setAmountPerWinner] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [amountByEntry, setAmountByEntry] = useState<Record<string, string>>(
    {}
  );
  const [poolTotal, setPoolTotal] = useState("");

  const { data: payoutRows, mutate: mutatePayouts } = useSWR(
    ["payouts", event.id],
    () => listPayouts(event.id)
  );
  const summary = summarise(payoutRows ?? []);

  const handoff = useCallback(
    async (recipients: Recipient[]) => {
      const token = await resolveToken(client, event);
      onAirdrop(token, recipients, {
        drawId,
        entryIdByAddress: entryIdByAddress(entries),
        eventId: event.id,
      });
      await mutatePayouts();
    },
    [client, drawId, entries, event, mutatePayouts, onAirdrop]
  );

  const payWinnersAction = useAction(async () => {
    if (!winners || winners.length === 0) {
      throw new Error("This draw has no revealed winners yet.");
    }
    const amount = toBaseUnits(amountPerWinner, event.mint_decimals);
    await handoff(toRecipients(winners, entries, amount));
  });

  const sendSelectedAction = useAction(async () => {
    const selection: ManualSelection[] = entries
      .filter((entry) => selected.has(entry.entryId))
      .map((entry) => ({
        amount: toBaseUnits(
          amountByEntry[entry.entryId] ?? "0",
          event.mint_decimals
        ),
        entryId: entry.entryId,
        walletAddress: entry.walletAddress,
      }));
    await handoff(selectionToRecipients(selection));
  });

  const splitPoolAction = useAction(async () => {
    if (entries.length === 0) {
      throw new Error("There are no registered entries to split a pool among.");
    }
    const pool = toBaseUnits(poolTotal, event.mint_decimals);
    const parts = splitPool(pool, entries.length);
    const selection: ManualSelection[] = entries.map((entry, index) => ({
      amount: parts[index],
      entryId: entry.entryId,
      walletAddress: entry.walletAddress,
    }));
    await handoff(selectionToRecipients(selection));
  });

  useEffect(() => {
    if (!payWinnersAction.error) return;
    toast.show({
      detail:
        payWinnersAction.error instanceof Error
          ? payWinnersAction.error.message
          : "Please try again.",
      title: "Could not prepare the payout",
      variant: "error",
    });
    payWinnersAction.reset();
  }, [payWinnersAction, toast]);

  useEffect(() => {
    if (!sendSelectedAction.error) return;
    toast.show({
      detail:
        sendSelectedAction.error instanceof Error
          ? sendSelectedAction.error.message
          : "Please try again.",
      title: "Could not prepare the payout",
      variant: "error",
    });
    sendSelectedAction.reset();
  }, [sendSelectedAction, toast]);

  useEffect(() => {
    if (!splitPoolAction.error) return;
    toast.show({
      detail:
        splitPoolAction.error instanceof Error
          ? splitPoolAction.error.message
          : "Please try again.",
      title: "Could not prepare the payout",
      variant: "error",
    });
    splitPoolAction.reset();
  }, [splitPoolAction, toast]);

  const toggleSelected = useCallback((entryId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  }, []);

  const selectedCount = selected.size;
  const anyRunning =
    payWinnersAction.isRunning ||
    sendSelectedAction.isRunning ||
    splitPoolAction.isRunning;

  return (
    <div
      className="flex flex-col gap-4 rounded-xl border border-border-low bg-card p-5"
      data-testid="event-payout"
    >
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">
          Pay
        </h4>
        <span className="text-[12.5px] text-ink-2">
          {summary.confirmed} confirmed
          {summary.unconfirmed > 0 ? ` · ${summary.unconfirmed} pending` : null}
          {summary.paidBaseUnits > 0n
            ? ` · ${formatTokenAmountWithSymbol(summary.paidBaseUnits, event.mint_decimals, event.mint_symbol ?? "")} sent`
            : null}
        </span>
      </div>

      {summary.knownIncomplete ? (
        <p className="text-[12.5px] leading-relaxed text-ink-3">
          No confirmed payouts are mirrored here yet. This table is never the
          source of truth —{" "}
          <a
            className="font-medium text-accent underline underline-offset-2"
            href={explorer.tokenUrl(event.mint)}
            rel="noreferrer"
            target="_blank"
          >
            check CookieScan
          </a>{" "}
          for the real history if this ever looks wrong.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Field hint={event.mint_symbol ?? undefined} label="Amount per winner">
          <Input
            aria-label="Amount per winner"
            onChange={(e) => setAmountPerWinner(e.target.value)}
            placeholder="0"
            value={amountPerWinner}
          />
        </Field>
        <Button
          disabled={!winners || winners.length === 0 || anyRunning}
          disabledReason="Reveal the draw first."
          onClick={() => payWinnersAction.dispatch()}
          variant="secondary"
        >
          {payWinnersAction.isRunning ? "Preparing…" : "Pay the winners"}
        </Button>

        <div className="hidden sm:block" />
        <Button
          disabled={selectedCount === 0 || anyRunning}
          disabledReason="Check at least one recipient below."
          onClick={() => sendSelectedAction.dispatch()}
          variant="secondary"
        >
          {sendSelectedAction.isRunning
            ? "Preparing…"
            : `Send to selected (${selectedCount})`}
        </Button>

        <Field hint={event.mint_symbol ?? undefined} label="Pool total">
          <Input
            aria-label="Pool total"
            onChange={(e) => setPoolTotal(e.target.value)}
            placeholder="0"
            value={poolTotal}
          />
        </Field>
        <Button
          disabled={entries.length === 0 || anyRunning}
          disabledReason="This event has no registered entries."
          onClick={() => splitPoolAction.dispatch()}
          variant="secondary"
        >
          {splitPoolAction.isRunning ? "Preparing…" : "Split a pool"}
        </Button>
      </div>

      {entries.length > 0 ? (
        <div
          className="overflow-x-auto rounded-lg border border-border-low"
          data-testid="event-payout-entries"
        >
          <table className="w-full min-w-[420px] border-collapse text-left">
            <caption className="sr-only">Registered entries</caption>
            <thead>
              <tr className="border-b border-border-low text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">
                <th className="px-3 py-2.5 font-semibold" scope="col">
                  Select
                </th>
                <th className="px-2 py-2.5 font-semibold" scope="col">
                  Wallet
                </th>
                <th
                  className="px-3 py-2.5 text-right font-semibold"
                  scope="col"
                >
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const isWinner = winners?.includes(entry.hash) ?? false;
                return (
                  <tr
                    className="border-b border-border-low/60 last:border-0"
                    key={entry.entryId}
                  >
                    <td className="px-3 py-2">
                      <input
                        aria-label={`Select ${entry.walletAddress}`}
                        checked={selected.has(entry.entryId)}
                        onChange={() => toggleSelected(entry.entryId)}
                        type="checkbox"
                      />
                    </td>
                    <td className="px-2 py-2 font-mono text-[12.5px]">
                      {truncateAddress(entry.walletAddress)}
                      {isWinner ? (
                        <span className="ml-2 rounded-chip bg-accent/12 px-2 py-[3px] text-[11px] font-semibold text-accent">
                          Winner
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        aria-label={`Amount for ${entry.walletAddress}`}
                        className="h-8 w-28 rounded-md border border-border-strong bg-bg1 px-2 text-right font-mono text-[12.5px] outline-none focus:border-accent"
                        disabled={!selected.has(entry.entryId)}
                        onChange={(e) =>
                          setAmountByEntry((prev) => ({
                            ...prev,
                            [entry.entryId]: e.target.value,
                          }))
                        }
                        placeholder="0"
                        value={amountByEntry[entry.entryId] ?? ""}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
