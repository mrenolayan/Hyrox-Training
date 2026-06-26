-- ════════════════════════════════════════════════════════════════════════════
-- Hyrox Trainer — 0001_schema.sql
-- Normalized schema (Plan A: plans are owned by TEAMS; solo = team of one).
-- See DATA_MODEL.md for the prose version. Review before running.
--
-- RLS is NOT enabled here — it ships in 0002_rls.sql and goes live in Phase 4.
-- During local/dev build the dev project's anon key reads/writes freely.
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;  -- for gen_random_uuid()

-- ── coaches ────────────────────────────────────────────────────────────────
create table coaches (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users (id) on delete set null,  -- null until auth (Phase 4)
  name        text not null,
  email       text,
  created_at  timestamptz not null default now()
);

-- ── teams ──────────────────────────────────────────────────────────────────
-- Owns the plan. A solo athlete is a team of one. Holds team-wide config.
create table teams (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references coaches (id) on delete cascade,
  name        text not null,
  format_id   text not null check (format_id in (
                'mens_solo','mens_solo_pro','womens_solo','womens_solo_pro',
                'doubles_men','doubles_women','mixed_doubles',
                'relay_men','relay_women','relay_mixed')),
  units       text not null default 'metric' check (units in ('metric','us')),
  created_at  timestamptz not null default now()
);
create index idx_teams_coach on teams (coach_id);

-- ── athletes ───────────────────────────────────────────────────────────────
-- Only fields that differ per athlete; team/plan-level config lives elsewhere.
create table athletes (
  id           uuid primary key default gen_random_uuid(),
  coach_id     uuid not null references coaches (id) on delete cascade,
  user_id      uuid references auth.users (id) on delete set null,  -- null until athlete logs in
  name         text not null,
  color        text,                 -- UI color; auto-assigned if null
  role         text,                 -- e.g. "Power lead · heavy stations"
  run_pace     text,                 -- comfortable pace, e.g. "6:20/km"
  longest_run  numeric,              -- stored in km
  created_at   timestamptz not null default now()
);
create index idx_athletes_coach on athletes (coach_id);
create index idx_athletes_user  on athletes (user_id);

-- ── athlete_profiles (1:1) ──────────────────────────────────────────────────
create table athlete_profiles (
  id                uuid primary key default gen_random_uuid(),
  athlete_id        uuid not null unique references athletes (id) on delete cascade,
  known_weights     text,            -- "Known working weights / PRs"
  team_split_notes  text,
  injuries_notes    text,            -- injuries / limits / schedule constraints
  meta              jsonb not null default '{}'::jsonb
);
create index idx_profiles_athlete on athlete_profiles (athlete_id);

-- ── station_ratings (9 per athlete; "all 9" enforced in app) ─────────────────
create table station_ratings (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid not null references athletes (id) on delete cascade,
  station     text not null check (station in (
                'ski_erg','sled_push','sled_pull','burpee_broad_jumps','row',
                'farmers_carry','sandbag_lunges','wall_balls','running')),
  rating      text not null check (rating in ('strength','okay','weak')),
  unique (athlete_id, station)
);
create index idx_ratings_athlete on station_ratings (athlete_id);

-- ── athlete_modalities (training background, multi-select) ───────────────────
create table athlete_modalities (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid not null references athletes (id) on delete cascade,
  modality    text not null check (modality in (
                'crossfit','lifting','hiit','running_club','yoga_pilates','other')),
  unique (athlete_id, modality)
);
create index idx_modalities_athlete on athlete_modalities (athlete_id);

-- ── team_members (many-to-many; athletes can move teams over time) ───────────
create table team_members (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references teams (id) on delete cascade,
  athlete_id  uuid not null references athletes (id) on delete cascade,
  joined_at   timestamptz not null default now(),
  left_at     timestamptz,           -- null = current member
  unique (team_id, athlete_id, joined_at)
);
create index idx_team_members_team    on team_members (team_id);
create index idx_team_members_athlete on team_members (athlete_id);

