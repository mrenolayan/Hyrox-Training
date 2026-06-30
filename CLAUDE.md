# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## TL;DR: Three-layer architecture (the core rule)

```
UI (React components) → lib/*.js (business logic) → lib/db.js (ONLY Supabase boundary)
```

**The golden rule:** if you see `supabase` anywhere outside `lib/db.js`, that's a bug. `lib/db.js` is where ALL database access happens. Business logic in `lib/*.js` is pure functions (testable, no I/O). Components just render.

See **ARCHITECTURE.md** for detailed reasoning.

## Build & run

```bash
npm install                    # install dependencies
npm run dev                    # start Vite dev server (http://localhost:5173)
npm run build                  # build for production
npm run preview               # preview production build locally
```

**Test locally before deploying.** The Supabase project (`hyrox-dev`) is shared; all changes push to a live database.

## Project status & phases

Current: **Phase 7** (athlete-facing access, shareable team links, flexible logging)

**Phase history:**
1. **Phase 1** — Supabase schema + seed data (Hung/Andrew Anaheim reference plan)
2. **Phase 2** — `lib/db.js` data-access layer + coach dashboard skeleton
3. **Phase 3** — `lib/plan.js` generator + business logic; wire generate button
4. **Phase 4** — Supabase Auth (magic link) + RLS policies
5. **Phase 5** — Migrate `kv_store` logs to normalized tables
6. **Phase 6** — UI polish: theme, per-athlete view, session cards, logging, in-app intake form
7. **Phase 7** — Athlete-facing: shareable links (`/?t=<team_id>`), athlete view (no login), flexible logging with date picker, athlete self-edit
8. **Phases 8+** — TBD (athlete login/invite for `require_auth=true` teams)

See **PRODUCT.md** for the product contract and **DATA_MODEL.md** for schema details.

## File structure & responsibilities

```
src/
├── App.jsx                          # Router & auth flow; public link handling
├── main.jsx                         # React entry point
├── lib/
│   ├── db.js                        # ★★★ SOLE Supabase boundary
│   ├── supabaseClient.js            # Supabase client config (import only in db.js)
│   ├── auth.js                      # Magic-link auth helpers
│   ├── plan.js                      # Plan generator + training rules
│   └── pace.js                      # Pace parsing & unit conversion
├── components/
│   ├── TeamView.jsx                 # Main plan view (coach & athlete)
│   ├── IntakeForm.jsx               # Multi-step team intake form
│   └── [others]                     # Supporting UI components
├── ui/
│   └── theme.js                     # Color palettes & autoTheme()
└── [deprecated: HyroxHungAndrewAnaheim.jsx, HyroxTrainer.jsx, HyroxTrainingApp.jsx]

supabase/
├── migrations/
│   └── phase*.sql                   # Schema + RLS policies (must be reviewed before running)
└── seed.sql                         # Initial seed data

[Root docs]
├── ARCHITECTURE.md                  # Three-layer design rationale
├── DATA_MODEL.md                    # Full schema + RLS policies
├── PRODUCT.md                       # Product contract & user stories
└── CLAUDE.md                        # This file
```

### `lib/db.js` — the critical boundary

Every database operation is a named export here:
- `getCoach()`, `getTeamsForCoach(coachId)` — coach dashboard
- `getAthletesForTeam(teamId)`, `getPlanForTeam(teamId)` — coach view
- `getPublicTeamView(teamId)` — athlete view (public link, throws `"AUTH_REQUIRED"` for protected teams)
- `saveLog(...)`, `savePlanEntry(...)` — write operations
- `createTeamFull(...)`, `createAthlete(...)` — intake flow
- etc.

Returns plain JS objects/arrays, never raw Supabase query builders. The rest of the app doesn't know Supabase exists.

### `lib/*.js` — business logic (pure functions)

- `lib/plan.js` — `generatePlan(team, plan, athletes)` builds a procedurally-generated training plan from intake data. No I/O.
- `lib/pace.js` — `parsePace()`, `paceLabel()`, `convertPace()` — pace formatting and km↔mi conversion. Testable.
- `lib/auth.js` — `getSession()`, `sendMagicLink()`, `signOut()` — authentication helpers (Supabase-aware, but thin).

### UI components

- **App.jsx** — Top-level router. Handles:
  - Public link routing (`/?t=<teamId>`)
  - Coach auth + session management
  - Coach dashboard (team list)
  - Delegate to `TeamView` or `IntakeForm`

- **TeamView.jsx** — Renders a plan (coach or athlete view). Receives:
  - `isCoach: boolean` flag to hide/show coach-only controls
  - `athletes: []` list passed from App (not fetched locally)
  - Manages athlete selector, session cards, logging UI

- **IntakeForm.jsx** — Multi-step team creation:
  - Step 0: Team name, format, units, `require_auth` toggle
  - Step 1–N: Per-athlete fields (pace, station ratings, profile)
  - Calls `db.createTeamFull()` on submit

## Key architectural decisions

