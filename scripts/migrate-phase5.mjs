// ════════════════════════════════════════════════════════════════════════════
//  migrate-phase5.mjs — re-seed all teams with correct athlete data, generate
//  plans, and migrate historical kv_store logs + notes into the normalized DB.
//
//  Usage:
//    SUPABASE_SERVICE_KEY=<key> node scripts/migrate-phase5.mjs
//
//  Where to get the service key:
//    Supabase dashboard → dev project (Hyrox-dev) → Settings → API → service_role
//    (It's labeled "secret" — keep it out of git.)
//
//  What it does:
//    1. Finds Reno's coach row by email (preserves auth link from Phase 4).
//    2. Wipes all existing teams + athletes for this coach (cascade-clears
//       plans, logs, notes, etc.) then re-seeds with correct intake data.
//    3. Generates 20-week (H&A) + 12-week (DC) + 16-week (Maya) plans.
//    4. Applies kv_store workout overrides → plan_entries.
//    5. Migrates kv_store coach notes → coach_notes table.
//    6. Migrates kv_store athlete logs → logs table.
//
//  IDEMPOTENT: safe to re-run (wipe + reseed is deterministic).
//  DEV ONLY: never point this at the prod project.
// ════════════════════════════════════════════════════════════════════════════
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { generatePlan } from "../src/lib/plan.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// ── Supabase setup ────────────────────────────────────────────────────────────
const env = Object.fromEntries(
  readFileSync(join(root, ".env.local"), "utf8")
    .split("\n")
    .filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SERVICE_KEY) {
  console.error("✗ Set SUPABASE_SERVICE_KEY=<your_dev_service_role_key> before running.");
  console.error("  Find it: Supabase dashboard → Hyrox-dev → Settings → API → service_role");
  process.exit(1);
}

