# Hyrox Trainer — Phase 7 Complete State File

**Generated:** 2026-07-01  
**Current Phase:** Phase 7 (Athlete-facing access — shareable links, flexible logging, self-edit)  
**Status:** Implementation complete, ready for testing & deployment  

---

## Quick Context

Hyrox Trainer is a training plan app being rebuilt from per-client deployed copies into **ONE app + Supabase database**. Coaches manage athlete teams; athletes follow plans, log workouts, see teammates' logs.

**Key rule:** Three-layer architecture: UI → `lib/*.js` (business logic) → `lib/db.js` (ONLY Supabase boundary).

---

## Phase 7: Athlete-Facing Access (COMPLETE)

### Features Implemented

1. **Shareable team links** (`/?t=<team_id>`)
   - Athletes open link in any browser — no login required
   - Uses Supabase anon RLS policies
   - Existing teams automatically public; new teams can opt-in to login

2. **Flexible logging with custom dates**
   - Athletes can log a session for a date different from today
   - Date picker in log form: "When did you do this session?"
   - Logs store `logged_date` (date) not just `created_at` (timestamp)

3. **Athlete self-edit**
   - Athletes can edit `detail` and `notes` on their own logged entries
   - Cannot edit other athletes' entries or the plan itself
   - RLS anon policies enforce this boundary

4. **Athlete selector persistence**
   - When viewing a team, selecting athlete is saved per team in localStorage
   - Survives page reload

5. **Coach controls hidden**
   - Generate button: only visible to coaches
   - Coach notes edit: only visible to coaches
   - Consistent across Week view and Plan tabs

6. **require_auth toggle for intake form**
   - New teams: checkbox in step 0 → "Require athlete login (magic link) for this team"
   - Unchecked (default) = link-only access (existing behavior)
   - Checked = require auth (future Phase 8 work)

### Code Changes Summary

#### `src/lib/db.js`
- **New function:** `getPublicTeamView(teamId)`
  - Fetches team, plan, athletes for unauthenticated access
  - Throws `"AUTH_REQUIRED"` error if `require_auth=true`
  - Used by App.jsx for public link routing
  
```javascript
export async function getPublicTeamView(teamId) {
  const teamRows = unwrap("getPublicTeamView.team", await supabase
    .from("teams")
    .select("id, name, format_id, units, require_auth")
    .eq("id", teamId)
    .limit(1));
  const team = teamRows[0] ?? null;
  if (!team) throw new Error("Team not found");
  if (team.require_auth) throw new Error("AUTH_REQUIRED");
  const plan = await getPlanForTeam(teamId);
  const athletes = await getAthletesForTeam(teamId);
  return { team, plan, athletes };
}
```

- **Modified:** `getTeamsForCoach(coachId)` now selects `require_auth` column
- **Modified:** `createTeamFull()` accepts `requireAuth` parameter, passes to team insert

#### `src/App.jsx`
- **Public link routing** (lines 38–58):
  - Checks for `?t=<teamId>` URL parameter on mount
  - Calls `db.getPublicTeamView()` for anon access
  - Sets `openTeam.isCoach = false` for athlete view
  - Falls through to normal coach auth if AUTH_REQUIRED

- **Copy link button** (lines 98–100, 14–17):
  - Added `copyTeamLink(teamId)` function
  - Copies `${window.location.origin}?t=${teamId}` to clipboard
  - Button on each team card with "Copied!" feedback (1.8s timeout)

- **Prop passing to TeamView**:
  ```javascript
  <TeamView
    team={openTeam.team}
    plan={openTeam.plan}
    athletes={openTeam.athletes}  // ← passed from getPublicTeamView
    coach={coach}
    isCoach={openTeam.isCoach}    // ← false for athlete view
    // ... rest of props
    onBack={() => {
      setOpenTeam(null);
      window.history.replaceState({}, "", window.location.pathname);
    }}
  />
  ```

#### `src/components/TeamView.jsx`
- **Function signature:**
  ```javascript
  export default function TeamView({ team, plan, athletes: athletesProp = [], coach, isCoach = true, ... })
  ```
  Added `athletesProp` and `isCoach` parameters.

- **Fixed members derivation** (line 94):
  - Was: `const members = team.team_members.map((m) => m.athlete)` → fails for public link flow
  - Now: `const members = athletesProp;` → works for both coach and athlete views

- **Removed orphaned useEffect** (line 146–148):
  - Was fetching athleteDetails; now it's a const from props

