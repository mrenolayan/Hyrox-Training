# DATA_MODEL.md — Hyrox Trainer

> **Status:** DRAFT for coach review. **No migration runs against the live
> Supabase project until this is approved.**
> `[DECISION NEEDED]` marks open questions for Reno.

This describes the **normalized** schema that replaces today's single `kv_store`
table of JSON blobs. Types are PostgreSQL / Supabase.

## Conventions

- Primary keys: `id uuid default gen_random_uuid()`.
- Timestamps: `created_at timestamptz default now()`, `updated_at` where edited.
- Every FK used for filtering gets an index (listed per table).
- `meta jsonb` columns hold irregular/optional data so we don't add a column for
  every one-off note. Documented per table.
- Enums are Postgres `text` + a `CHECK` constraint (simpler to evolve than native
  enums; can switch to native enums later if desired).

## Entity overview

**Plan ownership = the team (Plan A).** A plan belongs to a *team*, and a solo
athlete is simply a team of one. Each `plan_day` has one `plan_entry` **per
athlete** (modeled on the `a0/a1/a2/a3` keying in `HyroxHungAndrewAnaheim.jsx`
and `HyroxTrainingApp.jsx`). This is the single biggest structural decision.

```
coaches ──< teams ──< plans ──< plan_weeks ──< plan_days ──< plan_entries
   │          │  │                   │                          │ (one per
   │          │  └──< team_notes     └──< coach_notes           │  athlete)
   │          │                                                 │
   │          └──< team_members >── athletes ──1:1── athlete_profiles
   │                                   │  │
   └──< athletes (coach owns)          │  ├──< station_ratings    (9 per athlete)
                                       │  └──< athlete_modalities (background)
                                       │
logs >──────── athlete + plan_entry ───┘   (the session an athlete actually did)
race_results (per athlete, post-race splits)
```

> **Team-level vs athlete-level fields (Plan A consequence):** config that the
> whole team shares — `format_id`, `units`, the target race, `weeks`,
> `days_per_week`, `start_iso`, phases — lives on `teams`/`plans`, **not**
> duplicated per athlete. This deviates from the original spec's athlete-centric
> field list, on purpose, to avoid the desync Plan A exists to prevent. Per
> athlete we keep only what genuinely differs: `name`, `role`, `color`,
> `run_pace`, `longest_run`, plus the profile/ratings/modalities child rows.

---

## Tables

### `coaches`
The coach account. One for now; schema allows many.
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | FK → `auth.users.id`; null until auth (Phase 4) |
| name | text | |
| email | text | |
| created_at | timestamptz | |

### `athletes`
One row per athlete. **Only fields that differ per athlete** — team/plan-level
config lives on `teams`/`plans` (see overview note).
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| coach_id | uuid FK → coaches | **indexed**; direct ownership (athlete can change teams) |
| user_id | uuid | FK → `auth.users.id`; null until athlete logs in |
| name | text | required |
| color | text | UI color; auto-assigned from palette if null |
| role | text | e.g. "Power lead · heavy stations" (free text shown in UI) |
| run_pace | text | comfortable pace, e.g. "6:20/km" (differs per athlete) |
| longest_run | numeric | stored in km (convert on input); unit shown per team `units` |
| created_at | timestamptz | |

> `role` and `run_pace` come straight from the existing `CLIENT.athletes[]`
> shape — we're normalizing that block into rows. `format_id`, `units`,
> `race_*`, `weeks`, `days_per_week` are **gone from here** → moved to
> `teams`/`plans`.

### `athlete_profiles` (1:1 with athlete)
The free-text / catch-all intake fields.
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| athlete_id | uuid FK → athletes | **indexed**, unique |
| known_weights | text | "Known working weights / PRs" |
| team_split_notes | text | |
| injuries_notes | text | injuries / limits / schedule constraints |
| meta | jsonb | anything else captured later without a schema change |

> **DECIDED:** Named columns for the three known free-text fields (queryable,
> clear), `meta` jsonb for future extras.

### `station_ratings`
One row **per station per athlete** (the generator reads these to bias the plan).
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| athlete_id | uuid FK → athletes | **indexed** |
| station | text | CHECK in the 9 station keys |
| rating | text | CHECK in ('strength','okay','weak') |
| unique (athlete_id, station) | | exactly 9 rows enforced by app validation |

