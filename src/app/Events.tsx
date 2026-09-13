import { useCallback, useEffect, useState } from "react";
import useSWR from "swr";
import { useAction, useClient } from "@solana/react";
import { CreatorSignIn } from "../components/CreatorSignIn";
import { EventCard } from "../components/EventCard";
import { EventForm, type CreateEventInput } from "../components/EventForm";
import { TokenSelector, type SelectedToken } from "../components/TokenSelector";
import { useCreatorSession } from "../hooks/useCreatorSession";
import { useToast } from "../hooks/useToast";
import type { Recipient } from "../lib/airdrop/buildPlan";
import {
  closeEvent,
  createEvent,
  listMyEvents,
  openEvent,
} from "../lib/supabase/events";
import type { AppClient } from "../providers";

/**
 * The creator's side of the airdrop-event feature: create an event, open it
 * for registration, share the link, watch entries arrive, close it.
 *
 * `useCreatorSession` gates the whole screen — signed out renders
 * `CreatorSignIn` in its place, the same pattern every other screen uses to
 * gate on a connected wallet. The event list comes from `listMyEvents`
 * through SWR (never TanStack Query, per the stack's rules) rather than a
 * hand-rolled fetch effect, and every mutation (`createEvent`/`openEvent`/
 * `closeEvent`) revalidates it afterwards so the list — and the trigger-
 * maintained `entry_count` a card reads live off it — never goes stale.
 */
export function Events({
  onAirdrop,
}: {
  onAirdrop: (token: SelectedToken, recipients: Recipient[]) => void;
}) {
  const client = useClient<AppClient>();
  const { status } = useCreatorSession();
  const toast = useToast();
  const [newToken, setNewToken] = useState<SelectedToken | null>(null);

  const {
    data: events,
    error: listError,
    isLoading,
    mutate,
  } = useSWR(status === "signed-in" ? "creator-events" : null, listMyEvents);

  const {
    dispatch: create,
    error: createError,
    isRunning: isCreating,
    reset: resetCreate,
  } = useAction(async (_signal: AbortSignal, input: CreateEventInput) => {
    await createEvent(input);
    setNewToken(null);
    await mutate();
  });

  // A failed create is otherwise silent: the form just stops "Creating…".
  useEffect(() => {
    if (!createError) return;
    toast.show({
      detail:
        createError instanceof Error
          ? createError.message
          : "Please try again.",
      title: "Could not create the event",
      variant: "error",
    });
    resetCreate();
  }, [createError, resetCreate, toast]);

  const openOne = useCallback(
    async (id: string) => {
      await openEvent(id);
      await mutate();
    },
    [mutate]
  );

  const closeOne = useCallback(
    async (id: string) => {
      await closeEvent(id);
      await mutate();
    },
    [mutate]
  );

  if (status === "loading") {
    return (
      <div
        className="h-40 animate-pulse rounded-xl border border-border-low bg-card"
        data-testid="events-loading"
      />
    );
  }

  if (status === "signed-out") {
    return <CreatorSignIn />;
  }

  return (
    <section
      aria-label="Manage your events"
      className="flex flex-col gap-[22px]"
    >
      <div className="enter enter-1 flex flex-col gap-[7px]">
        <h2 className="font-display text-[34px] font-bold leading-[1.1] tracking-[-0.03em]">
          Events
        </h2>
        <p className="text-[14.5px] leading-relaxed text-ink-2">
          Create an airdrop event, share the link, and watch entries arrive.
        </p>
      </div>

      <div className="enter enter-2 flex flex-col gap-4">
        <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">
          New event
        </h3>
        <TokenSelector
          onChange={setNewToken}
          rpc={client.rpc}
          value={newToken}
        />
        <div className={isCreating ? "pointer-events-none opacity-60" : ""}>
          <EventForm
            onSubmit={create}
            token={
              newToken
                ? {
                    decimals: newToken.decimals,
                    mint: newToken.mint,
                    symbol: newToken.symbol,
                  }
                : null
            }
          />
        </div>
      </div>

      <div className="enter enter-3 flex flex-col gap-4">
        <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">
          Your events
        </h3>

        {isLoading ? (
          <div className="h-24 animate-pulse rounded-xl border border-border-low bg-card" />
        ) : listError ? (
          <p className="rounded-xl border border-border-low bg-card px-4 py-5 text-sm text-danger">
            Could not load your events.{" "}
            {listError instanceof Error ? listError.message : ""}
          </p>
        ) : events && events.length > 0 ? (
          <div className="flex flex-col gap-4" data-testid="events-list">
            {events.map((event) => (
              <EventCard
                event={event}
                key={event.id}
                onAirdrop={onAirdrop}
                onClose={() => closeOne(event.id)}
                onOpen={() => openOne(event.id)}
              />
            ))}
          </div>
        ) : (
          <p
            className="rounded-xl border border-dashed border-border-strong bg-card/40 px-4 py-8 text-center text-sm text-ink-2"
            data-testid="events-empty"
          >
            No events yet — pick a token above and give it a title to create
            your first one.
          </p>
        )}
      </div>
    </section>
  );
}