- **Athlete selector persistence** (lines 98–110):
  ```javascript
  const [athleteIdx, setAthleteIdx] = useState(() => {
    const saved = localStorage.getItem("hyrox-athlete-" + team?.id);
    return saved ? parseInt(saved, 10) : 0;
  });
  
  useEffect(() => {
    if (team?.id) localStorage.setItem("hyrox-athlete-" + team.id, String(athleteIdx));
  }, [athleteIdx, team?.id]);
  ```

- **Date field on logDraft** (line 112):
  - Added to state: `date: new Date().toISOString().slice(0, 10)`

- **Date picker in log form** (before metric input):
  ```javascript
  <input 
    type="date" 
    value={logDraft.date} 
    onChange={(e) => setLogDraft((p) => ({ ...p, date: e.target.value }))} 
  />
  ```
  Label: "Date logged"

- **Pass loggedDate to saveLog** (lines 167–177):
  ```javascript
  const saved = await db.saveLog({
    athleteId: selectedAthlete.id,
    planId: planState.id,
    planEntryId: entry.id,
    done: true,
    metric: logDraft.metric || null,
    notes: logDraft.notes || null,
    loggedDate: logDraft.date || new Date().toISOString().slice(0, 10),
  });
  ```

- **Seed date when opening log form** (line 625):
  ```javascript
  setOpenLog(entry.id); 
  setLogDraft({ 
    metric: log?.metric || "", 
    notes: log?.notes || "", 
    date: log?.logged_date || new Date().toISOString().slice(0, 10) 
  });
  ```

- **Gate coach-only controls**:
  - Coach notes edit button: `{isCoach && <button>Edit</button>}`
  - Coach notes edit form: `{editingNote && isCoach && (...)}`
  - Generate button (Week & Plan tabs): `{isCoach ? <button>Generate</button> : <p>Ask your coach...</p>}`
  - Pass `isCoach` down to both tabs

#### `src/components/IntakeForm.jsx`
- **Added requireAuth state** (after saveErr state):
  ```javascript
  const [requireAuth, setRequireAuth] = useState(false);
  ```

- **Toggle UI in step 0** (after units selector, before nav buttons):
  ```javascript
  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 16 }}>
    <input
      type="checkbox"
      id="require_auth"
      checked={requireAuth}
      onChange={(e) => setRequireAuth(e.target.checked)}
      style={{ width: 16, height: 16, cursor: "pointer", marginTop: 2 }}
    />
    <label htmlFor="require_auth" style={{ color: T.body, fontSize: 13, cursor: "pointer" }}>
      Require athlete login (magic link) for this team
      <span style={{ color: T.faint, fontSize: 11, display: "block" }}>
        Leave unchecked for link-only access (existing teams like Walker, Hung/Andrew use this)
      </span>
    </label>
  </div>
  ```

- **Pass requireAuth to createTeamFull**:
  ```javascript
  const { team, plan, athletes: athleteRows } = await db.createTeamFull({
    requireAuth,
    // ... rest of args
  });
  ```

### Supabase Migration (Phase 7)

File: `supabase/migrations/phase7_athlete_access.sql`

**Schema changes:**
```sql
ALTER TABLE teams ADD COLUMN require_auth boolean NOT NULL DEFAULT false;
```

**Anon RLS Policies:**
All tables needed for athlete view have `SELECT` policies checking `require_auth = false`:
- `teams`, `athletes`, `team_members`, `plans`, `plan_weeks`, `plan_days`, `plan_entries`
- `coach_notes`, `logs`, `station_ratings`, `athlete_profiles`

**Anon INSERT/UPDATE Policies:**
- `logs`: athletes can INSERT/UPDATE their own logs
- `plan_entries`: athletes can UPDATE `detail` and `notes` on their own entries

All anon policies verify `teams.require_auth = false` before granting access.

---

## Architecture Reference

### Three-Layer Rule

```
UI (React components)
  ↓ calls plain functions
lib/*.js (business logic — pure functions, no I/O)
  ↓ called by db layer / hooks to shape data
lib/db.js (SOLE Supabase boundary)
```

**If you see `supabase` outside `lib/db.js`, that's a bug.**

### File Structure