**Three-layer separation** — `lib/db.js` is the database boundary; `lib/*.js` is pure logic; UI just renders. Makes testing, debugging, and future database migration trivial.

**Team ownership (Plan A)** — A plan belongs to a *team*, not an athlete. A solo athlete is a team of one. This prevents athlete-level desync and simplifies plan generation. See DATA_MODEL.md.

**RLS (Row-Level Security)** — The database enforces access control, not the UI. The UI may hide buttons for UX, but the real security boundary is in Supabase RLS policies.

**Public links (`?t=<teamId>`)** — `require_auth` column (default `false`) allows unauthenticated athlete access via anon RLS policies. Existing teams stay link-only; new teams can opt-in to login.

**Flexible logging** — Athletes can log sessions on dates different from today. Logs store `logged_date`, not `created_at`.

**Athlete self-edit** — Athletes can edit `detail` and `notes` on their own logged entries via RLS anon INSERT/UPDATE policies (not full plan edit).

## Workflow rules (how to work with Reno)

1. **Show diffs → review → implement.** Never apply changes silently. For non-obvious choices, show 2–3 options with tradeoffs.
2. **Test locally** (`npm run dev`) before any Vercel push.
3. **Get schema approval before migrations hit the live DB.** The Supabase project is shared; misaligned changes can break athlete data.
4. **Commit clearly.** Use git history to explain *why*, not just *what*. Example: `Phase 7: athlete-facing links + flexible logging` not `update TeamView`.

Rationale: Reno is a React beginner, and the app holds real athlete data in a live Supabase database.

## Common tasks

### Start dev server
```bash
npm run dev
```
Opens http://localhost:5173. React Fast Refresh works automatically.

### Test a coach flow
1. Start dev server
2. Log in with a magic link (use `mrenolayan@gmail.com` if seeded)
3. Open a team → browse the plan → toggle theme/units
4. Edit a session inline
5. Create a new athlete via intake form

### Test an athlete flow (public link)
1. Get a team ID from the coach dashboard (visible in browser DevTools or from `teams` table)
2. Open `http://localhost:5173?t=<team_id>` in a new incognito window
3. Verify: athlete sees the plan, athlete selector works, no Generate button, can log + edit own entries

### Debug database state
Check Supabase dashboard (https://app.supabase.com) → project `hyrox-dev` → SQL Editor or Table Editor. Verify data shape against DATA_MODEL.md.

### Run a SQL query
Use Supabase SQL Editor. Example: find all logs for a team:
```sql
select logs.* from logs
join plan_entries on logs.plan_entry_id = plan_entries.id
join plan_days on plan_entries.plan_day_id = plan_days.id
join plan_weeks on plan_days.plan_week_id = plan_weeks.id
join plans on plan_weeks.plan_id = plans.id
where plans.team_id = '<team-uuid>'
order by logs.created_at desc;
```

## Important security notes

**Anon key exposure** — The `VITE_SUPABASE_ANON_KEY` is public (shipped to the browser). This is safe *only because* RLS restricts what it can do. Do NOT bypass RLS checks in the frontend "for convenience." If a coach-only operation needs to be protected, add an RLS policy.

**Service role key** — Kept in `.env.local` (gitignored). Used only for server-side operations (migrations, seeding). Never ship to the browser.

**User data** — Athlete names, paces, injuries, etc. are real. Never log or expose them outside encrypted Supabase channels.

## Deploying to Vercel

```bash
vercel
```

Follows prompts. Environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) are auto-linked from the Vercel project settings (connect to GitHub, enable auto-deploy).

**Before deploy:** run `npm run build` locally and verify no errors. Test the production build with `npm run preview`.

## Deferred work

- **Phase 8:** Athlete login/invite flow for `require_auth=true` teams (magic links)
- **Service role key rotation:** Supabase → Hyrox-dev → Settings → API → Reset `service_role` key (was flagged, not yet done)
- **Type safety:** TypeScript or JSDoc + type checking (currently plain JS)
- **Test suite:** Unit tests for `lib/*.js`, e2e tests for critical flows

## Deprecated files (do not use)

- `HyroxTrainer.jsx` — Walker DC v1 app, hardcoded for 2 athletes. Do NOT use as rebuild foundation.
- Newer reference files: `HyroxHungAndrewAnaheim.jsx`, `HyroxTrainingApp.jsx` — use these if needing to extract session templates or study the original plans.

## Questions or edge cases?

Refer to the contract docs first:
- **Architecture:** ARCHITECTURE.md (why three layers, what goes where)
- **Schema:** DATA_MODEL.md (all tables, columns, indexes, RLS policies)
- **Product:** PRODUCT.md (user stories, features, out-of-scope work)
- **Workflow:** This file + the memory system at `/Users/mrenolayan/.claude/projects/-Users-mrenolayan-Desktop-hyrox-trainer/memory/`

If unsure, ask Reno rather than inferring. He's a React beginner, so explicit reasoning beats assumptions.
