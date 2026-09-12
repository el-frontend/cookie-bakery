import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";

/**
 * RLS is the only security boundary in this feature, so it is tested against
 * real Postgres — the actual remote `cookie-bakery` Supabase project, not a
 * mock and not a local Docker stack. Project identifiers live in `.env`, not
 * here.
 *
 * Credentials come from `.env` via `vitest.config.ts` (see the comment
 * there): `SUPABASE_RLS_URL`, `SUPABASE_RLS_ANON_KEY` and
 * `SUPABASE_RLS_SECRET_KEY`. When they are absent — a machine without the
 * project's `.env` — every test below self-skips so `npm test` stays green.
 * On a machine that HAS `.env` (this one), nothing should be skipped: a
 * fully-skipped run looks identical to success and proves nothing.
 *
 * Setup runs at module top level with a top-level `await`, NOT inside
 * `beforeAll`. This matters: `when()` below decides `it` vs `it.skip` at
 * *collection* time — while Vitest is importing this file to build the test
 * tree — which happens before any `beforeAll` hook ever runs. A `beforeAll`
 * that sets `up` would always be too late; every test would bind to
 * `it.skip` permanently regardless of reachability. Top-level `await`
 * delays module evaluation (and therefore the `describe`/`it` calls below)
 * until the probe and fixtures are actually ready.
 *
 * All fixtures are namespaced under a per-run id (`RUN`) so they are
 * unmistakably test data and so repeated runs never collide, and `afterAll`
 * deletes the fixture auth user, which cascades (via `on delete cascade` FKs
 * back to `auth.users`) through every row this file creates — events,
 * entries, draws. The suite verifies that cascade actually fired before
 * declaring itself done, using the admin client (RLS does not apply to it).
 */

const URL = process.env.SUPABASE_RLS_URL ?? "";
const ANON_KEY = process.env.SUPABASE_RLS_ANON_KEY ?? "";
const SECRET_KEY = process.env.SUPABASE_RLS_SECRET_KEY ?? "";

// Unique per run: makes fixtures obvious as test data and lets the suite be
// re-run against the same live project without a slug/email collision.
const RUN = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const MINT = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

let up = false;
let anon!: SupabaseClient;
let admin!: SupabaseClient;
let eventOpen!: string;
let eventDraft!: string;
let eventClosed!: string;
let creatorId = "";

if (URL && ANON_KEY && SECRET_KEY) {
  try {
    // Not `/rest/v1/`: PostgREST's root route on this project answers 401
    // "Secret API key required" for a publishable key. GoTrue's health check
    // accepts the publishable key and is enough to prove the project is up.
    const ping = await fetch(`${URL}/auth/v1/health`, {
      headers: { apikey: ANON_KEY },
    });
    up = ping.ok;
  } catch {
    up = false;
  }
}

if (up) {
  // No autoRefreshToken/persistSession: this is a one-shot Node process, not
  // a browser tab, and a refresh timer would keep the runner alive.
  const clientOptions = {
    auth: { autoRefreshToken: false, persistSession: false },
  };
  anon = createClient(URL, ANON_KEY, clientOptions);
  admin = createClient(URL, SECRET_KEY, clientOptions);

  const { data: user, error: userError } = await admin.auth.admin.createUser({
    email: `rls-test-${RUN}@example.test`,
    email_confirm: true,
    password: "correct-horse-battery-staple",
  });
  if (userError || !user.user) {
    throw new Error(
      `fixture setup: could not create test creator — ${userError?.message}`
    );
  }
  creatorId = user.user.id;

  const seed = async (status: string, slug: string) => {
    const { data, error } = await admin
      .from("events")
      .insert({
        creator_id: creatorId,
        mint: MINT,
        mint_decimals: 6,
        slug,
        status,
        title: `Event ${slug}`,
      })
      .select("id")
      .single();
    if (error || !data) {
      throw new Error(
        `fixture setup: could not seed event ${slug} — ${error?.message}`
      );
    }
    return data.id as string;
  };

  eventOpen = await seed("open", `rls-test-${RUN}-open`);
  eventDraft = await seed("draft", `rls-test-${RUN}-draft`);
  eventClosed = await seed("closed", `rls-test-${RUN}-closed`);
}

afterAll(async () => {
  if (!up || !creatorId) return;

  // Hard-deleting the fixture user cascades (on delete cascade) through
  // events -> entries/draws -> draw_secrets/payouts, removing everything
  // this file created in one step.
  const { error } = await admin.auth.admin.deleteUser(creatorId);
  if (error) {
    throw new Error(
      `cleanup: could not delete test creator — ${error.message}`
    );
  }

  // Prove the cascade actually happened rather than trusting it silently —
  // a leftover row here is exactly the "junk accumulates in a live project"
  // defect this suite must not have.
  const leftoverEvents = await admin
    .from("events")
    .select("id")
    .eq("creator_id", creatorId);
  if ((leftoverEvents.data?.length ?? 0) > 0) {
    throw new Error(
      "cleanup: events fixture rows survived deleting the test creator"
    );
  }
});

const when = () => (up ? it : it.skip);

