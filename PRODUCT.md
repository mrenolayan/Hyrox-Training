# PRODUCT.md — Hyrox Trainer

> **Status:** DRAFT for coach review. This is a build contract, not final.
> Anything marked **[DECISION NEEDED]** is an open question for Reno.

## What this is

A single deployed web app where a **coach** builds and manages Hyrox training
plans for many **athletes**, and athletes follow their plan, log workouts, and
see their teammates' logs. Today this exists as separate per-client copies of
the code, each deployed to its own Vercel URL. We are collapsing that into **one
app + one Supabase database**, where every athlete is a row, not a code fork.

The headline consequence: **a UI change ships to everyone in one deploy.** No
more copying an 840-line file per client.

## Who uses it (roles)

| Role | Can do |
|---|---|
| **Coach** (Reno) | Create athletes, fill intake, generate & hand-edit plans, write coach notes, read everything for their athletes. |
| **Athlete** | Read own plan, log own workouts, write own notes. Read teammates' logs (same team) and react/note on them. **Cannot** edit a teammate's logs or anyone's plan. |

These permissions are enforced in the **database (Supabase RLS)**, not in UI
code. The UI may hide buttons for nicety, but the security boundary is the DB.

## Core product decisions (locked)

- **One app, shared UI, per-athlete data as rows.** Not per-client deploys.
- **Default pace units = metric (/km).** (Note: the current template defaults to
  `us` — we are flipping the default to metric.)
- **Plan lengths: 8 / 12 / 16 / 20 weeks.** There is **no hand-authored content
  beyond 12 weeks** (the Walker and Hung files are both 12-week plans). So the
  generator builds **any length procedurally from rules**: session templates +
  phase rhythm (extracted from the 12-week plans as data) → scale base/build
  blocks, deload every ~4th week, 3-week peak+taper. Reno tunes the output.
- **Hybrid plan generation:** generate a draft from the intake, then the coach
  hand-tweaks. Regenerating must **not** clobber manual edits (diff + upsert).

## The intake questionnaire (the shared field schema)

This is the most important shared artifact. The same field definitions are used
in **two** places, so they must be defined **once**:

1. The **coach's "create athlete" form** (built first).
2. The future **athlete self-serve intake form** (built later, Phase 6).

Build the coach-create form so its fields can be lifted directly into the
athlete-facing form. One schema, two surfaces.

### Fields (these define `athlete_profiles` + related tables)

| # | Field | Type | Writes to | Validation |
|---|---|---|---|---|
| 1 | Name(s) / team name | text | `teams.name` + one `athletes.name` per member | required |
| 2 | Race format | enum (FORMATS key) | `teams.format_id` | must be a known FORMATS key; sets member count (1/2/4) |
| 3 | Target race + date | **race picker (specific race required)** | `plans.race_name`, `race_city`, `race_iso` | a concrete race+date is required — **no rough timeframe** |
| 4 | Plan length | enum 8/12/16/20 | `plans.weeks` | must be one of the 4 |
| 5 | Training days/week | int 2–6 | `plans.days_per_week` | 2 ≤ n ≤ 6 |
| 6 | Comfortable running pace | text (mm:ss /km or /mi) | `athletes.run_pace` (per member) | pace-format hint shown |
| 7 | Longest run currently | number + unit | `athletes.longest_run` (per member) | ≥ 0 |
| 8 | Training background | multi-select | `athlete_modalities` (per member) | 0+ from the list below |
| 9 | Known weights / PRs | free text | `athlete_profiles.known_weights` (per member) | optional |
| 10 | Station strengths/weaknesses | 9× rating **per member** | `station_ratings` | **all 9 required for each athlete** |
| 11 | Team split notes | free text | `athlete_profiles.team_split_notes` | optional |
| 12 | Injuries / limits / schedule | free text | `athlete_profiles.injuries_notes` (per member) | optional |
| — | Units | metric / us | `teams.units` | default **metric** |

**Training background options (multi-select):** CrossFit, Lifting/Powerlifting,
HIIT, Running Club, Yoga/Pilates, Other.

**The 9 stations (each rated `strength` / `okay` / `weak`):**
Ski Erg, Sled Push, Sled Pull, Burpee Broad Jumps, Row, Farmers Carry,
Sandbag Lunges, Wall Balls, Running.

> Validation happens **at entry** so the generator always receives clean,
> structured input: pace format hint, all 9 station ratings required, plan length
> constrained to the 4 allowed values.

> **One submission fans out to many rows.** A team intake is not a single insert.
> Example — a Mixed Doubles submission creates: **1 `team`** (name, format, units),
> **1 `plan`** (race, weeks, days/week, start), **2 `athletes`** + **2
> `athlete_profiles`**, **2 `team_members`**, **18 `station_ratings`** (9 per
> athlete), and the selected `athlete_modalities`. Fields 6–12 are collected
> **per member**; fields 1–5 + units are collected **once for the team**. The
> intake form must loop per athlete for the per-member fields.

## Race formats (from existing `FORMATS`)

`mens_solo`, `mens_solo_pro`, `womens_solo`, `womens_solo_pro`, `doubles_men`,
`doubles_women`, `mixed_doubles`, `relay_men`, `relay_women`, `relay_mixed`.
Each has `{ label, athletes (1/2/4), team (bool) }`.

## UI to preserve (the coach likes these)

From the existing apps — keep the look and these features:

- **Tabbed layout:** Week view, Overview (phases), Race Strategy, Progress.
- **Theme toggle:** auto / light / dark (auto = light 7am–7pm).
- **Race countdown** (days/hours/min/sec) toggled from the header.
- **Athlete toggle** in the header (switch which athlete you're viewing).
- **Pace pin** (📌) showing the athlete's race-pace reminder.
- **Per-workout inline edit** (coach edits a single session in place).
- **Settings:** plan start date options, units toggle, theme.
- **Coach notes per week** (shared, visible to athletes).

### New UI (this rebuild)

- **Coach dashboard / home:** list of all the coach's athletes, switch between
  them, see at-a-glance progress. Loads athlete *summaries* first; full plans
  load lazily when you open one. Paginated.
- **In-app intake form** (Phase 6) reusing the coach-create field schema.
- **Login** (Supabase magic link, Phase 4).
- **Team notes / reactions** on teammates' logs.

## User stories

- *As a coach,* I create an athlete by filling the intake, click Generate, and
  get a draft plan biased toward their weak stations, which I then tweak.
- *As a coach,* I regenerate a plan after changing the intake and my manual
  tweaks survive.
- *As an athlete,* I log in via a magic link, see this week, mark sessions done,
  record my metric + notes, and see how my teammate is tracking.
- *As an athlete,* I leave an encouraging note on my teammate's logged session.

## Out of scope (for now)

Payments/billing, native mobile apps, push notifications, in-app messaging
beyond team notes, multi-coach orgs (one coach for now; schema shouldn't make
multi-coach impossible later).

## Build order (see ARCHITECTURE.md for detail)

0. **Docs** (this file + ARCHITECTURE.md + DATA_MODEL.md) — review contract.
1. Supabase schema + RLS, seeded with Walker DC + Hung Anaheim. **Approve schema before it touches the live DB.**
2. Data-access layer (`lib/db.js`).
3. Business logic + hybrid generator (`lib/*.js`).
4. Supabase Auth (magic link); RLS live; roles.
5. Migrate existing `kv_store` logs into normalized tables.
6. UI polish: metric default, coach dashboard, in-app intake, invite flow.
