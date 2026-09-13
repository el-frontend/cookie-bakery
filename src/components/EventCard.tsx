import { useCallback, useEffect, useState } from "react";
import { isAddress, type Address } from "@solana/kit";
import { useAction, useClient } from "@solana/react";
import { Button } from "./ui/Button";
import type { SelectedToken } from "./TokenSelector";
import { useToast } from "../hooks/useToast";
import type { Recipient } from "../lib/airdrop/buildPlan";
import { truncateAddress } from "../lib/format/address";
import { listEntries, type EventRow } from "../lib/supabase/events";
import { inspectMint } from "../lib/token/inspectMint";
import type { AppClient } from "../providers";

/**
 * One creator event: status, the public link, entry count, and the actions
 * that move it through `draft → open → closed` (`paid` is read-only here —
 * nothing in this task can produce it; that arrives with the draw in a later
 * task).
 *
 * No QR code: a correct encoder is real code (Reed–Solomon, mode selection,
 * mask scoring) and a subtly wrong one produces a QR that LOOKS fine but does
 * not scan — a failure mode vitest cannot catch. The CSP already rules out an
 * external library for one component, so this ships the link + a copy button
 * only; the QR is deferred, not silently skipped.
 */

const STATUS_LABEL: Record<EventRow["status"], string> = {
  closed: "Closed",
  draft: "Draft",
  open: "Open",
  paid: "Paid",
};

const STATUS_DOT: Record<EventRow["status"], string> = {
  closed: "bg-ink-3",
  draft: "bg-ink-4",
  open: "bg-success shadow-[0_0_0_3px_rgba(95,191,140,0.16)]",
  paid: "bg-accent shadow-[0_0_0_3px_rgba(232,163,61,0.16)]",
};

/** Same-origin, per `src/public/route.ts` — no separate public host to know. */
function publicUrl(slug: string): string {
  return `${window.location.origin}/e/${slug}`;
}

function toAddress(value: string): value is Address {
  return isAddress(value);
}

export function EventCard({
  event,
  onAirdrop,
  onClose,
  onOpen,
}: {
  event: EventRow;
  /**
   * Hands a token + recipient list to the main Airdrop screen, the same
   * hand-off shape `Oven`'s "Airdrop more" already uses. Recipients carry a
   * `0n` placeholder amount — this task only wires the pipe from a closed
   * event's registrants to the Airdrop screen's token picker; per-recipient
   * amounts and the actual draw are later tasks' work.
   */
  onAirdrop: (token: SelectedToken, recipients: Recipient[]) => void;
  onClose: () => Promise<void>;
  onOpen: () => Promise<void>;
}) {
  const client = useClient<AppClient>();
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const link = publicUrl(event.slug);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // Clipboard can be unavailable (insecure origin, denied permission).
      // Leaving the label unchanged is honest: nothing was copied.
      setCopied(false);
    }
  }, [link]);

  const openAction = useAction(onOpen);
  const closeAction = useAction(onClose);

  const airdropAction = useAction(async () => {
    if (!isAddress(event.mint)) {
      throw new Error("This event's mint is not a valid address.");
    }

    const [entries, mint] = await Promise.all([
      listEntries(event.id),
      inspectMint(client.rpc, event.mint),
    ]);

    const recipients: Recipient[] = entries
      .map((entry) => entry.wallet_address)
      .filter(toAddress)
      .map((address) => ({ address, amount: 0n }));

    const token: SelectedToken = {
      decimals: mint.decimals,
      mint: mint.address,
      name: event.mint_symbol ?? `Mint ${truncateAddress(event.mint)}`,
      program: mint.program,
      programAddress: mint.programAddress,
      supply: mint.supply,
      symbol: event.mint_symbol ?? "",
    };

    onAirdrop(token, recipients);
  });

  // Each action shows its own failure once, then clears so a retry starts
  // from a clean slate rather than re-announcing the same toast.
  useEffect(() => {
    if (!openAction.error) return;
    toast.show({
      detail:
        openAction.error instanceof Error
          ? openAction.error.message
          : "Please try again.",
      title: "Could not open registration",
      variant: "error",
    });
    openAction.reset();
  }, [openAction, toast]);

  useEffect(() => {
    if (!closeAction.error) return;
    toast.show({
      detail:
        closeAction.error instanceof Error
          ? closeAction.error.message
          : "Please try again.",
      title: "Could not close registration",
      variant: "error",
    });
    closeAction.reset();
  }, [closeAction, toast]);

  useEffect(() => {
    if (!airdropAction.error) return;
    toast.show({
      detail:
        airdropAction.error instanceof Error
          ? airdropAction.error.message
          : "Please try again.",
      title: "Could not prepare the airdrop",
      variant: "error",
    });
    airdropAction.reset();
  }, [airdropAction, toast]);

  return (
    <article
      className="enter flex flex-col gap-4 rounded-xl border border-border-low bg-card p-5"
      data-status={event.status}
      data-testid="event-card"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="truncate font-display text-lg font-bold tracking-[-0.02em]">
            {event.title}
          </h3>
          <span className="truncate font-mono text-[11.5px] text-ink-3">
            {event.mint_symbol ?? truncateAddress(event.mint)}
          </span>
        </div>
        <span className="flex shrink-0 items-center gap-[7px] rounded-md border border-border-low bg-bg1 px-3 py-1.5">
          <span
            aria-hidden
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[event.status]}`}
          />
          <span className="text-[12.5px] font-medium text-ink-2">
            {STATUS_LABEL[event.status]}
          </span>
        </span>
      </div>

      {event.status === "draft" ? (
        <p className="text-sm leading-relaxed text-ink-2">
          Not public yet — open registration to get a shareable link. A draft
          link does not resolve, even if you send it out early.
        </p>
      ) : (
        <div className="flex flex-col gap-2 rounded-lg border border-border-low bg-bg1 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">
              {event.status === "open" ? "Registered so far" : "Final entries"}
            </span>
            <span
              className="font-mono text-lg font-bold text-accent num"
              data-testid="entry-count"
            >
              {event.entry_count}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate rounded-md border border-border-strong bg-card px-3 py-2 font-mono text-[12.5px] text-ink-2">
              {link}
            </span>
            <Button
              data-testid="copy-link"
              onClick={() => void copy()}
              variant="secondary"
            >
              {copied ? "Copied" : "Copy link"}
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        {event.status === "draft" ? (
          <Button
            data-testid="open-event"
            disabled={openAction.isRunning}
            onClick={() => openAction.dispatch()}
          >
            {openAction.isRunning ? "Opening…" : "Open registration"}
          </Button>
        ) : null}

        {event.status === "open" ? (
          <Button
            data-testid="close-event"
            disabled={closeAction.isRunning}
            onClick={() => closeAction.dispatch()}
            variant="secondary"
          >
            {closeAction.isRunning ? "Closing…" : "Close registration"}
          </Button>
        ) : null}

        {event.status === "closed" && event.entry_count > 0 ? (
          <Button
            data-testid="airdrop-event"
            disabled={airdropAction.isRunning}
            onClick={() => airdropAction.dispatch()}
            variant="secondary"
          >
            {airdropAction.isRunning ? "Preparing…" : "Send with Airdrop →"}
          </Button>
        ) : null}
      </div>
    </article>
  );
}