Station keys: `ski_erg`, `sled_push`, `sled_pull`, `burpee_broad_jumps`, `row`,
`farmers_carry`, `sandbag_lunges`, `wall_balls`, `running`.

### `athlete_modalities`
Training background multi-select. One row per selected modality.
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| athlete_id | uuid FK → athletes | **indexed** |
| modality | text | CHECK in ('crossfit','lifting','hiit','running_club','yoga_pilates','other') |

> **DECIDED (default):** Child table (above) for consistency with
> `station_ratings` and easy filtering ("all my CrossFit athletes"). Revisit if
> you'd prefer a simpler `text[]` column on `athlete_profiles`.

### `teams`
A team owns the plan. **A solo athlete is a team of one.** Holds the config the
whole team shares (from the existing `CLIENT` block).
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| coach_id | uuid FK → coaches | **indexed** |
| name | text | team title shown in header (CLIENT.teamName) |
| format_id | text | CHECK in FORMATS keys (determines athlete count: 1/2/4) |
| units | text | CHECK in ('metric','us'); **default 'metric'** |
| created_at | timestamptz | |

### `team_members` (many-to-many; athletes can be in multiple teams over time)
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| team_id | uuid FK → teams | **indexed** |
| athlete_id | uuid FK → athletes | **indexed** |
| joined_at | timestamptz | |
| left_at | timestamptz | null = current member |
| unique (team_id, athlete_id, joined_at) | | |

### `plans`
**Owned by a team** (Plan A). One active plan per team; history via multiple
rows. Holds the target race + length (was on the athlete in the original spec).
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| team_id | uuid FK → teams | **indexed** |
| weeks | int | CHECK in (8,12,16,20) — **single source of truth for plan length** |
| days_per_week | int | CHECK 2..6 (shapes generation) |
| start_iso | date | chosen start date |
| race_name | text | required (specific race — no rough timeframe) |
| race_city | text | |
| race_iso | timestamptz | **NOT NULL** — drives countdown + week labels |
| status | text | CHECK in ('draft','active','archived') |
| generated_at | timestamptz | when the generator last ran |
| created_at | timestamptz | |

### `plan_weeks`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| plan_id | uuid FK → plans | **indexed** |
| week_number | int | 1..weeks |
| phase | int | 1=Base, 2=Build, 3=Peak+Taper |
| focus | text | week summary line |
| unique (plan_id, week_number) | | |

### `plan_days`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| plan_week_id | uuid FK → plan_weeks | **indexed** |
| day_of_week | text | CHECK Mon..Sun |
| shared | bool | session is done together (existing `shared` flag) |
| optional | bool | existing `optional` flag |
| unique (plan_week_id, day_of_week) | | |

### `plan_entries`
**One row per athlete per day.** This normalizes the `a0/a1/a2/a3` per-day
keying in `HyroxHungAndrewAnaheim.jsx` (each athlete index → one row). Solo
formats have one entry per day; doubles two; relay up to four.
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| plan_day_id | uuid FK → plan_days | **indexed** |
| athlete_id | uuid FK → athletes | **indexed** (which athlete this instruction is for) |
| session_type | text | CHECK in sessionTypes keys (run_easy, strength, sled, brick, stations, together, race_sim, conditioning, rest, run_pace, run_long) |
| label | text | "BRICK — Sled + Run" |
| detail | text | full instructions |
| metric_label | text | what to log, e.g. "Round times"; null = nothing to log |
| meta | jsonb | **irregular per-entry data**: wall-ball ladder targets, HRV notes, sled weights, etc. |

