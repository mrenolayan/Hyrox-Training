-- ════════════════════════════════════════════════════════════════════════════
--  0004_phase8_auth.sql — Phase 8: athlete login & invite
--
--  !! REVIEW WITH RENO BEFORE RUNNING — never run without sign-off !!
--
--  Pre-flight check (SQL editor, must return a non-null user_id):
--      SELECT name, email, user_id FROM coaches;
--
--  What this does:
--    1. athlete_invites table — token-based, 30-day expiry, coach-only RLS.
--    2. accept_invite(token) — SECURITY DEFINER: validates token + expiry,
--       stamps auth.uid() onto athletes.user_id, sets accepted_at.
--    3. link_athlete_from_invite() — fallback: same claim, matched by the
--       signed-in email instead of the token (athlete lost the invite URL).
--    4. Drops ALL Phase 7 anon policies — no read or write without login.
--    5. Adds "athlete: update own plan entries" — Reno wants athletes to keep
--       self-editing their own sessions (Phase 7 behavior), same shape as the
--       existing "athlete: update own logs" policy in 0003.
--
--  Note on "activating" the athlete policies: 0003 already created every
--  athlete SELECT policy on the live DB (verified 2026-07-02). They were
--  dormant only because athletes.user_id was null everywhere. Removing the
--  anon paths and stamping user_id via invites IS the activation — no
--  read policies to re-create.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. athlete_invites ──────────────────────────────────────────────────────
create table athlete_invites (
  id           uuid primary key default gen_random_uuid(),
  athlete_id   uuid not null references athletes (id) on delete cascade,
  team_id      uuid not null references teams (id) on delete cascade,
  email        text not null,
  token        text not null unique,          -- unique constraint = index
  expires_at   timestamptz not null default now() + interval '30 days',
  accepted_at  timestamptz,                   -- null = pending
  created_at   timestamptz not null default now()
);
create index idx_invites_athlete on athlete_invites (athlete_id);
create index idx_invites_team    on athlete_invites (team_id);

alter table athlete_invites enable row level security;

-- Only the coach ever touches invites directly; athletes claim via the
-- SECURITY DEFINER functions below, never by reading this table.
create policy "coach: all on own athlete invites"
  on athlete_invites for all
  using (athlete_id in (
    select id from athletes where coach_id = coach_id_of_caller()
  ));

-- ── 2. accept_invite(token) ─────────────────────────────────────────────────
-- Runs as definer because the athlete has NO rows yet at accept time — RLS
-- would (correctly) block them from reading the invite or updating athletes.
create or replace function accept_invite(p_token text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_invite athlete_invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select * into v_invite
  from athlete_invites
  where token = p_token
  for update;                       -- lock: no double-accept race

  if not found then
    raise exception 'INVITE_NOT_FOUND';
  end if;

  if v_invite.accepted_at is not null then
    -- idempotent if the same person clicks the link twice
    if exists (select 1 from athletes
               where id = v_invite.athlete_id and user_id = auth.uid()) then
      return v_invite.athlete_id;
    end if;
    raise exception 'INVITE_ALREADY_USED';
  end if;

  if v_invite.expires_at < now() then
    raise exception 'INVITE_EXPIRED';
  end if;

  -- never let a token steal an athlete row someone else already claimed
  if exists (select 1 from athletes
             where id = v_invite.athlete_id
               and user_id is not null and user_id <> auth.uid()) then
    raise exception 'ATHLETE_ALREADY_CLAIMED';
  end if;

  update athletes        set user_id = auth.uid() where id = v_invite.athlete_id;
  update athlete_invites set accepted_at = now()  where id = v_invite.id;
  return v_invite.athlete_id;
end
$$;

revoke execute on function accept_invite(text) from public, anon;
grant  execute on function accept_invite(text) to authenticated;

-- ── 3. link_athlete_from_invite() — email-match fallback ────────────────────
-- If the athlete signs in with a plain magic link (no ?invite= token), match
-- their signed-in email against a pending, unexpired invite and claim that way.
create or replace function link_athlete_from_invite()
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_email  text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_invite athlete_invites%rowtype;
begin
  if auth.uid() is null or v_email = '' then
    return null;
  end if;

  -- already linked → nothing to do
  if exists (select 1 from athletes where user_id = auth.uid()) then
    return (select id from athletes where user_id = auth.uid() limit 1);
  end if;

  select * into v_invite
  from athlete_invites
  where lower(email) = v_email
    and accepted_at is null
    and expires_at > now()
  order by created_at desc
  limit 1
  for update;

  if not found then
    return null;
  end if;

  if exists (select 1 from athletes
             where id = v_invite.athlete_id and user_id is not null) then
    return null;
  end if;

  update athletes        set user_id = auth.uid() where id = v_invite.athlete_id;
  update athlete_invites set accepted_at = now()  where id = v_invite.id;
  return v_invite.athlete_id;
end
$$;

revoke execute on function link_athlete_from_invite() from public, anon;
grant  execute on function link_athlete_from_invite() to authenticated;

-- ── 4. Roll back Phase 7 anonymous access — ALL of it ───────────────────────
-- Names taken from the live DB's pg_policies on 2026-07-02, not from docs
-- (the Phase 7 migration file that created them is missing from the repo).

-- anon read (11 policies)
drop policy if exists "anon: read public teams"                      on teams;
drop policy if exists "anon: read athletes on public teams"          on athletes;
drop policy if exists "anon: read athlete profiles for public teams" on athlete_profiles;
drop policy if exists "anon: read station ratings for public teams"  on station_ratings;
drop policy if exists "anon: read memberships of public teams"       on team_members;
drop policy if exists "anon: read plans for public teams"            on plans;
drop policy if exists "anon: read plan weeks for public teams"       on plan_weeks;
drop policy if exists "anon: read plan days for public teams"        on plan_days;
drop policy if exists "anon: read plan entries for public teams"     on plan_entries;
drop policy if exists "anon: read coach notes for public teams"      on coach_notes;
drop policy if exists "anon: read logs for public teams"             on logs;

-- anon write (4 policies)
drop policy if exists "anon: insert logs for public teams"           on logs;
drop policy if exists "anon: update logs for public teams"           on logs;
drop policy if exists "anon: update plan entries for public teams"   on plan_entries;
drop policy if exists "anon: upsert plan entries for public teams"   on plan_entries;

-- ── 5. Athlete self-edit of own plan entries (kept from Phase 7, now auth'd) ─
-- Mirrors "athlete: update own logs" from 0003 — own rows only, no teammates.
create policy "athlete: update own plan entries"
  on plan_entries for update
  using (athlete_id = athlete_id_of_caller());