```
src/
├── App.jsx                      # Router, auth, public link handling
├── main.jsx                     # Entry point
├── lib/
│   ├── db.js                    # ★★★ ONLY Supabase access
│   ├── supabaseClient.js        # Client config (import only in db.js)
│   ├── auth.js                  # Magic link helpers
│   ├── plan.js                  # Generator + training rules
│   └── pace.js                  # Pace parsing & unit conversion
├── components/
│   ├── TeamView.jsx             # Main plan view (coach & athlete)
│   ├── IntakeForm.jsx           # Multi-step intake
│   └── ...
├── ui/
│   └── theme.js                 # Color palettes
└── [deprecated: HyroxHungAndrewAnaheim.jsx, HyroxTrainer.jsx, HyroxTrainingApp.jsx]

supabase/
├── migrations/
│   ├── phase1_schema.sql
│   ├── phase4_auth_rls.sql
│   ├── phase5_kv_store_migration.sql
│   └── phase7_athlete_access.sql
└── seed.sql

[Docs]
├── ARCHITECTURE.md              # Design rationale (three layers, why)
├── DATA_MODEL.md                # Full schema, RLS policies
├── PRODUCT.md                   # Product contract, user stories
└── CLAUDE.md                    # This project's Claude Code guide
```

### Key Functions in db.js

**Coach dashboard:**
- `getCoach()` → coach row
- `getTeamsForCoach(coachId)` → [team with plan + athletes]
- `openTeamPlan(team)` → full plan tree + athletes

**Athlete/Team queries:**
- `getAthletesForTeam(teamId)` → [athlete rows with profiles]
- `getPlanForTeam(teamId)` → plan tree (weeks/days/entries)
- `getPublicTeamView(teamId)` → {team, plan, athletes} (throws AUTH_REQUIRED if protected)

**Writing:**
- `saveLog({athleteId, planId, planEntryId, done, metric, notes, loggedDate})` → log row
- `savePlanEntry(planEntryId, updates)` → updated entry
- `createTeamFull({name, formatId, units, requireAuth, athleteNames, ...})` → {team, plan, athletes}

---

## Database Schema (Summary)

Full schema in DATA_MODEL.md; key tables:

```
coaches
├─ id, user_id, name, email

teams (coach_id FK)
├─ id, coach_id, name, format_id, units, require_auth, created_at
└─ plans (team_id FK)
   ├─ id, team_id, weeks, days_per_week, race_name, race_iso, status
   ├─ plan_weeks (plan_id FK)
   │  ├─ week_number, phase, focus
   │  └─ plan_days (plan_week_id FK)
   │     ├─ day_of_week, shared, optional
   │     └─ plan_entries (plan_day_id FK, athlete_id FK)
   │        ├─ session_type, label, detail, metric_label
   │        └─ logs (plan_entry_id FK, athlete_id FK)
   │           ├─ done, metric, notes, logged_date (★ date, not timestamp)
   │           └─ coach_notes (plan_week_id FK, one per week)
   │
   └─ team_members (team_id, athlete_id FK)
      └─ athletes (coach_id FK, user_id FK)
         ├─ name, color, role, run_pace, longest_run
         └─ athlete_profiles (1:1 athlete FK)
            ├─ known_weights, team_split_notes, injuries_notes
            └─ station_ratings (athlete_id FK, per station)
```

**Key:** Plan belongs to *team*, not athlete. Solo athlete = team of one. `plan_entries` has one row per athlete per day.

**Indexes:** all FKs used for filtering (see DATA_MODEL.md for full list).

---

## RLS Policies (Row-Level Security)

Enforced in the database; UI may hide buttons but DB is the security boundary.

### Coach (matched by `coaches.user_id = auth.uid()`)
- Full read/write on their teams, athletes, and all child rows (plans, logs, notes, etc.)

### Athlete (matched by `athletes.user_id = auth.uid()`)
- Read own row, profile, plan tree, logs
- Read **teammates' logs** (via `team_members` join)
- Write own logs and team notes only
- Cannot edit anyone's plan or coach notes

### Anon (public link, `?t=<team_id>`)
- SELECT on all tables **IF** `require_auth = false` on the team
- INSERT/UPDATE own logs (anonymous) **IF** `require_auth = false`
- Cannot access teams with `require_auth = true`

---

## Current Development Environment

**Dev Supabase Project:** `hyrox-dev`  
**URL:** https://app.supabase.com  

**Environment variables** (`.env.local`, gitignored):
```
VITE_SUPABASE_URL=https://oszfkbgqshyimbbwntfq.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...  # Safe to ship to browser (RLS-protected)
```

**Seeded teams:**
- **Hung/Andrew (Anaheim)** — reference plan, 12 weeks, 2 athletes
- **Walker** — sample solo team
- Others as created via intake form

---

## Testing Phase 7

### Test Coach Flow
```bash
npm run dev  # http://localhost:5173
# Log in with magic link (mrenolayan@gmail.com)
# Click a team → see full plan, athlete dropdown, Generate button, edit controls
# Click "Copy link" button → URL copied to clipboard
# Edit a session inline → persists
```