> Coach hand-edits (today's "workout overrides") become direct edits to
> `plan_entries` rows. The override layer disappears — the plan *is* the source
> of truth, and the generator upserts into it.

### `logs`
What an athlete actually did.
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| athlete_id | uuid FK → athletes | **indexed** |
| plan_id | uuid FK → plans | **indexed**; deliberate denormalization (derivable via plan_entry→day→week→plan) for fast per-plan log queries |
| plan_entry_id | uuid FK → plan_entries | **indexed**; the session being logged |
| done | bool | |
| metric | text | logged value, e.g. "6:18" or "152kg" (parsed by lib/pace.js) |
| notes | text | athlete's own notes |
| logged_date | date | the date the session was done |
| created_at | timestamptz | |

> **DECIDED:** One row per (athlete, plan_entry), upserted on re-log — matches
> today's behavior where re-logging overwrites. History can be added later.

### `coach_notes`
Per-week shared note (visible to athletes). Because `plan_weeks` belong to the
**team** plan (Plan A), one note per week is automatically shared across the
whole team — no per-athlete duplication.
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| plan_week_id | uuid FK → plan_weeks | **indexed** |
| body | text | |
| updated_at | timestamptz | |
| unique (plan_week_id) | | one note per week |

### `team_notes`
Teammates leave notes/reactions on each other's logs.
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| log_id | uuid FK → logs | **indexed** (the log being reacted to) |
| author_athlete_id | uuid FK → athletes | **indexed** |
| body | text | note text |
| reaction | text | optional emoji/short reaction |
| created_at | timestamptz | |

### `race_results`
Post-race splits (for analysis like NYC/Vegas).
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| athlete_id | uuid FK → athletes | **indexed** |
| race_name | text | |
| race_date | date | |
| total_time | interval | |
| splits | jsonb | per-station + per-run splits |
| created_at | timestamptz | |

---

## RLS policies (go live in Phase 4)

Until Phase 4 we develop with permissive policies. The target policies:

**Coach** (matched by `coaches.user_id = auth.uid()`):
- Full read/write on their `teams` and `athletes` (where `coach_id` = the coach's
  id) and every child row under them (profiles, ratings, modalities, team plans /
  weeks / days / entries, logs, coach_notes, team_notes).

**Athlete** (matched by `athletes.user_id = auth.uid()`):
- Read own athlete row, profile, plan tree, and logs.
- Read **teammates' logs** — where a `team_members` row links the reader and the
  log's athlete to the same team (and `left_at is null`).
- Write own `logs` and own `team_notes` only.
- **Cannot** edit teammates' logs, anyone's plan, or coach notes.

> The "teammate" check is a join through `team_members`. We'll implement it as a
> Postgres `SECURITY` helper function `is_teammate(reader, target)` to keep
> policies readable.

---

## Indexes (summary)

`athletes.coach_id`, `athletes.user_id`, `athlete_profiles.athlete_id`,
`station_ratings.athlete_id`, `athlete_modalities.athlete_id`,
`teams.coach_id`, `team_members.team_id`, `team_members.athlete_id`,
`plans.team_id`, `plan_weeks.plan_id`, `plan_days.plan_week_id`,
`plan_entries.plan_day_id`, `plan_entries.athlete_id`,
`logs.athlete_id`, `logs.plan_id`, `logs.plan_entry_id`,
`coach_notes.plan_week_id`, `team_notes.log_id`, `team_notes.author_athlete_id`,
`race_results.athlete_id`.

---

## Migration from `kv_store` (Phase 5)

Current keys (per `PLAN_ID`, namespaced like `hyrox-<PLAN_ID>-…`):
- `hyrox-<PLAN_ID>-logs-a<N>` → JSON map of `w{week}-{day}` → `{done, metric, notes, date}`
- `hyrox-<PLAN_ID>-coach-notes` → JSON map of week → note
- `hyrox-<PLAN_ID>-workout-overrides` → JSON map per athlete of per-session edits
- `hyrox-<PLAN_ID>-cfg`, `-theme`, `-units`, `-start` → settings blobs

Migration plan: for each known PLAN_ID, parse each blob, resolve `w{week}-{day}`
to the matching `plan_entries` row (by week/day/athlete), and insert `logs` /
`coach_notes`. Overrides get applied to `plan_entries` directly. `kv_store` stays
read-only until verified, then retired.

> **Index → UUID mapping is required.** `kv_store` keys identify athletes by
> *index* (`a0`, `a1`, …). The new tables use UUIDs. The migration needs an
> explicit lookup table per PLAN_ID, e.g. `<plan_id>: a0 → <athlete uuid>,
> a1 → <athlete uuid>`. Build and verify that map before inserting any `logs`.

---

## Seed data (Phase 1)

Seed two teams to prove the multi-athlete model end-to-end:
- **Hung / Andrew (Anaheim)** — from `HyroxHungAndrewAnaheim.jsx`, race
  2026-12-04. The real reference plan, copied verbatim (12 wk, `a0/a1` entries).
- **One generated team** — built by the generator from a sample intake, to prove
  the generation path end-to-end.

> **DECIDED:** Copy the Hung/Andrew Anaheim plan verbatim (the reference plan)
> and generate one team's plan to exercise the generator. Best of both.
> (The deprecated Walker v1 `HyroxTrainer.jsx` is **not** used as a foundation.)
