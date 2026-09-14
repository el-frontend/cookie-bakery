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
// Real authenticated JWTs (not `anon`, not `admin`) for the two creators used
// by the cross-tenant and commitment-immutability cases below.
let creatorA!: SupabaseClient;
let creatorB!: SupabaseClient;
let eventOpen!: string;
let eventDraft!: string;
let eventClosed!: string;
let eventPaid!: string;
let creatorId = "";
let creatorBId = "";

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

  const creatorAEmail = `rls-test-${RUN}@example.test`;
  const creatorAPassword = "correct-horse-battery-staple";
  const { data: user, error: userError } = await admin.auth.admin.createUser({
    email: creatorAEmail,
    email_confirm: true,
    password: creatorAPassword,
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
  eventPaid = await seed("paid", `rls-test-${RUN}-paid`);

  // Second creator, needed only to prove cross-tenant isolation below: an
  // authenticated non-owner must see none of creator A's private rows. This
  // is a materially different claim from "anon can't see it" — a broad
  // default GRANT plus a missing policy could still block anon while a
  // buggy owner-scoped policy leaks rows to any other logged-in user.
  const creatorBEmail = `rls-test-${RUN}-b@example.test`;
  const creatorBPassword = "correct-horse-battery-staple-b";
  const { data: userB, error: userBError } = await admin.auth.admin.createUser({
    email: creatorBEmail,
    email_confirm: true,
    password: creatorBPassword,
  });
  if (userBError || !userB.user) {
    throw new Error(
      `fixture setup: could not create second test creator — ${userBError?.message}`
    );
  }
  creatorBId = userB.user.id;

  // `createClient` + `signInWithPassword`, not `admin`: these two clients
  // must carry a real `authenticated` JWT for their own user, which is what
  // makes `auth.uid()` resolve inside the policies under test.
  creatorA = createClient(URL, ANON_KEY, clientOptions);
  const signInA = await creatorA.auth.signInWithPassword({
    email: creatorAEmail,
    password: creatorAPassword,
  });
  if (signInA.error) {
    throw new Error(
      `fixture setup: creator A sign-in failed — ${signInA.error.message}`
    );
  }

  creatorB = createClient(URL, ANON_KEY, clientOptions);
  const signInB = await creatorB.auth.signInWithPassword({
    email: creatorBEmail,
    password: creatorBPassword,
  });
  if (signInB.error) {
    throw new Error(
      `fixture setup: creator B sign-in failed — ${signInB.error.message}`
    );
  }
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

  // Creator B owns no events (it exists only to prove isolation as a reader),
  // so there is nothing to cascade-check for it beyond deleting the user.
  if (creatorBId) {
    const { error: errorB } = await admin.auth.admin.deleteUser(creatorBId);
    if (errorB) {
      throw new Error(
        `cleanup: could not delete second test creator — ${errorB.message}`
      );
    }
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

  when()("anon no puede registrarse en un evento paid", async () => {
    // `entries_public_insert` only allows `status = 'open'`; draft and
    // closed are covered above, but `paid` is a distinct enum value and the
    // spec calls out all three non-open states explicitly.
    const { error } = await anon.from("entries").insert({
      event_id: eventPaid,
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

  when()(
    "un select sin filtro devuelve eventos de OTROS creadores",
    async () => {
      // Not a leak to fix in SQL — `events_public_read` has to stay open so
      // `/e/<slug>` resolves without a session. This pins the consequence:
      // RLS does NOT scope a list of events, so any code that shows "your
      // events" must filter by `creator_id` itself. `listMyEvents` once did
      // not, and every visitor saw every creator's events with the owner
      // controls beside them. If this test ever goes red because the rows
      // stopped being visible, the client-side filter is no longer the thing
      // holding the line and `listMyEvents` should be revisited.
      const { data, error } = await creatorB.from("events").select("id");
      expect(error).toBeNull();
      expect(
        data!.map((row) => row.id),
        "creator B debería ver el evento de creator A: la política es pública a propósito"
      ).toContain(eventOpen);
    }
  );

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

  when()(
    "el trigger congela seed_commit, target_slot y entry_hashes de un draw ya escrito",
    async () => {
      // The whole verifiability claim of the product rests on this: if the
      // owning creator could rewrite the commitment after seeing the
      // entropy, the commit-reveal proof is worthless. `draws_owner_reveal`
      // alone would let this UPDATE through — it is the
      // `freeze_draw_commitments` trigger, not RLS, that has to reject it.
      const originalSeedCommit = "dd".repeat(32);
      const seeded = await admin
        .from("draws")
        .insert({
          entries_root: "ee".repeat(32),
          entry_hashes: ["ee".repeat(32)],
          event_id: eventClosed,
          amount_per_winner: "1000",
          seed_commit: originalSeedCommit,
          target_slot: 2200,
          winners_count: 1,
        })
        .select("id")
        .single();
      expect(
        seeded.error,
        `no se pudo sembrar la fixture: ${seeded.error?.message}`
      ).toBeNull();
      const drawId = seeded.data!.id as string;

      const { error } = await creatorA
        .from("draws")
        .update({
          seed_commit: "ff".repeat(32),
          target_slot: 9999,
          entry_hashes: ["ff".repeat(32)],
        })
        .eq("id", drawId);
      expect(error).not.toBeNull();

      // Confirm the rejected write did not partially land, via admin so the
      // check does not depend on the same (possibly broken) policy.
      const after = await admin
        .from("draws")
        .select("seed_commit")
        .eq("id", drawId)
        .single();
      expect(after.data?.seed_commit).toBe(originalSeedCommit);
    }
  );

  when()(
    "el creador dueño sí puede completar los campos de revelación de su draw",
    async () => {
      // The other half of the same claim: proving the trigger blocks
      // rewrites is worthless if it also blocks the legitimate reveal —
      // that would just mean the feature is broken, not that it is safe.
      const seeded = await admin
        .from("draws")
        .insert({
          entries_root: "11".repeat(32),
          entry_hashes: ["11".repeat(32)],
          event_id: eventClosed,
          amount_per_winner: "1000",
          seed_commit: "22".repeat(32),
          target_slot: 3300,
          winners_count: 1,
        })
        .select("id")
        .single();
      expect(
        seeded.error,
        `no se pudo sembrar la fixture: ${seeded.error?.message}`
      ).toBeNull();
      const drawId = seeded.data!.id as string;

      const { error } = await creatorA
        .from("draws")
        .update({
          revealed_seed: "33".repeat(32),
          chain_blockhash: "44".repeat(32),
          winner_entry_ids: [],
          status: "revealed",
        })
        .eq("id", drawId);
      expect(error).toBeNull();

      const after = await admin
        .from("draws")
        .select("revealed_seed, chain_blockhash, status")
        .eq("id", drawId)
        .single();
      expect(after.data?.revealed_seed).toBe("33".repeat(32));
      expect(after.data?.chain_blockhash).toBe("44".repeat(32));
      expect(after.data?.status).toBe("revealed");
    }
  );
});

describe("RLS · aislamiento entre creadores", () => {
  when()("un creador no puede leer entries de otro creador", async () => {
    // Same self-contained shape as the anon honeypot test above, but the
    // reader here is a real authenticated non-owner (creator B) — arguably
    // the more important case, since it's the same honeypot leak an anon
    // policy gap would cause, just reachable by anyone with any account.
    const wallet = "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1";
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

    // Same reasoning as the anon honeypot: a broad default GRANT makes the
    // table reachable to `authenticated`, so what blocks creator B is the
    // absence of a matching row in `entries_creator_read`'s policy — 0 rows
    // with a 200, not a 403. Accept either empty data or an error.
    const { data, error } = await creatorB
      .from("entries")
      .select("*")
      .eq("event_id", eventOpen);
    expect(
      error === null ? data : [],
      `admin ve ${seededCount} fila(s) para este evento; el otro creador debería ver 0`
    ).toEqual([]);
  });

  when()("un creador no puede leer draw_secrets de otro creador", async () => {
    const seededDraw = await admin
      .from("draws")
      .insert({
        entries_root: "cc".repeat(32),
        entry_hashes: ["cc".repeat(32)],
        event_id: eventClosed,
        amount_per_winner: "1000",
        seed_commit: "dd".repeat(32),
        target_slot: 4400,
        winners_count: 1,
      })
      .select("id")
      .single();
    expect(
      seededDraw.error,
      `no se pudo sembrar el draw: ${seededDraw.error?.message}`
    ).toBeNull();
    const drawId = seededDraw.data!.id as string;

    const seededSecret = await admin
      .from("draw_secrets")
      .insert({ draw_id: drawId, seed: "ab".repeat(32) });
    expect(
      seededSecret.error,
      `no se pudo sembrar draw_secrets: ${seededSecret.error?.message}`
    ).toBeNull();

    const asAdmin = await admin
      .from("draw_secrets")
      .select("draw_id")
      .eq("draw_id", drawId);
    expect(
      asAdmin.data?.length ?? 0,
      "la fixture no quedó visible ni para el cliente admin, el test no prueba nada"
    ).toBeGreaterThan(0);

    // This is the row a rival creator would want most: the raw seed
    // behind another creator's draw. `draw_secrets_owner` must keep it
    // at 0 rows, not a permission error — same 200-with-nothing shape as
    // every other honeypot case in this file.
    const { data, error } = await creatorB
      .from("draw_secrets")
      .select("*")
      .eq("draw_id", drawId);
    expect(
      error === null ? data : [],
      "el otro creador no debería ver el seed de este draw"
    ).toEqual([]);
  });
});