### Test Athlete Flow (Public Link)
```bash
# Get a team ID from Supabase or coach dashboard
# Open http://localhost:5173?t=<team_id> in incognito window
# Should see:
# ✓ Full plan (same as coach sees)
# ✓ Athlete selector (dropdown)
# ✓ Athlete selector persists on reload
# ✓ No "Generate" button (only text "Ask your coach...")
# ✓ No coach notes edit controls
# ✓ Log form has "Date logged" date picker
# ✓ Can log session for past/future date
# ✓ Can edit logged session's detail/notes
# ✗ Cannot edit other athlete's logged entry (RLS enforces this)
```

### Test require_auth Toggle
```bash
# In coach dashboard, click "Create athlete" → IntakeForm
# Step 0: should see checkbox "Require athlete login"
# Unchecked (default) → new team is link-only
# Check it → save → (Phase 8 will implement magic-link flow for this team)
# Try accessing that team's public link → should get AUTH_REQUIRED error
```

---

## How to Continue Work

### Before Starting Dev Session
1. Pull latest changes: `git pull origin main`
2. Install deps: `npm install`
3. Start dev server: `npm run dev`
4. Check `.env.local` has Supabase credentials (ask Reno if missing)

### If Making DB Changes
1. Write SQL migration in `supabase/migrations/phase<N>_*.sql`
2. **Show Reno the migration** — never run against live DB without approval
3. Apply via Supabase dashboard SQL Editor (or CLI)
4. Commit the migration file to git

### If Changing Architecture
1. Update ARCHITECTURE.md, DATA_MODEL.md, or CLAUDE.md
2. Ensure three-layer rule is maintained: `lib/db.js` ← `lib/*.js` ← UI

### Deploy to Vercel
```bash
npm run build         # test build locally
npm run preview       # preview production build
vercel                # deploy (auto-linked to GitHub)
```

---

## Pending Work (Phase 8+)

### Phase 8: Athlete Login / Invite (not started)
- For `require_auth=true` teams, athletes get magic-link invite
- Athletes can log in via `auth.users.id` → read/write own data
- Coach can invite athletes (email)

### Deferred
- **Service role key rotation** — Supabase → Settings → API → Reset
- **TypeScript** — add JSDoc or switch to full TS
- **Tests** — unit tests for `lib/*.js`, e2e for critical flows
- **Performance** — lazy load full plan on team open; paginate athlete list

---

## Workflow Rules for Reno (React Beginner)

1. **Show diffs → review → implement** — never silent changes
2. **Test locally** before any Vercel deploy
3. **Get schema approval** before migrations touch the live DB
4. **Commit messages should explain *why*** — the diff shows *what*
5. **Three-layer rule is non-negotiable** — `lib/db.js` is the ONLY Supabase boundary

---

## Important Notes

### Security
- **Anon key is public** (shipped to browser) — safe only because RLS protects it
- **Service role key never ships** — kept in `.env.local`, gitignored
- **User data is real** — don't log names/paces outside Supabase
- **RLS is the security boundary**, not the UI

### Backward Compatibility
- Existing teams have `require_auth = NULL` → treated as `false` (link-only) ✓
- Old `kv_store` data migrated in Phase 5 ✓
- No breaking changes to athlete or coach experience ✓

### Performance
- Coach dashboard loads athlete *summaries* (not full plans)
- Full plan loads lazily when opening a team
- All filtering FKs are indexed

---

## References

- **ARCHITECTURE.md** — three-layer design, why it matters
- **DATA_MODEL.md** — full schema, all tables, RLS policies, indexes
- **PRODUCT.md** — product contract, user stories, features
- **CLAUDE.md** — Claude Code guide for this project
- **Supabase docs** — https://supabase.com/docs

---

## Git Workflow

**Current branch:** `docs/rebuild-contract` (main development)  
**Upstream:** `main` (production-ready)

Recent commits:
```
823f63c docs: add CLAUDE.md — architecture guide, workflow rules, common tasks
33a739a Phase 7: athlete-facing access — public links, flexible logging, self-edit
348ec96 Phase 6: full UI rebuild — theme, per-athlete view, session cards, logging, coach edit, tabs, intake form
b08c49c Phase 5: kv_store migration + correct athlete seed data
35f3ade Phase 4: Supabase Auth (magic link) + RLS
```

---

## Contact / Questions

Ask Reno for:
- Supabase project access (if not already set up)
- Missing `.env.local` credentials
- Approval before schema changes
- Product decisions (features, scope, priorities)
- User feedback from Hung, Walker, other athletes

---

**Last updated:** 2026-07-01 (Phase 7 complete)  
**Ready for:** Testing, refinement, Phase 8 planning, Vercel deployment
