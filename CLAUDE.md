# CLAUDE.md — Hyrox Trainer

> **This file orients Claude Code each session. It is a router, not the spec.**
> The authoritative documents are `PRODUCT.md`, `ARCHITECTURE.md`, and
> `DATA_MODEL.md`. When this file and those disagree, **those win** — and tell
> Reno so this file gets fixed.

---

## ⚠️ Read this first: the architecture changed

This project was **rebuilt**. It is no longer a per-athlete template that you
copy and deploy to a new URL. If you find yourself about to copy a `.jsx` file,
edit a `CLIENT` block, change a `PLAN_ID`, or write to `window.storage` — **stop.
That is the old model and it is gone.** The legacy description of that system
lives in `LEGACY_TEMPLATE_MODEL.md` for history only; do **not** follow it.

**What the app is now:** one deployed app backed by **Supabase**. Every athlete
is a row in a database, not a code fork. A coach manages many athletes; athletes
log in to view their plan and log workouts. A UI change ships to everyone in one
deploy. Production name: **RPM Athletics** (Reno Performance Method).

| Concept | Old (dead) | Now |
|---|---|---|
| New athlete | copy file, edit `CLIENT`, new URL | a row created via the coach dashboard |
| Storage | `window.storage` / localStorage | Supabase (normalized tables) |
| Identity | none ("assume trusted users") | Supabase Auth, magic link |
| Security | none | Row-Level Security (RLS) in the DB |
| Deploys | one per client | one app, one URL |
| Plan data | hand-built `weekPlan` array per file | generated procedurally from rules, stored as rows |

---

## The source-of-truth documents

Read these before planning or building. Do not re-derive their contents here.

- **`PRODUCT.md`** — what the app is, the roles, the intake questionnaire (the
  shared field schema), the UI to preserve, user stories, build order.
- **`ARCHITECTURE.md`** — the three-layer rule, file layout, tech stack, auth
  model, data-loading strategy.
- **`DATA_MODEL.md`** — the normalized schema, every table, RLS policies,
  indexes, migration-from-legacy plan.
- **`PHASE7_STATE.md`** — the prior implementation snapshot.

---

## The one rule that matters most: three layers, strictly separated

```
UI components (React)        -> render; read via hooks; NEVER import Supabase
     ^
lib/*.js  (business logic)   -> plan generation, pace math, unit conversion.
                                Plain functions. NO React, NO Supabase, NO I/O.
     ^
lib/db.js (data access)      -> the ONLY module that talks to Supabase.
                                If you grep "supabase" outside this file, it's a bug.
```

When something breaks, the layer tells you where to look: wrong number on screen
-> `lib/` math; won't save -> `lib/db.js`; button misplaced -> UI. Full detail in
`ARCHITECTURE.md`.

---

## User & workflow

- **Reno is** the coach, athlete, and developer. **React level: beginner** —
  always explain *why* code works, not just *what* it does.
- **Show diffs -> Reno reviews -> then implement.** Never apply silently.
- **For any bug or design fork, give 2-3 options with tradeoffs.** No silent
  decisions.
- **Never re-interview** for preferences already captured in the spec docs.
- **Test locally (`npm run dev`) before any Vercel deploy.**
- **Approve the schema before any migration runs against a live Supabase
  project.** No migration hits a real DB without Reno's sign-off.

---

## Non-negotiables (things that have caused real problems)

- **No new Supabase calls outside `lib/db.js`.** The three-layer boundary is the
  whole design; violating it is how the codebase rots.
- **The intake questionnaire is defined ONCE** (see `PRODUCT.md`) and reused by
  both the coach "create athlete" form and the future athlete-facing form. Do not
  fork the field list.
- **The plan generator writes via `db.js`, in a transaction, and preserves manual
  coach edits on regenerate** (diff + upsert — never clobber tweaks).
- **RLS is the security boundary, not the UI.** Hiding a button is nicety;
  the database enforces access.
- **Anonymous / account-less write access is NOT part of this app.** Phase 8
  rolled back the Phase 7 `?t=<team_id>` anon experiment. Every athlete has an
  account; login is required to view. If a task seems to want account-less
  access, flag it — it contradicts the model.

---

## Operational lessons (learned the hard way — apply every time)

- **Regenerate Supabase types after any migration that adds tables or
  relationships**, before testing. Stale types cause runtime errors like
  "could not find a relationship between X and Y in the schema cache."
- **Pre-flight the RLS lockout gate.** Before running any migration that
  activates athlete/coach RLS, run `SELECT name, email, user_id FROM coaches;`
  and confirm `user_id` is non-null. Activating RLS with a null coach user_id
  locks the coach out of their own data.
- **Dev-server port drift.** `npm run dev` falls back from 5173 to 5174 if 5173
  is busy. Supabase Auth redirect URLs must include whatever port is actually
  running, or magic links fail with connection-refused. Keep both localhost
  ports in the Supabase allow list.
- **Supabase email rate limit** throttles magic links per project after a few
  sends; it resets in ~15-30 min. Not a bug — wait it out.

---

## Environment / stack

- Vite + React 18, inline styling (no external UI libs), deployed on Vercel.
- `@supabase/supabase-js` is the client. Supabase URL + anon key come from
  `.env.local` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) — **never
  hardcoded in source.** The anon key is browser-safe *only because* RLS
  restricts it.
- Migrations live in `supabase/migrations/`, reviewed before running.

### Environments (do not confuse these)

- **`hyroxdev` Supabase** (project id `oszfkbgqshyimbbwntfq`) — dev/test DB.
- **Production Supabase** — separate project, holds real Walker + Anaheim data.
- **`hyrox-slot-1` Vercel** — disposable test deploy, Preview env vars -> `hyroxdev`.
- **`rpm-athletics` Vercel** (`rpm-athletics.vercel.app`) — production home,
  tracks `docs/rebuild-contract`, points at **production** Supabase. Not yet live.
- **`team-walker-hyrox` / `hyrox-hung-andrew-anaheim` Vercel** — the two legacy
  live apps. Leave untouched until the deliberate production cutover.

---

## Current phase

**Phase 8 — Athlete Login & Invite: BUILT and TESTED on the `hyrox-slot-1`
preview + `hyroxdev`.** Migration `0004_phase8_auth.sql` ran clean; magic-link
auth, coach dashboard, invite creation, and invite acceptance all verified
end-to-end.

**Open bug to fix before production cutover:** the `?invite=<token>` route
auto-accepts on page load and lands on the dashboard instead of showing the
"Claim your account" screen and requiring an explicit action first. Fix on the
branch before deploying `rpm-athletics`.

**Deployment-order caution:** never activate athlete RLS while `coaches.user_id`
is null (locks the coach out). Verify it's set before running an RLS migration
against any DB — including production.

---

## Roadmap (after production cutover)

Data migration of legacy logs -> normalized tables; in-app athlete intake form;
Strava + Apple Health integration; AI coaching feedback; per-race leaderboards;
pre-built template plans. Detail in `PRODUCT.md` / `ARCHITECTURE.md`.

---

**Canonical repo:** https://github.com/mrenolayan/Hyrox-Training
**Architecture:** one app + Supabase + auth (NOT per-URL template duplication)