const sb = createClient(env.VITE_SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const must = (label, { data, error }) => {
  if (error) { console.error(`  ✗ ${label}: ${error.message}`); process.exit(1); }
  return data;
};

// ── Historical kv_store data (extracted from prod; hardcoded here) ─────────────
const KV = {
  "hyrox-team-hung-andrew-anaheim-logs-a0": {
    "w1-Mon": { done: true, date: "2026-06-23", metric: "5 rounds about 17mins", notes: "0.5 mile run at speed 7" },
    "w1-Tue": { done: true, date: "2026-06-24", metric: "", notes: "" },
  },
  "hyrox-team-hung-andrew-anaheim-logs-a1": {
    "w1-Mon": { done: true, date: "2026-06-23", metric: "6", notes: "" },
    "w1-Tue": { done: true, date: "2026-06-26", metric: "", notes: "" },
    "w1-Thu": { done: true, date: "2026-06-26" },
  },
  "hyrox-team-hung-andrew-anaheim-coach-notes": {
    "1": "Hi Hung and Andrew! 👋🏽 this program is only designed for 16 weeks, but if you want to start Monday we can do that. Be aware that it's a slow start with a gradual ramp up. If you feel like you can do more workouts I can throw in more optional work so you feel like you've got a good workout in. If the conditioning or HIIT isn't enough for the day, go for a zone 2 run",
  },
  "hyrox-team-hung-andrew-anaheim-workout-overrides": {
    "0": { // Hung
      "w1-Mon": { label: "HIIT", detail: "AMRAP 16:00: 200m run · 10 air squats · 8 burpees. Log your rounds. Moderate intensity — hard but not dying.\n\nPost workout run immediately after.", metric: "Rounds and Reps" },
      "w1-Tue": { label: "Strength A", detail: "Gym. Back squat 4×6 · RDL 3×8 · Walking lunges 3×20/leg · Kettlebell carry 3×100m · Calf raises 3×15.\n\nDid this instead: 3x100 jump ropes, 3x500 skierg, 3x30 dumbbell thrust to shoulder press", metric: "Top weight" },
      "w1-Wed": { label: "Strength B — Leg Day", detail: "Deadlift 4×10\nDumbbell step up 4×10\nDumbbell lunges 6×40ft", metric: "" },
    },
    "1": { // Andrew
      "w1-Fri": { label: "Station Intro — Ground Work", detail: "Home. Sled push 4×12.5m moderate · Wall ball 3×15 (6kg) · Sandbag lunges 3×20m. Learn the movements. If you have time, 15-20 min on a bike or row. Zone 2", metric: "Time / splits" },
    },
  },
  "hyrox-dc-logs-partner": { // Samantha
    "w1-Mon": { done: true, date: "2026-06-17", metric: "6:27/km", notes: "Avg HR: 164 (Z4) - 130-145 target for next run" },
    "w1-Tue": { done: true, date: "2026-06-17", metric: "115lbs", notes: "Back squat: 115lbs, RDL (single leg): 55lbs, Farmers carry: 55lbs each hand" },
    "w1-Thu": { done: true, date: "2026-06-19", metric: "Sled (225lbs) 55s for 4x12.5m / Row 7:15 for 3x500m / Wall Ball 60 reps 2:30", notes: "Row splits 2:25/500m / Unbroken wall ball 25reps/54s, 20reps/52s, 15reps/40s" },
    "w1-Sat": { done: true, date: "2026-06-20", metric: "8:21/km", notes: "Avg HR: 145" },
    "w2-Mon": { done: true, date: "2026-06-22", metric: "125lbs", notes: "Back squat: 125lbs, RDL: 105lbs, Lunges: 50lb sandbag, Farmers carry: 50lbs each hand, wall balls: 16lbs" },
    "w2-Tue": { done: true, date: "2026-06-23", metric: "9:02/km", notes: "Stroller run - avg HR: 146" },
    "w2-Wed": { done: true, date: "2026-06-25", metric: "6 rounds", notes: "Per 200m+squats+lunges+burpees 2:33, 2:33, 2:27, 2:45, 2:50, 2:43" },
    "w2-Fri": { done: true, date: "2026-06-26", metric: "Pace per 400m: 5:30, 5:25, 5:28, 5:31", notes: "Total workout time: 40 mins" },
  },
  "hyrox-dc-logs-reece": {
    "w1-Mon": { done: true, date: "2026-06-17", metric: "6:27/km", notes: "" },
    "w1-Tue": { done: true, date: "2026-06-17", metric: "135 squats, 55lb single leg RDLs, 55lb kettlebell carry each arm", notes: "" },
    "w1-Thu": { done: true, date: "2026-06-19", metric: "Sled (225lbs) 55s for 4x12.5m / Row 7:15 for 3x500m / Wall Ball 40 reps 1:30", notes: "Row splits 2:21/500m / Unbroken wall ball 10reps/24s, 15reps/33s, 15reps/36s. Thursday was rest day. Friday workout due to schedule." },
    "w1-Sat": { done: false, date: "2026-06-20", metric: "", notes: "" },
    "w2-Mon": { done: true, date: "2026-06-23", metric: "145 squats, 135 RDLs, 50lb walking lunges, 50lb kettlebell carry each arm", notes: "Squats felt better — will aim to increase again next set." },
    "w2-Tue": { done: true, date: "2026-06-24" },
    "w2-Fri": { done: true, date: "2026-06-26", metric: "205 deadlift, 75lb rows, 25lb dumbbell each arm lunges — accomplished Thursday", notes: "Focused primarily on form for deadlift since it's been a while since I last did them." },
  },
  "hyrox-dc-coach-notes": {
    "1": "Thanks for your flexibility this week. Hopefully the programming is going well. Should be a ramp up week, listen to your body and how it feels. Let me know if you need more or less intensity in the programming.",
    "2": "Increase your Strength A this week by 5 to 10 lbs from last week.",
  },
  "hyrox-dc-workout-overrides": {
    "reece": {
      "w2-Wed": { label: "Optional — Conditioning", detail: "3×10 Strict Press, rest then…\nAMRAP 16:00: 200m run · 12 air squats · 10 walking lunges · 8 burpees. Steady rounds. Easy intro conditioning — smooth and controlled, not a sprint. Optional.", metric: "Rounds / time" },
    },
    "partner": {},
  },
};

// ── Station ratings helper ─────────────────────────────────────────────────────
const STATIONS = ["ski_erg","sled_push","sled_pull","burpee_broad_jumps","row","farmers_carry","sandbag_lunges","wall_balls","running"];
const ratings = (map) => STATIONS.map(s => ({ station: s, rating: map[s] || "okay" }));

// ── Team + athlete definitions (source of truth from intake forms) ────────────
const TEAMS = [
  {
    team:    { name: "Hung & Andrew — Anaheim", format_id: "doubles_men",   units: "metric" },
    plan:    { weeks: 20, days_per_week: 5, start_iso: "2026-06-23", race_name: "HYROX Anaheim",      race_city: "Anaheim",          race_iso: "2026-12-04T07:00:00", status: "active" },
    athletes: [
      {
        row:      { name: "Hung",   color: "#60a5fa", role: "Power lead · Ski, Row, Farmers",       run_pace: "5:17/km", longest_run: 11 },
        ratings:  ratings({ ski_erg: "strength", sled_push: "weak", sled_pull: "okay", burpee_broad_jumps: "okay", row: "strength", farmers_carry: "strength", sandbag_lunges: "okay", wall_balls: "okay", running: "okay" }),
        profile:  { known_weights: null, team_split_notes: "Power stations", injuries_notes: null },
        kv_log_key:      "a0",
        kv_override_key: "0",
      },
      {
        row:      { name: "Andrew", color: "#a78bfa", role: "Pace lead · Stations",                 run_pace: "6:13/km", longest_run: 21 },
        ratings:  ratings({ ski_erg: "weak", sled_push: "weak", sled_pull: "weak", burpee_broad_jumps: "weak", row: "okay", farmers_carry: "weak", sandbag_lunges: "weak", wall_balls: "weak", running: "okay" }),
        profile:  { known_weights: null, team_split_notes: "Don't know", injuries_notes: "Works minimum 8 hours a day, 7:30am–7:30pm" },
        kv_log_key:      "a1",
        kv_override_key: "1",
      },
    ],
    kv_prefix: "hyrox-team-hung-andrew-anaheim",
  },
  {
    team:    { name: "Reece & Samantha — DC", format_id: "mixed_doubles",  units: "metric" },
    plan:    { weeks: 12, days_per_week: 5, start_iso: "2026-06-16", race_name: "HYROX Washington D.C.", race_city: "Washington D.C.", race_iso: "2026-09-03T07:00:00", status: "active" },
    athletes: [
      {
        row:      { name: "Reece",    color: "#f59e0b", role: "Power lead · Sled, Sandbag",          run_pace: "6:27/km", longest_run: 8 },
        ratings:  ratings({ sled_push: "strength", sled_pull: "strength", sandbag_lunges: "strength" }),
        profile:  { known_weights: null, team_split_notes: "Power stations", injuries_notes: null },
        kv_log_key:      "reece",
        kv_override_key: "reece",
      },
      {
        row:      { name: "Samantha", color: "#fb7185", role: "Pace lead · Wall Balls, BBJ",         run_pace: "6:27/km", longest_run: 5 },
        ratings:  ratings({ sled_push: "weak", sled_pull: "weak", sandbag_lunges: "weak", wall_balls: "strength", burpee_broad_jumps: "strength" }),
        profile:  { known_weights: null, team_split_notes: "Pace stations", injuries_notes: null },
        kv_log_key:      "partner",
        kv_override_key: "partner",
      },
    ],
    kv_prefix: "hyrox-dc",
  },
  {
    team:    { name: "Maya Okafor",             format_id: "womens_solo",   units: "metric" },
    plan:    { weeks: 16, days_per_week: 4, start_iso: "2026-08-17", race_name: "HYROX Anaheim",      race_city: "Anaheim",          race_iso: "2026-12-04T07:00:00", status: "draft" },
    athletes: [
      {
        row:      { name: "Maya Okafor", color: "#f0a0b4", role: "Solo · all-rounder",               run_pace: "5:50/km", longest_run: 12 },
        ratings:  ratings({ wall_balls: "weak", sled_pull: "weak", running: "strength", ski_erg: "okay" }),
        profile:  { known_weights: "Squat 90kg", team_split_notes: null, injuries_notes: "None" },
        kv_log_key:      null, // no kv data
        kv_override_key: null,
      },
    ],
    kv_prefix: null, // no kv data
  },
];

// ── Guess session_type from a coach override label ────────────────────────────
function inferSessionType(label) {
  const l = label.toLowerCase();
  if (l.includes("strength") || l.includes("deadlift") || l.includes("squat")) return "strength";
  if (l.includes("station") || l.includes("circuit") || l.includes("sled")) return "stations";
  if (l.includes("hiit") || l.includes("amrap") || l.includes("conditioning")) return "conditioning";
  if (l.includes("run")) return "run_easy";
  return "together";
}

// ── savePlanTree (reimplemented for service-role client) ──────────────────────
async function savePlanTree(planId, generatedWeeks) {
  let totalDays = 0, totalEntries = 0;
  for (const wk of generatedWeeks) {
    const { data: weekRows } = await sb.from("plan_weeks")
      .upsert({ plan_id: planId, week_number: wk.week_number, phase: wk.phase, focus: wk.focus },
               { onConflict: "plan_id,week_number" }).select("id");
    const weekId = weekRows?.[0]?.id;
    for (const d of wk.days ?? []) {
      const { data: dayRows } = await sb.from("plan_days")
        .upsert({ plan_week_id: weekId, day_of_week: d.day_of_week, shared: d.shared, optional: d.optional },
                 { onConflict: "plan_week_id,day_of_week" }).select("id");
      const dayId = dayRows?.[0]?.id;
      totalDays++;
      const toUpsert = (d.entries ?? []).map(e => ({
        plan_day_id: dayId, athlete_id: e.athlete_id,
        session_type: e.session_type, label: e.label,
        detail: e.detail ?? null, metric_label: e.metric_label ?? null,
      }));
      if (toUpsert.length) {
        const { data: ins } = await sb.from("plan_entries")
          .upsert(toUpsert, { onConflict: "plan_day_id,athlete_id" }).select("id");
        totalEntries += ins?.length ?? 0;
      }
    }
  }
  return { weeks: generatedWeeks.length, days: totalDays, entries: totalEntries };
}

// ── Parse kv week-day key: "w1-Mon" → { weekNum: 1, dayOfWeek: "Mon" } ───────
function parseWd(key) {
  const m = key.match(/^w(\d+)-(.+)$/);
  return m ? { weekNum: parseInt(m[1], 10), dayOfWeek: m[2] } : null;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("━━━ Phase 5 Migration ━━━\n");

  // 1. Find Reno's coach row (preserves auth link from Phase 4)
  const { data: coaches } = await sb.from("coaches").select("id,name,user_id").eq("email", "mrenolayan@gmail.com");
  if (!coaches?.length) { console.error("✗ Coach not found — run the app and log in first."); process.exit(1); }
  const coach = coaches[0];
  console.log(`✓ Coach: ${coach.name} (id: ${coach.id}, user_id: ${coach.user_id ?? "⚠ not linked"})\n`);

  // 2. Wipe existing teams + athletes for this coach (cascade clears everything)
  console.log("Clearing existing teams + athletes…");
  must("clear teams",   await sb.from("teams").delete().eq("coach_id", coach.id));
  must("clear athletes", await sb.from("athletes").delete().eq("coach_id", coach.id));
  console.log("✓ Cleared\n");

  // 3. Seed + generate + migrate each team
  for (const cfg of TEAMS) {
    console.log(`━━ ${cfg.team.name} ━━`);

    // 3a. Team
    const team = must("team", await sb.from("teams")
      .insert({ ...cfg.team, coach_id: coach.id }).select().single());
    console.log(`  ✓ team ${team.id}`);

    // 3b. Athletes + profiles + ratings + team_members
    const athleteIds = {}; // name → uuid
    for (const a of cfg.athletes) {
      const ath = must("athlete", await sb.from("athletes")
        .insert({ ...a.row, coach_id: coach.id }).select().single());
      athleteIds[a.row.name] = ath.id;
      must("profile", await sb.from("athlete_profiles").insert({ athlete_id: ath.id, ...a.profile }));
      must("ratings", await sb.from("station_ratings").insert(a.ratings.map(r => ({ athlete_id: ath.id, ...r }))));
      must("member",  await sb.from("team_members").insert({ team_id: team.id, athlete_id: ath.id }));
      console.log(`  ✓ athlete ${a.row.name} (${ath.id})`);
    }

    // 3c. Plan
    const plan = must("plan", await sb.from("plans")
      .insert({ ...cfg.plan, team_id: team.id, generated_at: new Date().toISOString() }).select().single());
    console.log(`  ✓ plan ${plan.id} (${plan.weeks}wk)`);

    // 3d. Generate + save plan tree
    const athRows = cfg.athletes.map(a => ({
      id:              athleteIds[a.row.name],
      name:            a.row.name,
      color:           a.row.color,
      role:            a.row.role,
      run_pace:        a.row.run_pace,
      longest_run:     a.row.longest_run,
      station_ratings: a.ratings,
      athlete_profiles: [a.profile],
    }));
    const generated = generatePlan(team, plan, athRows);
    const counts = await savePlanTree(plan.id, generated.weeks);
    console.log(`  ✓ plan tree saved (${counts.weeks} wks, ${counts.days} days, ${counts.entries} entries)`);

    // Skip kv migration if this team has no prod data
    if (!cfg.kv_prefix) { console.log(); continue; }

    // 3e. Build plan_day lookup: { "w1-Mon": dayId, ... }
    const { data: allWeeks } = await sb.from("plan_weeks").select("id,week_number").eq("plan_id", plan.id);
    const weekMap = Object.fromEntries(allWeeks.map(w => [w.week_number, w.id]));
    const planDayCache = {}; // "weekNum-Day" → dayId
    for (const [weekNum, weekId] of Object.entries(weekMap)) {
      const { data: days } = await sb.from("plan_days").select("id,day_of_week").eq("plan_week_id", weekId);
      for (const d of days) planDayCache[`${weekNum}-${d.day_of_week}`] = d.id;
    }

    // 3f. Build plan_entry lookup: { "dayId-athleteId": entryId }
    const allDayIds = Object.values(planDayCache);
    const { data: allEntries } = await sb.from("plan_entries").select("id,plan_day_id,athlete_id").in("plan_day_id", allDayIds);
    const entryLookup = Object.fromEntries(allEntries.map(e => [`${e.plan_day_id}-${e.athlete_id}`, e]));

    // 3g. Apply workout overrides → update plan_entries
    const overrides = KV[`${cfg.kv_prefix}-workout-overrides`] ?? {};
    let overrideCount = 0;
    for (const a of cfg.athletes) {
      if (!a.kv_override_key) continue;
      const athId = athleteIds[a.row.name];
      const athOverrides = overrides[a.kv_override_key] ?? {};
      for (const [wdKey, override] of Object.entries(athOverrides)) {
        const wd = parseWd(wdKey);
        if (!wd) continue;
        const dayId = planDayCache[`${wd.weekNum}-${wd.dayOfWeek}`];
        if (!dayId) { console.log(`  ⚠ override ${a.row.name} ${wdKey}: no plan_day`); continue; }
        const existing = entryLookup[`${dayId}-${athId}`];
        if (!existing) { console.log(`  ⚠ override ${a.row.name} ${wdKey}: no plan_entry`); continue; }
        must(`override ${a.row.name} ${wdKey}`, await sb.from("plan_entries").update({
          label:        override.label,
          detail:       override.detail ?? null,
          metric_label: override.metric || null,
          session_type: inferSessionType(override.label),
        }).eq("id", existing.id));
        overrideCount++;
      }
    }
    console.log(`  ✓ ${overrideCount} workout overrides applied`);

    // 3h. Migrate coach notes
    const coachNotes = KV[`${cfg.kv_prefix}-coach-notes`] ?? {};
    let noteCount = 0;
    for (const [weekNumStr, body] of Object.entries(coachNotes)) {
      const weekNum = parseInt(weekNumStr, 10);
      const weekId = weekMap[weekNum];
      if (!weekId) { console.log(`  ⚠ coach note week ${weekNum}: no plan_week`); continue; }
      must(`coach_note w${weekNum}`, await sb.from("coach_notes")
        .upsert({ plan_week_id: weekId, body, updated_at: new Date().toISOString() },
                 { onConflict: "plan_week_id" }));
      noteCount++;
    }
    console.log(`  ✓ ${noteCount} coach notes migrated`);

    // 3i. Migrate athlete logs
    let logCount = 0, logSkipped = 0;
    for (const a of cfg.athletes) {
      if (!a.kv_log_key) continue;
      const athId = athleteIds[a.row.name];
      const logData = KV[`${cfg.kv_prefix}-logs-${a.kv_log_key}`] ?? {};
      for (const [wdKey, logEntry] of Object.entries(logData)) {
        const wd = parseWd(wdKey);
        if (!wd) continue;
        const dayId = planDayCache[`${wd.weekNum}-${wd.dayOfWeek}`];
        if (!dayId) { console.log(`  ⚠ log ${a.row.name} ${wdKey}: no plan_day (skipped)`); logSkipped++; continue; }
        const planEntry = entryLookup[`${dayId}-${athId}`];
        if (!planEntry) { console.log(`  ⚠ log ${a.row.name} ${wdKey}: no plan_entry (skipped)`); logSkipped++; continue; }
        must(`log ${a.row.name} ${wdKey}`, await sb.from("logs").upsert({
          athlete_id:    athId,
          plan_id:       plan.id,
          plan_entry_id: planEntry.id,
          done:          logEntry.done ?? false,
          metric:        logEntry.metric || null,
          notes:         logEntry.notes || null,
          logged_date:   logEntry.date || null,
        }, { onConflict: "athlete_id,plan_entry_id" }));
        logCount++;
      }
    }
    console.log(`  ✓ ${logCount} logs migrated${logSkipped ? `, ${logSkipped} skipped (no matching plan_day)` : ""}`);
    console.log();
  }

  console.log("━━━ Done ━━━");
}

main().catch(e => { console.error(e); process.exit(1); });
