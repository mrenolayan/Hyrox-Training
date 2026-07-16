// ════════════════════════════════════════════════════════════════════════════
//  migrate-logs-from-legacy.mjs — sync the REAL athlete history from the frozen
//  legacy kv_store archive into hyroxdev's normalized tables.
//
//  WHY THIS EXISTS
//    hyroxdev's current `logs` are synthetic seed data (placeholder metrics like
//    "17:32" / "Rounds: 3"). The real logs the athletes actually wrote only ever
//    lived in the legacy archive (project srbgpxuvrfyxbgbftcop, kv_store table).
//    This script makes hyroxdev an EXACT MIRROR of that real data.
//
//  SCOPE — what it touches, and what it does NOT
//    ✔ logs           — scoped DELETE (only the 4 athletes below) + reinsert
//    ✔ coach_notes    — scoped DELETE (only these 2 plans' weeks) + reinsert
//    ✔ plan_entries   — UPDATE in place to apply coach workout overrides
//    �’ teams / athletes / plans / plan_weeks / plan_days — NEVER touched
//
//    This is nothing like migrate-phase5.mjs, which wiped teams+athletes. Plan
//    structure and identities are left completely intact.
//
//  SOURCE IS READ LIVE (not hardcoded) so it can never go stale. The legacy
//  archive is frozen/read-only, but we still read it fresh each run.
//
//  Usage:
//    SUPABASE_SERVICE_KEY=<hyroxdev service_role>  \
//    LEGACY_SUPABASE_KEY=<legacy anon or service> \
//    node scripts/migrate-logs-from-legacy.mjs
//
//    - SUPABASE_SERVICE_KEY : hyroxdev (oszfkbgqshyimbbwntfq) → WRITE target.
//        Supabase dashboard → hyroxdev → Settings → API → service_role (secret).
//    - LEGACY_SUPABASE_KEY  : legacy (srbgpxuvrfyxbgbftcop) → READ source.
//        The legacy kv_store is publicly readable, so the ANON key is enough.
//        Supabase dashboard → Hyrox App → Settings → API → anon/public.
//
//  IDEMPOTENT: delete-then-reinsert means re-running produces the same result.
// ════════════════════════════════════════════════════════════════════════════
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// ── Env / clients ─────────────────────────────────────────────────────────────
const env = Object.fromEntries(
  readFileSync(join(root, ".env.local"), "utf8")
    .split("\n")
    .filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const HYROX_URL     = env.VITE_SUPABASE_URL;                 // hyroxdev (from .env.local)
const HYROX_KEY     = process.env.SUPABASE_SERVICE_KEY;      // write target (service_role)
const LEGACY_URL    = "https://srbgpxuvrfyxbgbftcop.supabase.co";
const LEGACY_KEY    = process.env.LEGACY_SUPABASE_KEY;       // read source (anon is fine)

if (!HYROX_KEY)  { console.error("✗ Set SUPABASE_SERVICE_KEY=<hyroxdev service_role> before running."); process.exit(1); }
if (!LEGACY_KEY) { console.error("✗ Set LEGACY_SUPABASE_KEY=<legacy anon/public key> before running."); process.exit(1); }
if (!HYROX_URL || !HYROX_URL.includes("oszfkbgqshyimbbwntfq")) {
  console.error(`✗ .env.local VITE_SUPABASE_URL is not hyroxdev (got: ${HYROX_URL}). Refusing to run.`); process.exit(1);
}

const dev    = createClient(HYROX_URL,  HYROX_KEY,  { auth: { persistSession: false } });
const legacy = createClient(LEGACY_URL, LEGACY_KEY, { auth: { persistSession: false } });

const must = (label, { data, error }) => {
  if (error) { console.error(`  ✗ ${label}: ${error.message}`); process.exit(1); }
  return data;
};

// ── Which hyroxdev athlete maps to which legacy kv keys ───────────────────────
//   Keyed by the athlete's name AS IT EXISTS IN hyroxdev today.
const ATHLETE_MAP = {
  Hung:     { team: "Anaheim",   log_key: "a0",      override_key: "0" },
  Andrew:   { team: "Anaheim",   log_key: "a1",      override_key: "1" },
  Reece:    { team: "Walker DC", log_key: "reece",   override_key: "reece" },
  Samantha: { team: "Walker DC", log_key: "partner", override_key: "partner" },
};
const TEAM_KV_PREFIX = {
  Anaheim:     "hyrox-team-hung-andrew-anaheim",
  "Walker DC": "hyrox-dc",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const parseWd = (key) => { const m = key.match(/^w(\d+)-(.+)$/); return m ? { weekNum: +m[1], dayOfWeek: m[2] } : null; };

function inferSessionType(label) {
  const l = (label || "").toLowerCase();
  if (l.includes("strength") || l.includes("deadlift") || l.includes("squat")) return "strength";
  if (l.includes("station") || l.includes("circuit") || l.includes("sled"))    return "stations";
  if (l.includes("hiit") || l.includes("amrap") || l.includes("conditioning")) return "conditioning";
  if (l.includes("run"))                                                        return "run_easy";
  return "together";
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("━━━ Migrate real logs: legacy kv_store → hyroxdev ━━━\n");

  // 1. Read the live legacy archive.
  const rows = must("legacy read", await legacy.from("kv_store").select("key,value"));
  if (!rows?.length) { console.error("✗ Legacy kv_store returned 0 rows — check LEGACY_SUPABASE_KEY."); process.exit(1); }
  const KV = {};
  for (const r of rows) { try { KV[r.key] = JSON.parse(r.value); } catch { KV[r.key] = r.value; } }
  console.log(`✓ Legacy archive read (${rows.length} kv rows)\n`);

  // 2. Load hyroxdev identities (names → ids), plans, and plan structure.
  const teams    = must("teams",    await dev.from("teams").select("id,name").in("name", Object.keys(TEAM_KV_PREFIX)));
  const teamId   = Object.fromEntries(teams.map(t => [t.name, t.id]));

  const athletes = must("athletes", await dev.from("athletes").select("id,name").in("name", Object.keys(ATHLETE_MAP)));
  const athIdByName = Object.fromEntries(athletes.map(a => [a.name, a.id]));

  // one plan per team (take the newest if more than one exists)
  const planByTeam = {};
  for (const [name, tid] of Object.entries(teamId)) {
    const plans = must("plans", await dev.from("plans").select("id,generated_at").eq("team_id", tid).order("generated_at", { ascending: false }));
    if (!plans.length) { console.error(`✗ No plan for team ${name}`); process.exit(1); }
    if (plans.length > 1) console.log(`  ⚠ team ${name} has ${plans.length} plans — using newest (${plans[0].id})`);
    planByTeam[name] = plans[0].id;
  }

  // For each plan: weekMap (weekNum→weekId), dayCache ("weekNum-Day"→dayId),
  //                entryLookup ("dayId-athId"→entryId), entryWeek (entryId→weekNum)
  const structure = {}; // teamName → { ... }
  const entryTeamWeek = {}; // entryId → "Team wN"  (for before/after counting)
  for (const [name, planId] of Object.entries(planByTeam)) {
    const weeks   = must("plan_weeks", await dev.from("plan_weeks").select("id,week_number").eq("plan_id", planId));
    const weekMap = Object.fromEntries(weeks.map(w => [w.week_number, w.id]));
    const dayCache = {};
    const dayWeek  = {}; // dayId → weekNum
    for (const w of weeks) {
      const days = must("plan_days", await dev.from("plan_days").select("id,day_of_week").eq("plan_week_id", w.id));
      for (const d of days) { dayCache[`${w.week_number}-${d.day_of_week}`] = d.id; dayWeek[d.id] = w.week_number; }
    }
    const dayIds = Object.values(dayCache);
    const entries = dayIds.length
      ? must("plan_entries", await dev.from("plan_entries").select("id,plan_day_id,athlete_id").in("plan_day_id", dayIds))
      : [];
    const entryLookup = Object.fromEntries(entries.map(e => [`${e.plan_day_id}-${e.athlete_id}`, e.id]));
    for (const e of entries) entryTeamWeek[e.id] = `${name} w${dayWeek[e.plan_day_id]}`;
    structure[name] = { planId, weekMap, dayCache, entryLookup, allWeekIds: weeks.map(w => w.id) };
  }

  const athleteIds = Object.values(athIdByName);

  // 3. BEFORE snapshot — tally logs by team/week using maps we already built
  //    (avoids fragile nested PostgREST embeds / schema-cache relationship errors).
  const countByWeek = async () => {
    const logs = must("count logs", await dev.from("logs").select("plan_entry_id").in("athlete_id", athleteIds));
    const tally = {};
    for (const l of logs) {
      const bucket = entryTeamWeek[l.plan_entry_id] ?? "unmapped";
      tally[bucket] = (tally[bucket] ?? 0) + 1;
    }
    return tally;
  };
  const before = await countByWeek();

  // 4. SCOPED WIPE — logs for these 4 athletes, coach_notes for these 2 plans.
  console.log("Clearing synthetic logs + coach notes (scoped)…");
  const delLogs = must("delete logs", await dev.from("logs").delete().in("athlete_id", athleteIds).select("id"));
  const allWeekIds = Object.values(structure).flatMap(s => s.allWeekIds);
  const delNotes = must("delete notes", await dev.from("coach_notes").delete().in("plan_week_id", allWeekIds).select("id"));
  console.log(`✓ Deleted ${delLogs.length} logs, ${delNotes.length} coach notes\n`);

  // 5. INSERT real logs.
  let logIns = 0; const logSkips = [];
  for (const [aName, map] of Object.entries(ATHLETE_MAP)) {
    const athId = athIdByName[aName];
    const { planId, dayCache, entryLookup } = structure[map.team];
    const blob = KV[`${TEAM_KV_PREFIX[map.team]}-logs-${map.log_key}`] ?? {};
    for (const [wd, entry] of Object.entries(blob)) {
      const p = parseWd(wd); if (!p) continue;
      const dayId = dayCache[`${p.weekNum}-${p.dayOfWeek}`];
      if (!dayId)  { logSkips.push(`${aName} ${wd} (no plan_day)`);  continue; }
      const entryId = entryLookup[`${dayId}-${athId}`];
      if (!entryId){ logSkips.push(`${aName} ${wd} (no plan_entry)`); continue; }
      must(`log ${aName} ${wd}`, await dev.from("logs").insert({
        athlete_id: athId, plan_id: planId, plan_entry_id: entryId,
        done: entry.done ?? false,
        metric: entry.metric || null,
        notes:  entry.notes  || null,
        logged_date: entry.date || null,
      }));
      logIns++;
    }
  }
  console.log(`✓ Inserted ${logIns} real logs${logSkips.length ? `  (⚠ ${logSkips.length} skipped)` : ""}`);
  for (const s of logSkips) console.log(`    ⚠ ${s}`);

  // 6. INSERT coach notes.
  let noteIns = 0; const noteSkips = [];
  for (const [team, prefix] of Object.entries(TEAM_KV_PREFIX)) {
    const { weekMap } = structure[team];
    const notes = KV[`${prefix}-coach-notes`] ?? {};
    for (const [wkStr, body] of Object.entries(notes)) {
      const weekId = weekMap[+wkStr];
      if (!weekId) { noteSkips.push(`${team} w${wkStr} (no plan_week)`); continue; }
      must(`note ${team} w${wkStr}`, await dev.from("coach_notes").insert({
        plan_week_id: weekId, body, updated_at: new Date().toISOString(),
      }));
      noteIns++;
    }
  }
  console.log(`✓ Inserted ${noteIns} coach notes${noteSkips.length ? `  (⚠ ${noteSkips.map(s=>s).join(", ")})` : ""}`);

  // 7. APPLY workout overrides (UPDATE plan_entries in place).
  let ovrApplied = 0; const ovrSkips = [];
  for (const [aName, map] of Object.entries(ATHLETE_MAP)) {
    const athId = athIdByName[aName];
    const { dayCache, entryLookup } = structure[map.team];
    const blob = KV[`${TEAM_KV_PREFIX[map.team]}-workout-overrides`]?.[map.override_key] ?? {};
    for (const [wd, o] of Object.entries(blob)) {
      const p = parseWd(wd); if (!p) continue;
      const dayId = dayCache[`${p.weekNum}-${p.dayOfWeek}`];
      const entryId = dayId ? entryLookup[`${dayId}-${athId}`] : null;
      if (!entryId) { ovrSkips.push(`${aName} ${wd}`); continue; }
      must(`override ${aName} ${wd}`, await dev.from("plan_entries").update({
        label: o.label, detail: o.detail ?? null,
        metric_label: o.metric || null, session_type: inferSessionType(o.label),
      }).eq("id", entryId));
      ovrApplied++;
    }
  }
  console.log(`✓ Applied ${ovrApplied} workout overrides${ovrSkips.length ? `  (⚠ skipped: ${ovrSkips.join(", ")})` : ""}\n`);

  // 8. AFTER snapshot + before/after table.
  const after = await countByWeek();
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  console.log("━━ Log counts by team/week (before → after) ━━");
  for (const k of keys) console.log(`  ${k.padEnd(14)}  ${String(before[k] ?? 0).padStart(2)} → ${String(after[k] ?? 0).padStart(2)}`);
  console.log("\n━━━ Done ━━━");
}

main().catch(e => { console.error(e); process.exit(1); });
