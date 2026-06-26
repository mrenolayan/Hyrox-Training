-- ════════════════════════════════════════════════════════════════════════════
--  0003_rls.sql — Row Level Security
--
--  !! REVIEW WITH COACH BEFORE RUNNING !!
--  !! coaches.user_id MUST be set before running — see deployment order below !!
--
--  What this does:
--    1. Enables RLS on all 15 tables.
--    2. Adds 4 security-definer helper functions (bypass RLS to avoid recursion).
--    3. Coach policies — full access to own data via auth.uid() → coaches.user_id.
--    4. Athlete policies — read own + teammates; write own logs/notes only.
--       Written now but INACTIVE until Phase 6 wires athlete logins.
--
--  Deployment order (do NOT skip steps):
--    1. Deploy Phase 4 app code and sign in via magic link.
--    2. App auto-calls linkCoachAuthId → coaches.user_id gets set.
--    3. Verify in Supabase SQL editor:
--         SELECT name, email, user_id FROM coaches;
--         -- user_id must be non-null before continuing
--    4. Run this migration.
--    5. Reload the app — coach dashboard must load without errors.
-- ════════════════════════════════════════════════════════════════════════════

-- ── helper functions (security definer = bypass RLS, prevents recursion) ──

-- The coaches.id matching the current auth user (NULL if user is not a coach).
create or replace function coach_id_of_caller()
returns uuid language sql stable security definer as $$
  select id from coaches where user_id = auth.uid()
$$;

-- The athletes.id matching the current auth user (NULL if user is not an athlete).
create or replace function athlete_id_of_caller()
returns uuid language sql stable security definer as $$
  select id from athletes where user_id = auth.uid()
$$;

-- All team IDs where the calling athlete is an active member.
-- Security definer avoids recursive RLS evaluation on team_members.
create or replace function my_team_ids()
returns setof uuid language sql stable security definer as $$
  select team_id from team_members
  where athlete_id = athlete_id_of_caller() and left_at is null
$$;

-- True if the calling athlete is on the same active team as p_athlete_id.
create or replace function is_teammate(p_athlete_id uuid)
returns boolean language sql stable security definer as $$
  select exists(
    select 1
    from   team_members tm_theirs
    join   team_members tm_mine
             on  tm_theirs.team_id = tm_mine.team_id
    where  tm_theirs.athlete_id = p_athlete_id
      and  tm_mine.athlete_id   = athlete_id_of_caller()
      and  tm_theirs.left_at    is null
      and  tm_mine.left_at      is null
  )
$$;

-- ── coaches ───────────────────────────────────────────────────────────────
alter table coaches enable row level security;

create policy "coach: read own row"
  on coaches for select
  using (user_id = auth.uid());

create policy "coach: update own row"
  on coaches for update
  using (user_id = auth.uid());

-- ── teams ─────────────────────────────────────────────────────────────────
alter table teams enable row level security;

create policy "coach: all on own teams"
  on teams for all
  using (coach_id = coach_id_of_caller());

-- Phase 6
create policy "athlete: read own teams"
  on teams for select
  using (id in (select my_team_ids()));

-- ── athletes ──────────────────────────────────────────────────────────────
alter table athletes enable row level security;

create policy "coach: all on own athletes"
  on athletes for all
  using (coach_id = coach_id_of_caller());

-- Phase 6
create policy "athlete: read self and teammates"
  on athletes for select
  using (id = athlete_id_of_caller() or is_teammate(id));

-- ── athlete_profiles ──────────────────────────────────────────────────────
alter table athlete_profiles enable row level security;

create policy "coach: all on own athlete profiles"
  on athlete_profiles for all
  using (athlete_id in (
    select id from athletes where coach_id = coach_id_of_caller()
  ));

-- Phase 6
create policy "athlete: read own profile"
  on athlete_profiles for select
  using (athlete_id = athlete_id_of_caller());

-- ── station_ratings ───────────────────────────────────────────────────────
alter table station_ratings enable row level security;

create policy "coach: all on own station ratings"
  on station_ratings for all
  using (athlete_id in (
    select id from athletes where coach_id = coach_id_of_caller()
  ));

-- Phase 6
create policy "athlete: read own station ratings"
  on station_ratings for select
  using (athlete_id = athlete_id_of_caller());

-- ── athlete_modalities ────────────────────────────────────────────────────
alter table athlete_modalities enable row level security;

create policy "coach: all on own modalities"
  on athlete_modalities for all
  using (athlete_id in (
    select id from athletes where coach_id = coach_id_of_caller()
  ));

-- Phase 6
create policy "athlete: read own modalities"
  on athlete_modalities for select
  using (athlete_id = athlete_id_of_caller());

-- ── team_members ──────────────────────────────────────────────────────────
alter table team_members enable row level security;

create policy "coach: all on own team members"
  on team_members for all
  using (team_id in (
    select id from teams where coach_id = coach_id_of_caller()
  ));

