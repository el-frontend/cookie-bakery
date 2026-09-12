-- Creator airdrop events: schema and row level security.
-- Table shapes copied verbatim (columns/types/constraints) from
-- docs/superpowers/specs/2026-09-10-creator-events-design.md §4.1, the
-- binding source of truth. Inline comments below are translated to English
-- per this repo's convention; the spec itself is written in Spanish.

create type event_status as enum ('draft', 'open', 'closed', 'paid');
create type draw_status  as enum ('committed', 'revealed', 'abandoned');

-- The creator's public name. auth.users is the account; this is what is shown.
create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  wallet_address text not null,
  display_name   text,
  created_at     timestamptz not null default now()
);

create table public.events (
  id            uuid primary key default gen_random_uuid(),
  creator_id    uuid not null references auth.users(id) on delete cascade,
  slug          text not null unique,
  title         text not null,
  mint          text not null,
  mint_decimals smallint not null,
  mint_symbol   text,
  status        event_status not null default 'draft',
  entry_count   integer not null default 0,
  opened_at     timestamptz,
  closed_at     timestamptz,
  created_at    timestamptz not null default now()
);

create table public.entries (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.events(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete set null,
  wallet_address  text not null,
  social_provider text,
  social_handle   text,
  created_at      timestamptz not null default now(),
  unique (event_id, wallet_address)
);

-- One social account = one entry. Partial index because user_id is null in this slice.
create unique index entries_event_user_uniq
  on public.entries (event_id, user_id) where user_id is not null;

-- Per supabase-postgres-best-practices (security-rls-performance): always
-- index columns compared directly in a `using`/`with check` clause.
-- `creator_id` is filtered directly by `events_owner_all` below (the other
-- policies reach it only through `events.id`, already the primary key).
create index events_creator_id_idx on public.events (creator_id);

-- Append-only (see 4.3c). The INSERT policy requires the event to be
-- `closed`: over `open` entries could still arrive after the list is frozen
-- and the published `entries_root` would stop matching.
create table public.draws (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid not null references public.events(id) on delete cascade,
  winners_count     integer not null check (winners_count > 0),
  amount_per_winner numeric(39,0) not null check (amount_per_winner > 0),
  seed_commit       text not null,          -- SHA-256 hex of the seed
  target_slot       bigint not null,        -- future slot that will give entropy
  entry_hashes      text[] not null,        -- published commitments, canonical order
  entries_root      text not null,          -- SHA-256 of the concatenated list
  chain_blockhash   text,                   -- filled in on reveal
  revealed_seed     text,                   -- hex, filled in on reveal
  winner_entry_ids  uuid[],
  status            draw_status not null default 'committed',
  commit_signature  text,                   -- commit tx memo
  commit_slot       bigint,                 -- slot that tx landed in
  reveal_signature  text,                   -- reveal tx memo
  created_at        timestamptz not null default now()
);

-- The seed, readable ONLY by the owning creator. Kept separate so `draws`
-- can be publicly readable without leaking it.
create table public.draw_secrets (
  draw_id uuid primary key references public.draws(id) on delete cascade,
  seed    text not null
);

-- Mirror of the on-chain truth. If it disagrees with the chain, the chain wins.
create table public.payouts (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  draw_id    uuid references public.draws(id) on delete set null,
  entry_id   uuid not null references public.entries(id) on delete cascade,
  amount     numeric(39,0) not null check (amount > 0),
  signature  text,
  status     text not null default 'pending',
  created_at timestamptz not null default now()
);

-- Every table is locked by default; each policy below opens exactly one door.
alter table public.profiles     enable row level security;
alter table public.events       enable row level security;
alter table public.entries      enable row level security;
alter table public.draws        enable row level security;
alter table public.draw_secrets enable row level security;
alter table public.payouts      enable row level security;

-- Data API grants ------------------------------------------------------
-- WHY (1): RLS decides which ROWS are visible; it does not make a table
-- reachable through the Data API at all. Without these grants PostgREST
-- answers "permission denied" no matter how correct the policies are, and
-- the RLS suite in step 2 fails for a reason that looks like RLS but is not.
grant select                         on public.events       to anon, authenticated;
grant insert, update, delete         on public.events       to authenticated;
grant insert                         on public.entries      to anon, authenticated;
grant select, delete                 on public.entries      to authenticated;
grant select                         on public.draws        to anon, authenticated;
grant insert, update                 on public.draws        to authenticated;
grant select, insert                 on public.draw_secrets to authenticated;
grant select, insert, update, delete on public.payouts      to authenticated;
grant select                         on public.profiles     to anon, authenticated;
grant insert, update, delete         on public.profiles     to authenticated;

-- events ---------------------------------------------------------------
-- WHY (2): every policy names its role with TO. A policy without one applies
-- to PUBLIC, and `auth.role() = 'authenticated'` — the old way of narrowing
-- it — is deprecated AND breaks silently once anonymous sign-ins exist,
-- because an anonymous user also carries the `authenticated` Postgres role.
-- `(select auth.uid())` rather than bare `auth.uid()` so Postgres evaluates
-- it once per statement instead of once per row.
create policy events_public_read on public.events
  for select to anon, authenticated using (status <> 'draft');

create policy events_owner_all on public.events
  for all to authenticated
  using (creator_id = (select auth.uid()))
  with check (creator_id = (select auth.uid()));

-- entries --------------------------------------------------------------
-- The public page inserts without asking for the row back, so no SELECT
-- policy is needed for anon and none is granted. Enumerating a creator's
-- audience is the one thing this schema must make impossible.
create policy entries_public_insert on public.entries
  for insert to anon, authenticated
  with check (
    exists (
      select 1 from public.events e
      where e.id = event_id and e.status = 'open'
    )
  );

create policy entries_own_read on public.entries
  for select to authenticated
  using (user_id is not null and user_id = (select auth.uid()));

create policy entries_creator_read on public.entries
  for select to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = event_id and e.creator_id = (select auth.uid())
    )
  );