describe("RLS · entries", () => {
  when()("anon puede registrarse en un evento abierto", async () => {
    const { error } = await anon.from("entries").insert({
      event_id: eventOpen,
      wallet_address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    });
    expect(error).toBeNull();
  });

  when()("anon NO puede leer entries de ninguna forma", async () => {
    // La mitigación del honeypot. Si esto pasa, la lista de la audiencia de
    // cualquier creador es pública. Solo el cliente anon prueba algo aquí —
    // el cliente admin usa la service/secret key y se salta RLS por completo.
    //
    // Autosuficiente a propósito: sembramos la fila con el cliente admin
    // (bypassa RLS) y confirmamos con el propio admin que existe, para que
    // el test no dependa de que otro `it` anterior haya dejado una entry.
    // Sin esto, ejecutar este `it` en aislamiento (o reordenar el archivo)
    // lo volvería verdad vacua: una tabla vacía también "parece" protegida.
    const wallet = "8pM7v7pXMDCK9pM7v7pXMDCK9pM7v7pXMDCK9pM7v7pX";
    const seeded = await admin.from("entries").insert({
      event_id: eventOpen,
      wallet_address: wallet,
    });
    expect(
      seeded.error,
      `no se pudo sembrar la fixture: ${seeded.error?.message}`
    ).toBeNull();

    const asAdmin = await admin
      .from("entries")
      .select("id")
      .eq("event_id", eventOpen);
    expect(
      asAdmin.data?.length ?? 0,
      "la fixture no quedó visible ni para el cliente admin, el test no prueba nada"
    ).toBeGreaterThan(0);
    const seededCount = asAdmin.data!.length;

    // Un GRANT amplio de Supabase por defecto le da a `anon` SELECT sobre
    // `entries` a nivel de tabla, así que lo que realmente bloquea la lectura
    // es la AUSENCIA de una policy de SELECT para `anon` — con RLS activo eso
    // se traduce en 0 filas con un 200, no en un 403. Por eso la aserción
    // acepta data vacío O error, y por qué un futuro lector no debería
    // "arreglar" esto esperando un error explícito.
    const { data, error } = await anon.from("entries").select("*");
    expect(
      error === null ? data : [],
      `admin ve ${seededCount} fila(s) para este evento; anon debería ver 0`
    ).toEqual([]);
  });

  when()("anon no puede registrarse en un evento draft", async () => {
    const { error } = await anon.from("entries").insert({
      event_id: eventDraft,
      wallet_address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
    });
    expect(error).not.toBeNull();
  });

  when()("anon no puede registrarse en un evento cerrado", async () => {
    const { error } = await anon.from("entries").insert({
      event_id: eventClosed,
      wallet_address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
    });
    expect(error).not.toBeNull();
  });

  when()("la misma wallet no entra dos veces en el mismo evento", async () => {
    const wallet = "So11111111111111111111111111111111111111112";
    await anon.from("entries").insert({
      event_id: eventOpen,
      wallet_address: wallet,
    });
    const { error } = await anon.from("entries").insert({
      event_id: eventOpen,
      wallet_address: wallet,
    });
    expect(error?.code).toBe("23505"); // unique_violation
  });
});

describe("RLS · events", () => {
  when()("anon ve los eventos no-draft", async () => {
    const { data } = await anon
      .from("events")
      .select("slug")
      .eq("id", eventOpen);
    expect(data).toHaveLength(1);
  });

  when()("anon NO ve los eventos draft", async () => {
    const { data } = await anon
      .from("events")
      .select("slug")
      .eq("id", eventDraft);
    expect(data).toEqual([]);
  });

  when()("entry_count lo mantiene el trigger", async () => {
    const before = await admin
      .from("events")
      .select("entry_count")
      .eq("id", eventOpen)
      .single();
    await anon.from("entries").insert({
      event_id: eventOpen,
      wallet_address: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
    });
    const after = await admin
      .from("events")
      .select("entry_count")
      .eq("id", eventOpen)
      .single();
    expect(after.data!.entry_count).toBe(before.data!.entry_count + 1);
  });
});

describe("RLS · draws", () => {
  when()("anon puede leer draws, porque verificar es público", async () => {
    const { error } = await anon.from("draws").select("*");
    expect(error).toBeNull();
  });

  when()("anon no puede leer draw_secrets", async () => {
    // Same reasoning as the entries honeypot test above: a broad default
    // GRANT means the table is reachable, so what actually blocks anon is
    // the missing SELECT policy — RLS turns that into 0 rows with a 200, not
    // a 403. Empty data is the pass condition, not an error.
    const { data, error } = await anon.from("draw_secrets").select("*");
    expect(error === null ? data : []).toEqual([]);
  });

  when()("nadie puede borrar un draw", async () => {
    // Sin esto el creador podría re-tirar un sorteo sin dejar rastro.
    const { data } = await admin
      .from("draws")
      .insert({
        entries_root: "aa".repeat(32),
        entry_hashes: ["aa".repeat(32)],
        event_id: eventClosed,
        amount_per_winner: "1000",
        seed_commit: "bb".repeat(32),
        target_slot: 1150,
        winners_count: 1,
      })
      .select("id")
      .single();

    const { error } = await anon.from("draws").delete().eq("id", data!.id);
    const still = await anon.from("draws").select("id").eq("id", data!.id);
    expect(still.data).toHaveLength(1);
    expect(error !== null || still.data!.length === 1).toBe(true);
  });

  when()("no se puede crear un draw sobre un evento abierto", async () => {
    const { error } = await admin.rpc("assert_draw_event_closed", {
      p_event_id: eventOpen,
    });
    expect(error).not.toBeNull();
  });
});