-- Phase 6 — uses my_team_ids() to avoid recursive RLS on team_members
create policy "athlete: read memberships of own teams"
  on team_members for select
  using (team_id in (select my_team_ids()));

-- ── plans ─────────────────────────────────────────────────────────────────
alter table plans enable row level security;

create policy "coach: all on own plans"
  on plans for all
  using (team_id in (
    select id from teams where coach_id = coach_id_of_caller()
  ));

-- Phase 6
create policy "athlete: read plans for own teams"
  on plans for select
  using (team_id in (select my_team_ids()));

-- ── plan_weeks ────────────────────────────────────────────────────────────
alter table plan_weeks enable row level security;

create policy "coach: all on own plan weeks"
  on plan_weeks for all
  using (plan_id in (
    select p.id from plans p
    join   teams t on p.team_id = t.id
    where  t.coach_id = coach_id_of_caller()
  ));

-- Phase 6
create policy "athlete: read plan weeks for own plans"
  on plan_weeks for select
  using (plan_id in (
    select p.id from plans p where p.team_id in (select my_team_ids())
  ));

-- ── plan_days ─────────────────────────────────────────────────────────────
alter table plan_days enable row level security;

create policy "coach: all on own plan days"
  on plan_days for all
  using (plan_week_id in (
    select pw.id from plan_weeks pw
    join   plans p  on pw.plan_id  = p.id
    join   teams t  on p.team_id   = t.id
    where  t.coach_id = coach_id_of_caller()
  ));

-- Phase 6
create policy "athlete: read plan days for own plans"
  on plan_days for select
  using (plan_week_id in (
    select pw.id from plan_weeks pw
    join   plans p on pw.plan_id = p.id
    where  p.team_id in (select my_team_ids())
  ));

-- ── plan_entries ──────────────────────────────────────────────────────────
alter table plan_entries enable row level security;

create policy "coach: all on own plan entries"
  on plan_entries for all
  using (plan_day_id in (
    select pd.id from plan_days pd
    join   plan_weeks pw on pd.plan_week_id = pw.id
    join   plans p       on pw.plan_id      = p.id
    join   teams t       on p.team_id       = t.id
    where  t.coach_id = coach_id_of_caller()
  ));

-- Phase 6
create policy "athlete: read own and teammate plan entries"
  on plan_entries for select
  using (athlete_id = athlete_id_of_caller() or is_teammate(athlete_id));

-- ── logs ──────────────────────────────────────────────────────────────────
alter table logs enable row level security;

create policy "coach: all on own athletes logs"
  on logs for all
  using (athlete_id in (
    select id from athletes where coach_id = coach_id_of_caller()
  ));

-- Phase 6
create policy "athlete: read own and teammate logs"
  on logs for select
  using (athlete_id = athlete_id_of_caller() or is_teammate(athlete_id));

create policy "athlete: insert own logs"
  on logs for insert
  with check (athlete_id = athlete_id_of_caller());

create policy "athlete: update own logs"
  on logs for update
  using (athlete_id = athlete_id_of_caller());

-- ── coach_notes ───────────────────────────────────────────────────────────
alter table coach_notes enable row level security;

create policy "coach: all on own coach notes"
  on coach_notes for all
  using (plan_week_id in (
    select pw.id from plan_weeks pw
    join   plans p on pw.plan_id = p.id
    join   teams t on p.team_id  = t.id
    where  t.coach_id = coach_id_of_caller()
  ));

-- Phase 6
create policy "athlete: read coach notes for own plan weeks"
  on coach_notes for select
  using (plan_week_id in (
    select pw.id from plan_weeks pw
    join   plans p on pw.plan_id = p.id
    where  p.team_id in (select my_team_ids())
  ));

-- ── team_notes ────────────────────────────────────────────────────────────
alter table team_notes enable row level security;

create policy "coach: all on own team notes"
  on team_notes for all
  using (log_id in (
    select l.id from logs l
    join   athletes a on l.athlete_id = a.id
    where  a.coach_id = coach_id_of_caller()
  ));

-- Phase 6
create policy "athlete: read team notes on own and teammate logs"
  on team_notes for select
  using (log_id in (
    select id from logs
    where  athlete_id = athlete_id_of_caller() or is_teammate(athlete_id)
  ));

create policy "athlete: insert own team notes"
  on team_notes for insert
  with check (author_athlete_id = athlete_id_of_caller());

-- ── race_results ──────────────────────────────────────────────────────────
alter table race_results enable row level security;

create policy "coach: all on own athletes race results"
  on race_results for all
  using (athlete_id in (
    select id from athletes where coach_id = coach_id_of_caller()
  ));

-- Phase 6
create policy "athlete: read own race results"
  on race_results for select
  using (athlete_id = athlete_id_of_caller());

create policy "athlete: insert own race results"
  on race_results for insert
  with check (athlete_id = athlete_id_of_caller());