create policy entries_creator_delete on public.entries
  for delete to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = event_id and e.creator_id = (select auth.uid())
    )
  );

-- draws ----------------------------------------------------------------
-- Public read: verification is the whole point. No DELETE policy exists, so
-- an abandoned draw stays visible and re-rolling cannot be hidden.
create policy draws_public_read on public.draws
  for select to anon, authenticated using (true);

create policy draws_owner_insert on public.draws
  for insert to authenticated
  with check (
    exists (
      select 1 from public.events e
      where e.id = event_id
        and e.creator_id = (select auth.uid())
        and e.status = 'closed'
    )
  );

-- Only the reveal fields may be filled in. If the commit, the target slot or
-- the frozen list could be rewritten afterwards, the entire verification
-- collapses.
--
-- WHY (3): an UPDATE policy needs BOTH `using` and `with check`. With only
-- `using`, a creator can rewrite a draw's `event_id` to point at somebody
-- else's event — the row passes the read test on the way in and nothing
-- tests it on the way out. (`draws_public_read` also has to exist for these
-- updates to work at all: an UPDATE must SELECT the row first, and without a
-- readable row it returns 0 rows changed with no error.)
create policy draws_owner_reveal on public.draws
  for update to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = event_id and e.creator_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.events e
      where e.id = event_id and e.creator_id = (select auth.uid())
    )
  );

create or replace function public.freeze_draw_commitments()
returns trigger language plpgsql as $$
begin
  if new.seed_commit  is distinct from old.seed_commit
  or new.target_slot  is distinct from old.target_slot
  or new.entries_root is distinct from old.entries_root
  or new.entry_hashes is distinct from old.entry_hashes
  or new.event_id     is distinct from old.event_id
  or new.winners_count is distinct from old.winners_count
  or new.amount_per_winner is distinct from old.amount_per_winner then
    raise exception 'A draw commitment is immutable once written.';
  end if;
  return new;
end $$;

