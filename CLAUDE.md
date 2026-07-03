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
deploy.

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
- **`PHASE7_STATE.md`** — the current implementation snapshot (what's built).

---

## The one rule that matters most: three layers, strictly separated

```
UI components (React)        → render; read via hooks; NEVER import Supabase
     ↑
lib/*.js  (business logic)   → plan generation, pace math, unit conversion.
                               Plain functions. NO React, NO Supabase, NO I/O.
     ↑
lib/db.js (data access)      → the ONLY module that talks to Supabase.
                               If you grep "supabase" outside this file, it's a bug.
```

When something breaks, the layer tells you where to look: wrong number on screen
→ `lib/` math; won't save → `lib/db.js`; button misplaced → UI. Full detail in
`ARCHITECTURE.md`.

---

## User & workflow

- **Reno is** the coach, athlete, and developer. **React level: beginner** —
  always explain *why* code works, not just *what* it does.
- **Show diffs → Reno reviews → then implement.** Never apply silently.
- **For any bug or design fork, give 2–3 options with tradeoffs.** No silent
  decisions.
- **Never re-interview** for preferences already captured in the spec docs.
- **Test locally (`npm run dev`) before any Vercel deploy.**
- **Approve the schema before any migration runs against the live Supabase
  project.** No migration hits the real DB without Reno's sign-off. (This rule
  was crossed once already — do not skip it.)

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
- **Anonymous / account-less write access is NOT part of this app.** (A Phase 7
  experiment added it via `?t=<team_id>` links; Phase 8 rolls it back. Every
  athlete has an account. Login is required to view.) If a task seems to want
  account-less writes, flag it — it contradicts the model.

---

## Environment / stack

- Vite + React 18, inline styling (no external UI libs), deployed on Vercel.
- `@supabase/supabase-js` is the client. Supabase URL + anon key come from
  `.env.local` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) — **never
  hardcoded in source.** The anon key is browser-safe *only because* RLS
  restricts it.
- Migrations live in `supabase/migrations/`, reviewed before running.

---

## Current phase

**Phase 8 — Athlete Login & Invite.** Magic-link accounts for all athletes; the
two legacy teams (Walker DC, Hung/Andrew Anaheim) claim their existing rows once;
roll back Phase 7 anonymous access; login required to view. See the Phase 8 plan
(in the Chat project) and `DATA_MODEL.md` for the RLS policies being activated.

**Deployment-order caution:** never activate athlete RLS while `coaches.user_id`
is null (locks the coach out). Verify it's set before running the Phase 8
migration.

---

## Roadmap (after Phase 8)

Data migration of legacy logs → normalized tables; in-app athlete intake form;
Strava + Apple Health integration; AI coaching feedback; per-race leaderboards;
pre-built template plans. Detail in `PRODUCT.md` / `ARCHITECTURE.md`.

---

**Canonical repo:** https://github.com/mrenolayan/Hyrox-Training
**Architecture:** one app + Supabase + auth (NOT per-URL template duplication)
