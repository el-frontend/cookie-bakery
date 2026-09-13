import { supabase } from "./client";
import type { Database } from "./types";

export type EventRow = Database["public"]["Tables"]["events"]["Row"];
export type EntryRow = Database["public"]["Tables"]["entries"]["Row"];

/**
 * What the public page is allowed to know.
 *
 * `id` is included even though the row also has a public `slug`: it is what
 * `registerEntry` needs as `entries.event_id` (a uuid FK, per the
 * `entries_public_insert` RLS check), and the public page has no other way to
 * learn it — anon can read `events` but never `entries`. Exposing the id is
 * not a new leak: RLS is row-level, so anon could already read this column
 * before it was added to this select, and nothing here is secret the way
 * `creator_id` is (which stays out of this type).
 */
export type PublicEvent = {
  entryCount: number;
  id: string;
  mint: string;
  mintDecimals: number;
  mintSymbol: string | null;
  slug: string;
  status: EventRow["status"];
  title: string;
};

/**
 * Base units as an exact bigint.
 *
 * CAST numeric COLUMNS TO TEXT IN THE SELECT, or this function cannot save
 * you. PostgREST renders `numeric` as a JSON *number*, so by the time a plain
 * `select("amount_per_winner")` reaches here the value is already a rounded
 * double — verified against the live project, where writing
 * 1000000000000000001 read back as 1000000000000000000 with no error. One
 * token silently gone, and TypeScript happy, because the generated types
 * declare the column `number`.
 *
 * The shape that works, confirmed round-tripping through BigInt exactly:
 *
 *     .select("amount:amount_per_winner::text")
 *
 * Writes were never affected — Postgres stores the value correctly; only
 * reads lost precision. Applies to `draws.amount_per_winner` and
 * `payouts.amount`.
 */
export function parseBaseUnits(value: string | null): bigint {
  if (value === null) {
    throw new RangeError("Expected a numeric base-unit amount, got null.");
  }
  if (!/^\d+$/.test(value)) {
    throw new RangeError(`"${value}" is not an integer amount of base units.`);
  }
  return BigInt(value);
}

const UNIQUE_VIOLATION = "23505";

/**
 * anon has no SELECT policy on `entries`, so we cannot look before inserting.
 * The unique constraint IS the check, and its error is the answer the visitor
 * needs to see.
 */
export function registrationOutcome(
  error: { code?: string; message: string } | null
): "already-registered" | "ok" {
  if (error === null) return "ok";
  if (error.code === UNIQUE_VIOLATION) return "already-registered";
  throw new Error(error.message);
}

export async function createEvent(input: {
  mint: string;
  mintDecimals: number;
  mintSymbol: string | null;
  slug: string;
  title: string;
}): Promise<EventRow> {
  // `events_owner_all`'s `with check (creator_id = (select auth.uid()))`
  // means the insert is rejected unless `creator_id` is set to the caller's
  // own id — the column has no default, so this cannot be left out.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) throw new Error(authError.message);
  if (!user) throw new Error("You must be signed in to create an event.");

  const { data, error } = await supabase
    .from("events")
    .insert({
      creator_id: user.id,
      mint: input.mint,
      mint_decimals: input.mintDecimals,
      mint_symbol: input.mintSymbol,
      slug: input.slug,
      title: input.title,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function openEvent(id: string): Promise<void> {
  const { error } = await supabase
    .from("events")
    .update({ opened_at: new Date().toISOString(), status: "open" })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function closeEvent(id: string): Promise<void> {
  const { error } = await supabase
    .from("events")
    .update({ closed_at: new Date().toISOString(), status: "closed" })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listMyEvents(): Promise<EventRow[]> {
  const { data, error } = await supabase
    .from("events")
    .select()
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function getPublicEvent(
  slug: string
): Promise<PublicEvent | null> {
  const { data, error } = await supabase
    .from("events")
    .select(
      "entry_count, id, mint, mint_decimals, mint_symbol, slug, status, title"
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data === null) return null;
  return {
    entryCount: data.entry_count,
    id: data.id,
    mint: data.mint,
    mintDecimals: data.mint_decimals,
    mintSymbol: data.mint_symbol,
    slug: data.slug,
    status: data.status,
    title: data.title,
  };
}

export async function registerEntry(
  eventId: string,
  walletAddress: string
): Promise<"already-registered" | "ok"> {
  // NOTE the absence of `.select()`. PostgREST only returns the inserted row
  // when one is chained, and anon has no SELECT policy on `entries` — asking
  // for the representation back would fail RLS even though the insert itself
  // is allowed.
  const { error } = await supabase
    .from("entries")
    .insert({ event_id: eventId, wallet_address: walletAddress });
  return registrationOutcome(error);
}

export async function listEntries(eventId: string): Promise<EntryRow[]> {
  const { data, error } = await supabase
    .from("entries")
    .select()
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}