create trigger draws_commitments_immutable
  before update on public.draws
  for each row execute function public.freeze_draw_commitments();

-- draw_secrets ---------------------------------------------------------
create policy draw_secrets_owner on public.draw_secrets
  for all to authenticated
  using (
    exists (
      select 1 from public.draws d
      join public.events e on e.id = d.event_id
      where d.id = draw_id and e.creator_id = (select auth.uid())
    )
  ) with check (
    exists (
      select 1 from public.draws d
      join public.events e on e.id = d.event_id
      where d.id = draw_id and e.creator_id = (select auth.uid())
    )
  );

-- payouts --------------------------------------------------------------
create policy payouts_owner on public.payouts
  for all to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = event_id and e.creator_id = (select auth.uid())
    )
  ) with check (
    exists (
      select 1 from public.events e
      where e.id = event_id and e.creator_id = (select auth.uid())
    )
  );

-- profiles -------------------------------------------------------------
create policy profiles_public_read on public.profiles
  for select to anon, authenticated using (true);

create policy profiles_owner_write on public.profiles
  for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- entry_count ----------------------------------------------------------
-- anon cannot SELECT entries, so it cannot COUNT them either. The public
-- "312 registered" number has to be maintained here instead.
--
-- WHY (4): SECURITY DEFINER is REQUIRED here — anon has no UPDATE grant or
-- policy on `events`, so an invoker-rights trigger could not maintain the
-- counter. It is also the reason for the revoke below: Postgres grants
-- EXECUTE to PUBLIC on every new function, which would make a definer-rights
-- function in an exposed schema a public endpoint. This one returns `trigger`
-- so it cannot be called directly anyway, but belt and braces. The counter
-- test in step 2 ("entry_count lo mantiene el trigger") fires through anon,
-- so it is what proves the revoke did not stop the trigger.
--
-- `set search_path = ''` on both functions below: with an empty search path
-- every reference must be schema-qualified (hence `public.events`), which is
-- the hardening the Supabase advisors ask for — an unqualified name in a
-- definer-rights function can otherwise be hijacked by a caller-controlled
-- search path.
create or replace function public.bump_entry_count()
returns trigger language plpgsql security definer
set search_path = '' as $$
begin
  update public.events
     set entry_count = entry_count + 1
   where id = new.event_id;
  return new;
end $$;

-- `revoke ... from public` alone is not enough: Supabase's default privileges
-- for the exposed API schema grant EXECUTE directly to anon/authenticated at
-- function-creation time (github.com/supabase/supabase#43884), and revoking
-- from the PUBLIC pseudo-role does not undo a grant already made to a named
-- role. Revoking from anon/authenticated explicitly is what actually removes
-- it. (Harmless either way here — see the WHY note above — but the comment
-- there claims this revoke is the belt; this is what makes it a real one.)
revoke execute on function public.bump_entry_count() from public, anon, authenticated;

create trigger entries_bump_count
  after insert on public.entries
  for each row execute function public.bump_entry_count();

-- Helper the RLS suite calls to assert the closed-event precondition.
-- SECURITY INVOKER (the default) on purpose: it must see only what its caller
-- can see. Execute is revoked from PUBLIC and granted narrowly.
create or replace function public.assert_draw_event_closed(p_event_id uuid)
returns void language plpgsql
set search_path = '' as $$
begin
  if not exists (
    select 1 from public.events where id = p_event_id and status = 'closed'
  ) then
    raise exception 'A draw needs the event to be closed.';
  end if;
end $$;

-- Same reasoning as bump_entry_count() above: revoke from the actual named
-- roles, not just PUBLIC, or the API schema's default privileges leave anon
-- able to call this directly (github.com/supabase/supabase#43884). service_role
-- keeps EXECUTE via that same default, which is fine — it is a trusted role,
-- and it is how the RLS suite's `admin.rpc(...)` call reaches this function.
revoke execute on function public.assert_draw_event_closed(uuid) from public, anon;
grant  execute on function public.assert_draw_event_closed(uuid) to authenticated;