-- ── plans (owned by team) ────────────────────────────────────────────────────
create table plans (
  id             uuid primary key default gen_random_uuid(),
  team_id        uuid not null references teams (id) on delete cascade,
  weeks          int  not null check (weeks in (8,12,16,20)),  -- source of truth for length
  days_per_week  int  not null check (days_per_week between 2 and 6),
  start_iso      date not null,
  race_name      text not null,
  race_city      text,
  race_iso       timestamptz not null,    -- drives countdown + week labels
  status         text not null default 'draft' check (status in ('draft','active','archived')),
  generated_at   timestamptz,
  created_at     timestamptz not null default now()
);
create index idx_plans_team on plans (team_id);

-- ── plan_weeks ───────────────────────────────────────────────────────────────
create table plan_weeks (
  id           uuid primary key default gen_random_uuid(),
  plan_id      uuid not null references plans (id) on delete cascade,
  week_number  int  not null,
  phase        int  not null,           -- 1=Base, 2=Build, 3=Peak+Taper
  focus        text,
  unique (plan_id, week_number)
);
create index idx_plan_weeks_plan on plan_weeks (plan_id);

-- ── plan_days ────────────────────────────────────────────────────────────────
create table plan_days (
  id            uuid primary key default gen_random_uuid(),
  plan_week_id  uuid not null references plan_weeks (id) on delete cascade,
  day_of_week   text not null check (day_of_week in ('Mon','Tue','Wed','Thu','Fri','Sat','Sun')),
  shared        boolean not null default false,   -- session done together
  optional      boolean not null default false,
  unique (plan_week_id, day_of_week)
);
create index idx_plan_days_week on plan_days (plan_week_id);

-- ── plan_entries (one row per athlete per day; a0..a3 keying normalized) ──────
create table plan_entries (
  id            uuid primary key default gen_random_uuid(),
  plan_day_id   uuid not null references plan_days (id) on delete cascade,
  athlete_id    uuid not null references athletes (id) on delete cascade,
  session_type  text not null check (session_type in (
                  'run_easy','run_pace','run_long','strength','sled','brick',
                  'stations','together','race_sim','conditioning','rest')),
  label         text not null,
  detail        text,
  metric_label  text,                  -- what to log; null = nothing to log
  meta          jsonb not null default '{}'::jsonb,  -- wall-ball targets, sled wts, HRV notes…
  unique (plan_day_id, athlete_id)
);
create index idx_plan_entries_day     on plan_entries (plan_day_id);
create index idx_plan_entries_athlete on plan_entries (athlete_id);

-- ── logs (what an athlete actually did; one row per (athlete, entry), upsert) ─
create table logs (
  id             uuid primary key default gen_random_uuid(),
  athlete_id     uuid not null references athletes (id) on delete cascade,
  plan_id        uuid not null references plans (id) on delete cascade,  -- denorm for fast queries
  plan_entry_id  uuid not null references plan_entries (id) on delete cascade,
  done           boolean not null default false,
  metric         text,                 -- "6:18", "152kg" … parsed by lib/pace.js
  notes          text,
  logged_date    date,
  created_at     timestamptz not null default now(),
  unique (athlete_id, plan_entry_id)
);
create index idx_logs_athlete on logs (athlete_id);
create index idx_logs_plan    on logs (plan_id);
create index idx_logs_entry   on logs (plan_entry_id);

-- ── coach_notes (per week; shared across the team automatically) ──────────────
create table coach_notes (
  id            uuid primary key default gen_random_uuid(),
  plan_week_id  uuid not null unique references plan_weeks (id) on delete cascade,
  body          text,
  updated_at    timestamptz not null default now()
);
create index idx_coach_notes_week on coach_notes (plan_week_id);

-- ── team_notes (teammates react to each other's logs) ─────────────────────────
create table team_notes (
  id                 uuid primary key default gen_random_uuid(),
  log_id             uuid not null references logs (id) on delete cascade,
  author_athlete_id  uuid not null references athletes (id) on delete cascade,
  body               text,
  reaction           text,
  created_at         timestamptz not null default now()
);
create index idx_team_notes_log    on team_notes (log_id);
create index idx_team_notes_author on team_notes (author_athlete_id);

-- ── race_results (post-race splits for analysis) ──────────────────────────────
create table race_results (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid not null references athletes (id) on delete cascade,
  race_name   text,
  race_date   date,
  total_time  interval,
  splits      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index idx_race_results_athlete on race_results (athlete_id);
