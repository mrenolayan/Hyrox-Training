// ════════════════════════════════════════════════════════════════════════════
//  seed.mjs — Phase 1 dev seed. Run with:  node scripts/seed.mjs
//
//  Proves the multi-athlete model end-to-end against the dev Supabase project:
//   • Team 1: Hung & Andrew (doubles_men, Anaheim) — the 12-week reference plan
//     copied VERBATIM out of src/HyroxHungAndrewAnaheim.jsx (a0/a1 entries).
//   • Team 2: a women's solo athlete (team of one) — intake only, no plan yet
//     (the generator that fills plans is Phase 3).
//   • A few sample logs + one team note, so progress/teammate views have data.
//
//  Uses the anon key (RLS is off during dev). Idempotent: wipes prior seed
//  (delete coaches → cascades to everything) and re-inserts.
// ════════════════════════════════════════════════════════════════════════════
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// ── read env from .env.local (Node doesn't auto-load it) ─────────────────────
const env = Object.fromEntries(
  readFileSync(join(root, ".env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

// ── extract the weekPlan array verbatim from the reference .jsx ───────────────
function loadReferenceWeekPlan() {
  const src = readFileSync(join(root, "src/HyroxHungAndrewAnaheim.jsx"), "utf8");
  const start = src.indexOf("const weekPlan = [");
  if (start === -1) throw new Error("weekPlan not found in reference file");
  // find the closing "];" that ends the array (first line that is exactly "];")
  const after = src.slice(start);
  const endRel = after.indexOf("\n];");
  const literal = after.slice(after.indexOf("["), endRel + 2); // include the "]"
  // The array is pure data literals (objects/strings/booleans/null) — safe to eval.
  // eslint-disable-next-line no-new-func
  return Function(`"use strict"; return (${literal});`)();
}

const STATIONS = [
  "ski_erg", "sled_push", "sled_pull", "burpee_broad_jumps", "row",
  "farmers_carry", "sandbag_lunges", "wall_balls", "running",
];
const ratingsFor = (map) => STATIONS.map((s) => ({ station: s, rating: map[s] || "okay" }));

const must = (label, { data, error }) => {
  if (error) { console.error(`✗ ${label}:`, error.message); process.exit(1); }
  return data;
};

async function main() {
  console.log("Wiping prior seed (delete coaches → cascade)…");
  // delete all coaches; FK cascades clear teams/athletes/plans/logs/etc.
  await supabase.from("coaches").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  // ── coach ──────────────────────────────────────────────────────────────────
  const coach = must("coach", await supabase
    .from("coaches").insert({ name: "Reno", email: "mrenolayan@gmail.com" })
    .select().single());
  console.log("✓ coach", coach.id);

  // ── TEAM 1: Hung & Andrew (doubles_men, Anaheim) ─────────────────────────────
  const team = must("team", await supabase
    .from("teams").insert({
      coach_id: coach.id, name: "Hung & Andrew", format_id: "doubles_men", units: "metric",
    }).select().single());

  // athletes a0=Hung, a1=Andrew
  const [hung, andrew] = must("athletes", await supabase
    .from("athletes").insert([
      { coach_id: coach.id, name: "Hung",   color: "#60a5fa", role: "Power lead · heavy stations", run_pace: "6:00/km", longest_run: 14 },
      { coach_id: coach.id, name: "Andrew", color: "#6ee7b7", role: "Pace lead · machines",        run_pace: "5:30/km", longest_run: 18 },
    ]).select());

  must("profiles", await supabase.from("athlete_profiles").insert([
    { athlete_id: hung.id,   known_weights: "Squat 140kg, DL 180kg", injuries_notes: "L knee niggle on deep lunges" },
    { athlete_id: andrew.id, known_weights: "Squat 120kg, sub-20 5k", team_split_notes: "Takes machines + wall balls" },
  ]));

  must("ratings", await supabase.from("station_ratings").insert([
    ...ratingsFor({ sled_push: "strength", sled_pull: "strength", sandbag_lunges: "strength", running: "weak", row: "okay" })
      .map((r) => ({ athlete_id: hung.id, ...r })),
    ...ratingsFor({ running: "strength", ski_erg: "strength", row: "strength", wall_balls: "okay", sled_push: "weak" })
      .map((r) => ({ athlete_id: andrew.id, ...r })),
  ]));

  must("modalities", await supabase.from("athlete_modalities").insert([
    { athlete_id: hung.id, modality: "crossfit" }, { athlete_id: hung.id, modality: "lifting" },
    { athlete_id: andrew.id, modality: "running_club" }, { athlete_id: andrew.id, modality: "hiit" },
  ]));

  must("team_members", await supabase.from("team_members").insert([
    { team_id: team.id, athlete_id: hung.id }, { team_id: team.id, athlete_id: andrew.id },
  ]));

  // plan (team-owned)
  const plan = must("plan", await supabase.from("plans").insert({
    team_id: team.id, weeks: 12, days_per_week: 5, start_iso: "2026-09-14",
    race_name: "HYROX Anaheim", race_city: "Anaheim", race_iso: "2026-12-04T07:00:00",
    status: "active", generated_at: new Date().toISOString(),
  }).select().single());

  // ── plan tree: weeks → days → entries (a0=Hung, a1=Andrew) ───────────────────
  const weekPlan = loadReferenceWeekPlan();
  const idxAthlete = { a0: hung.id, a1: andrew.id };
  let entryCount = 0;
  const firstWeekEntryByAthlete = {}; // for sample logs

  for (const w of weekPlan) {
    const week = must(`week ${w.week}`, await supabase.from("plan_weeks").insert({
      plan_id: plan.id, week_number: w.week, phase: w.phase, focus: w.focus,
    }).select().single());

    for (const d of w.days) {
      const day = must(`day ${w.week}/${d.day}`, await supabase.from("plan_days").insert({
        plan_week_id: week.id, day_of_week: d.day,
        shared: !!d.shared, optional: !!d.optional,
      }).select().single());

      const entries = [];
      for (const key of ["a0", "a1"]) {
        const e = d[key];
        if (!e) continue;
        entries.push({
          plan_day_id: day.id, athlete_id: idxAthlete[key],
          session_type: e.type, label: e.label, detail: e.detail ?? null,
          metric_label: e.metric ?? null,
        });
      }
      const inserted = must(`entries ${w.week}/${d.day}`,
        await supabase.from("plan_entries").insert(entries).select());
      entryCount += inserted.length;

      if (w.week === 1) {
        for (const row of inserted) firstWeekEntryByAthlete[row.athlete_id] ??= [];
        for (const row of inserted) firstWeekEntryByAthlete[row.athlete_id].push(row);
      }
    }
  }

  // ── sample logs: first 2 logged sessions each, week 1 ────────────────────────
  const sampleLogs = [];
  for (const [athleteId, rows] of Object.entries(firstWeekEntryByAthlete)) {
    for (const row of rows.filter((r) => r.session_type !== "rest").slice(0, 2)) {
      sampleLogs.push({
        athlete_id: athleteId, plan_id: plan.id, plan_entry_id: row.id,
        done: true, metric: athleteId === hung.id ? "6:05" : "5:32",
        notes: "Felt good.", logged_date: "2026-09-15",
      });
    }
  }
  const logs = must("logs", await supabase.from("logs").insert(sampleLogs).select());

  // one team note: Andrew reacts to Hung's first log
  const hungLog = logs.find((l) => l.athlete_id === hung.id);
  if (hungLog) must("team_note", await supabase.from("team_notes").insert({
    log_id: hungLog.id, author_athlete_id: andrew.id, body: "Strong start 💪", reaction: "🔥",
  }));

  // coach note on week 1
  const w1 = must("w1 lookup", await supabase
    .from("plan_weeks").select("id").eq("plan_id", plan.id).eq("week_number", 1).single());
  must("coach_note", await supabase.from("coach_notes").insert({
    plan_week_id: w1.id, body: "Ease in this week — pacing discipline over heroics.",
  }));

  // ── TEAM 2: women's solo (team of one), intake only ──────────────────────────
  const soloTeam = must("solo team", await supabase.from("teams").insert({
    coach_id: coach.id, name: "Maya Okafor", format_id: "womens_solo", units: "metric",
  }).select().single());
  const maya = must("maya", await supabase.from("athletes").insert({
    coach_id: coach.id, name: "Maya Okafor", color: "#f0a0b4",
    role: "Solo · all-rounder", run_pace: "5:50/km", longest_run: 12,
  }).select().single());
  must("maya profile", await supabase.from("athlete_profiles").insert({
    athlete_id: maya.id, known_weights: "Squat 90kg", injuries_notes: "None",
  }));
  must("maya ratings", await supabase.from("station_ratings").insert(
    ratingsFor({ wall_balls: "weak", sled_pull: "weak", running: "strength", ski_erg: "okay" })
      .map((r) => ({ athlete_id: maya.id, ...r }))));
  must("maya modalities", await supabase.from("athlete_modalities").insert([
    { athlete_id: maya.id, modality: "yoga_pilates" }, { athlete_id: maya.id, modality: "running_club" },
  ]));
  must("maya member", await supabase.from("team_members").insert({
    team_id: soloTeam.id, athlete_id: maya.id,
  }));
  must("maya plan", await supabase.from("plans").insert({
    team_id: soloTeam.id, weeks: 16, days_per_week: 4, start_iso: "2026-08-17",
    race_name: "HYROX Anaheim", race_city: "Anaheim", race_iso: "2026-12-04T07:00:00",
    status: "draft", // no weeks yet — generator (Phase 3) fills this
  }));

  console.log(`\n✓ Seed complete:`);
  console.log(`  • Team "Hung & Andrew": 2 athletes, ${weekPlan.length}-week plan, ${entryCount} entries, ${logs.length} logs`);
  console.log(`  • Team "Maya Okafor" (womens_solo): intake only, draft plan`);
}

main().catch((e) => { console.error(e); process.exit(1); });
