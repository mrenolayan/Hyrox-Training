// ════════════════════════════════════════════════════════════════════════════
//  import-real-plans.mjs — replace hyroxdev's generic generator sessions with
//  Reno's REAL hand-authored plans, extracted straight from the legacy JSX.
//
//  WHY
//    hyroxdev's plan_entries were built by generatePlan() (generic filler). The
//    actual programmed workouts (e.g. Samantha's wk3 4×800m track session) live
//    in the legacy per-client files:
//      - src/HyroxTrainer.jsx            → Walker DC  (keys r=Reece, p=Samantha)
//      - src/HyroxHungAndrewAnaheim.jsx  → Anaheim    (keys a0=Hung, a1=Andrew)
//    Both cover weeks 1–12. This script reads those weekPlan arrays directly (no
//    transcription) and UPDATEs the matching plan_entries in place.
//
//  SCOPE
//    ✔ plan_entries.label / detail / metric_label / session_type  (weeks 1–12)
//    �’ plan_weeks / plan_days / logs / athletes / teams — untouched
//    Anaheim weeks 13–20 have no JSX source, so they are left as-is (generated).
//
//  ORDER: run this FIRST, then re-apply the 17 coach overrides (they layer on top
//  of the base plan and this import would otherwise revert those days).
//
//  Usage:
//    node scripts/import-real-plans.mjs --dry-run          # parse + preview, no DB
//    SUPABASE_SERVICE_KEY=<hyroxdev service_role> node scripts/import-real-plans.mjs
// ════════════════════════════════════════════════════════════════════════════
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const DRY = process.argv.includes("--dry-run");

const env = Object.fromEntries(
  readFileSync(join(root, ".env.local"), "utf8")
    .split("\n").filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const TEAMS = [
  {
    file: "src/HyroxTrainer.jsx", team: "Walker DC",
    plan_id: "a09afc5a-4b61-4f6c-b488-c772e01fc30c",
    keys: { r: { name: "Reece",    id: "52c91b0b-1213-43b7-a28a-79f9521f5f99" },
            p: { name: "Samantha", id: "6792a334-5172-4f0f-9935-64a6ab2d7c42" } },
  },
  {
    file: "src/HyroxHungAndrewAnaheim.jsx", team: "Anaheim",
    plan_id: "a296336a-b1ef-4415-b02a-46467e54a8cc",
    keys: { a0: { name: "Hung",   id: "690df2d1-4629-4a18-9797-747e54771487" },
            a1: { name: "Andrew", id: "11a4ffe6-65b3-4b3c-940c-c8a5da929a3f" } },
  },
];

// ── Extract the `const weekPlan = [ ... ]` array literal by balancing brackets
//    while skipping string contents, then evaluate it (data-only literal).
function extractWeekPlan(relPath) {
  const src = readFileSync(join(root, relPath), "utf8");
  const marker = "const weekPlan = [";
  const start = src.indexOf(marker);
  if (start < 0) throw new Error(`weekPlan not found in ${relPath}`);
  let j = start + marker.length - 1;         // index of the opening '['
  const open = j;
  let depth = 0, inStr = null, esc = false;
  for (; j < src.length; j++) {
    const c = src[j];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === inStr) inStr = null;
    } else if (c === '"' || c === "'" || c === "`") inStr = c;
    else if (c === "[") depth++;
    else if (c === "]" && --depth === 0) { j++; break; }
  }
  const arrText = src.slice(open, j);
  return new Function(`return ${arrText}`)();
}

// ── Flatten a team's weekPlan into per-athlete update rows.
function rowsFor(cfg) {
  const plan = extractWeekPlan(cfg.file);
  const rows = [];
  for (const wk of plan) {
    for (const d of wk.days ?? []) {
      for (const [key, ath] of Object.entries(cfg.keys)) {
        const s = d[key];
        if (!s) continue;                       // athlete has no session that day
        rows.push({
          athlete_id: ath.id, athlete: ath.name,
          week: wk.week, day: d.day,
          session_type: s.type, label: s.label,
          detail: s.detail ?? null, metric_label: s.metric ?? null,
        });
      }
    }
  }
  return rows;
}

async function main() {
  console.log(`━━━ Import real hand-authored plans → hyroxdev ${DRY ? "(DRY RUN)" : ""} ━━━\n`);

  const all = TEAMS.map(cfg => ({ cfg, rows: rowsFor(cfg) }));
  for (const { cfg, rows } of all) {
    const weeks = new Set(rows.map(r => r.week));
    console.log(`${cfg.team}: ${rows.length} sessions across weeks ${Math.min(...weeks)}–${Math.max(...weeks)}`);
  }

  // sanity preview — the session that started all this
  const sam = all.find(a => a.cfg.team === "Walker DC")
    .rows.find(r => r.athlete === "Samantha" && r.week === 3 && r.day === "Mon");
  console.log(`\n  preview · Samantha wk3 Mon → "${sam?.label}" | ${String(sam?.detail).slice(0, 70)}…\n`);

  if (DRY) { console.log("Dry run — no DB writes. Re-run without --dry-run (with SUPABASE_SERVICE_KEY) to apply."); return; }

  const KEY = process.env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_KEY;
  if (!KEY) { console.error("✗ Set SUPABASE_SERVICE_KEY (env var or a line in .env.local), or use --dry-run."); process.exit(1); }
  if (!env.VITE_SUPABASE_URL?.includes("oszfkbgqshyimbbwntfq")) {
    console.error(`✗ .env.local is not hyroxdev (${env.VITE_SUPABASE_URL}). Refusing.`); process.exit(1);
  }
  const sb = createClient(env.VITE_SUPABASE_URL, KEY, { auth: { persistSession: false } });

  for (const { cfg, rows } of all) {
    // build (week-day-athlete) → plan_entry_id lookup for this plan
    const { data: weeks } = await sb.from("plan_weeks").select("id,week_number").eq("plan_id", cfg.plan_id);
    const weekMap = Object.fromEntries(weeks.map(w => [w.week_number, w.id]));
    const dayCache = {};
    for (const w of weeks) {
      const { data: days } = await sb.from("plan_days").select("id,day_of_week").eq("plan_week_id", w.id);
      for (const d of days) dayCache[`${w.week_number}-${d.day_of_week}`] = d.id;
    }
    const dayIds = Object.values(dayCache);
    const { data: entries } = await sb.from("plan_entries").select("id,plan_day_id,athlete_id").in("plan_day_id", dayIds);
    const entryLookup = Object.fromEntries(entries.map(e => [`${e.plan_day_id}-${e.athlete_id}`, e.id]));

    let updated = 0; const skips = [];
    for (const r of rows) {
      const dayId = dayCache[`${r.week}-${r.day}`];
      const entryId = dayId ? entryLookup[`${dayId}-${r.athlete_id}`] : null;
      if (!entryId) { skips.push(`${r.athlete} w${r.week}-${r.day}`); continue; }
      const { error } = await sb.from("plan_entries").update({
        session_type: r.session_type, label: r.label,
        detail: r.detail, metric_label: r.metric_label,
      }).eq("id", entryId);
      if (error) { console.error(`  ✗ ${r.athlete} w${r.week}-${r.day}: ${error.message}`); process.exit(1); }
      updated++;
    }
    console.log(`✓ ${cfg.team}: ${updated} plan_entries updated${skips.length ? `  (⚠ ${skips.length} skipped: ${skips.join(", ")})` : ""}`);
  }
  console.log("\n━━━ Done. Now re-apply the 17 coach overrides on top. ━━━");
}

main().catch(e => { console.error(e); process.exit(1); });
