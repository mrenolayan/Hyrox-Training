// ════════════════════════════════════════════════════════════════════════════
//  plan.js — hybrid plan generator. Pure business logic: no React, no Supabase.
//
//  generatePlan(team, plan, athletes) → { weeks: [...] }
//  Each week: { week_number, phase, focus, days: [{day_of_week, shared, optional, entries}] }
//  Each entry: { athlete_id, session_type, label, detail, metric_label }
//
//  The caller persists via db.savePlanTree(planId, generatedWeeks).
//  Manual coach tweaks survive regeneration because entries upsert on
//  (plan_day_id, athlete_id) — only untouched days are overwritten.
// ════════════════════════════════════════════════════════════════════════════
import { parsePace, paceLabel } from "./pace.js";

// ─── Editable constants ──────────────────────────────────────────────────────

// Phase assignments + deload weeks for each supported plan length.
// Edit these to change the deload cadence or phase boundaries.
const RHYTHM = {
   8: { deloads: new Set([3]),            phaseOf: w => w <= 3 ? 1 : w <= 5 ? 2 : 3 },
  12: { deloads: new Set([4, 8]),         phaseOf: w => w <= 4 ? 1 : w <= 9 ? 2 : 3 },
  16: { deloads: new Set([4, 8, 12]),     phaseOf: w => w <= 6 ? 1 : w <= 13 ? 2 : 3 },
  20: { deloads: new Set([4, 8, 12, 16]), phaseOf: w => w <= 8 ? 1 : w <= 17 ? 2 : 3 },
};

// The final 3 weeks of any plan are always: race-sim → sharpen → race week.
const PEAK_TAIL = 3;

// Week focus lines (coach can override via coach_notes after generation).
const FOCUS = {
  deload: "Deload. Recover and adapt. Three sessions, lighter loads.",
  race:    "RACE WEEK. Protect the legs. Trust the work.",
  sharpen: "Sharpen. Fix what the race sim exposed.",
  raceSim: "RACE SIMULATION week. Full dress rehearsal.",
  base: [
    "Ease in. Build the aerobic base.",
    "Twice-weekly strength. Introduce station skills.",
    "Stations land midweek. First conditioning piece.",
    "Strength + station circuit + long run.",
    "Push the volume, hold aerobic pace.",
    "Long run climbs. Strength stays consistent.",
    "Station intensity up. Conditioning optional.",
    "Aerobic peak for Base phase.",
  ],
  build: [
    "Bricks begin. Run-to-station fatigue work.",
    "New shape: split strength, dedicated sled day.",
    "Midweek brick, conditioning Friday. Mix it up.",
    "Peak build week. Everything at race intensity.",
    "Station volume climbs. Hold race pace on bricks.",
    "Max load week. Earned it.",
    "Race-pace bricks. Lock in transitions.",
    "Final hard push before taper.",
    "Last build week. Arrive at peak/taper ready.",
  ],
};

const TEAM_FORMATS = new Set([
  "doubles_men", "doubles_women", "mixed_doubles",
  "relay_men", "relay_women", "relay_mixed",
]);

// ─── Entry builders ──────────────────────────────────────────────────────────

function entry(athleteId, session_type, label, detail, metric_label) {
  return { athlete_id: athleteId, session_type, label, detail: detail || null, metric_label: metric_label || null };
}

function rest(athleteId) {
  return entry(athleteId, "rest", "Rest / Mobility", "Recovery. Light stretching or foam roll.", null);
}

function runEntries(athletes, km, baseDecKm, isTeam, sessionType) {
  const lo = paceLabel(baseDecKm);
  const hi = paceLabel(baseDecKm + 0.3);
  const label = `${sessionType === "together" ? "Team Run" : "Easy Run"} ${km}km`;
  const suffix = isTeam ? " Hold team pace, conversational." : "";
  return athletes.map(a => {
    const roleNote = isTeam ? (isRoleType(a, "power") ? "Hold back — this is the team pace." : "This is your race pace — own it.") : "";
    return entry(a.id, sessionType || "run_easy", label,
      `At ${lo}–${hi}/km, Zone 2, conversational. ${roleNote}${suffix}`.trim(),
      "Avg pace /km");
  });
}

function longRunEntries(athletes, km, baseDecKm, isTeam) {
  const lo = paceLabel(baseDecKm + 0.15);
  const hi = paceLabel(baseDecKm + 0.45);
  const type = isTeam ? "together" : "run_long";
  const suffix = isTeam ? " Steady — run and talk, fuel as you go." : " Steady aerobic effort, fuel as you go.";
  return athletes.map(a =>
    entry(a.id, type, `Long Run ${km}km`,
      `At ${lo}–${hi}/km, Zone 2.${suffix}`,
      "Avg pace /km")
  );
}

function shakeoutEntries(athletes, km) {
  return athletes.map(a =>
    entry(a.id, "together", `Shakeout ${km}km`,
      "Very easy. Just moving the legs. Stay relaxed — no heart rate target.",
      "Avg pace /km")
  );
}

function strengthAEntries(athletes, isDeload) {
  const intensity = isDeload ? "Deload — 70% loads." : "Heavier loads.";
  const sq = isDeload ? "3×5" : "4×6";
  const rdl = isDeload ? "3×6" : "3×8";
  const lunge = isDeload ? "2×16/leg" : "3×20/leg";
  const label = isDeload ? "Strength (light)" : "Strength A";
  return athletes.map(a => {
    const weakNote = weakNote_strength(a);
    return entry(a.id, "strength", label,
      `${intensity} Back squat ${sq} · RDL ${rdl} · Walking lunges ${lunge} · Kettlebell carry 3×100m · Calf raises 3×15.${weakNote}`,
      "Top weight");
  });
}

function strengthBEntries(athletes, isDeload) {
  const intensity = isDeload ? "Deload — 70% loads." : "Heavier loads.";
  const dl = isDeload ? "3×4" : "4×5";
  const row = isDeload ? "3×5" : "3×8";
  const lunge = isDeload ? "2×20m" : "3×20m";
  const label = isDeload ? "Strength (light)" : "Strength B";
  return athletes.map(a => {
    const weakNote = weakNote_strength(a);
    return entry(a.id, "strength", label,
      `${intensity} Deadlift ${dl} · Bent-over row ${row} · Sandbag lunges ${lunge} · Burpee broad jumps 3×8.${weakNote}`,
      "Top weight");
  });
}

function stationCircuitEntries(athletes) {
  return athletes.map(a => {
    const weak = weakStationsFor(a);
    const weakNote = weak.length ? ` Focus extra reps on your weak stations: ${weak.join(", ")}.` : "";
    return entry(a.id, "stations", "STATION CIRCUIT",
      `500m row → 500m ski erg → 30 wall balls (6kg) → 20 burpee broad jumps → 40m farmers carry (2×24kg) → sled push 12.5m. ONE athlete works at a time in team. Note every split.${weakNote}`,
      "Total time / splits");
  });
}

function sledEntries(athletes) {
  return athletes.map(a =>
    entry(a.id, "sled", "SLED @ RACE WEIGHT",
      "Sled push 4×12.5m @ 152kg + pull 4×12.5m @ 103kg. Alternate, full rest between sets. Finish: 2km easy run. Benchmark week — log everything.",
      "Push/pull weights")
  );
}

const BRICK_VARIANTS = [
  { label: "BRICK — Sled + Run",     detail: "4×(sled push 12.5m heavy + 800m run at race pace). Alternate the push, run every 800m." },
  { label: "BRICK — Sled Sandwich",  detail: "3×(800m run + sled push 12.5m + 800m run + sled pull 12.5m). Run every leg at race pace, alternate the sleds." },
  { label: "BRICK — Race Pace",      detail: "4×(sled push 12.5m @ race weight + 1km at race pace). Exact race demand — alternate sleds, lock in transitions." },
  { label: "BRICK — Weakness Fix",   detail: null }, // filled per-athlete below
];

function brickEntries(athletes, brickIdx) {
  const v = BRICK_VARIANTS[Math.min(brickIdx, BRICK_VARIANTS.length - 1)];
  return athletes.map(a => {
    const detail = v.detail ?? `3×(800m race pace + ${(weakStationsFor(a)[0] || "weakest station from last sim")}). Short, sharp. Attack the gap.`;
    return entry(a.id, "brick", v.label, detail, "Round times");
  });
}

const COND_AMRAPS = [
  { dur: 16, detail: "200m run · 12 air squats · 10 walking lunges · 8 burpees. Steady rounds — smooth and controlled, not a sprint." },
  { dur: 30, detail: "400m run · 20 walking lunges · 20 air squats · 10 jumping lunges · 10 jumping air squats. Keep continuously moving." },
  { dur: 20, detail: "300m run · 15 wall balls (6kg) · 15 air squats · 10 burpees. Treat it like HYROX pacing — smooth and unbroken." },
  { dur: 18, detail: "250m row · 12 wall balls · 12 jumping lunges · 8 burpees. Quick transitions. Only if fresh." },
  { dur: 12, detail: "200m run · 10 wall balls · 10 air squats. Easy spin — keep it light, race is close." },
];

function conditioningEntries(athletes, condIdx) {
  const c = COND_AMRAPS[Math.min(condIdx, COND_AMRAPS.length - 1)];
  return athletes.map(a =>
    entry(a.id, "conditioning", "Optional — Conditioning",
      `AMRAP ${c.dur}:00: ${c.detail} Optional.`,
      "Rounds / time")
  );
}

function raceSimEntries(athletes) {
  return athletes.map(a =>
    entry(a.id, "race_sim", "🏁 FULL RACE SIM",
      "8×(1km run + station) using your locked splits. Run every km, alternate sleds, clean transitions. Time EVERYTHING — runs, stations, transitions. This is your race plan.",
      "Total time")
  );
}

function raceDayEntries(athletes) {
  return athletes.map(a =>
    entry(a.id, "race_sim", "🏁 RACE DAY",
      "Race day. Steady runs, attack your stations. Trust the training. Enjoy every moment.",
      "RACE TIME")
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function weakStationsFor(athlete) {
  return (athlete.station_ratings || [])
    .filter(r => r.rating === "weak")
    .map(r => r.station.replace(/_/g, " "));
}

function isRoleType(athlete, type) {
  return (athlete.role || "").toLowerCase().includes(type);
}

function weakNote_strength(athlete) {
  const weak = weakStationsFor(athlete);
  if (weak.includes("wall balls")) return " Add: wall balls 2×15 (6kg).";
  if (weak.includes("burpee broad jumps")) return " Add: burpee broad jumps 3×8.";
  return "";
}

// Shared pace: use the slowest athlete's pace as the team run target
function teamPaceDec(athletes) {
  const vals = athletes.map(a => parsePace(a.run_pace)).filter(Boolean);
  return vals.length ? Math.max(...vals) : 6.25;
}

// ─── Long run distance ────────────────────────────────────────────────────────

function longRunKm(weekNum, totalWeeks, deloads) {
  const fromEnd = totalWeeks - weekNum + 1;
  if (fromEnd === 1) return null; // race week — no long run
  if (fromEnd === 2) return 7;    // sharpen week
  if (fromEnd === 3) return 5;    // race sim week

  if (deloads.has(weekNum)) {
    // Deload: step back 2km from the previous build week's long run
    const prev = buildWeekCount(weekNum - 1, totalWeeks, deloads);
    return Math.max(3, Math.min(14, 4 + prev) - 2);
  }
  return Math.min(14, 4 + buildWeekCount(weekNum, totalWeeks, deloads));
}

// Count non-deload, non-peak weeks up to and including weekNum
function buildWeekCount(upTo, totalWeeks, deloads) {
  let n = 0;
  for (let w = 1; w <= upTo; w++) {
    if (totalWeeks - w + 1 > PEAK_TAIL && !deloads.has(w)) n++;
  }
  return n;
}

// ─── Day factory ─────────────────────────────────────────────────────────────

function day(dayOfWeek, shared, optional, entries) {
  return { day_of_week: dayOfWeek, shared: !!shared, optional: !!optional, entries };
}

// ─── Week builders by type ───────────────────────────────────────────────────

function buildRaceWeek(weekNum, athletes) {
  return {
    week_number: weekNum, phase: 3, focus: FOCUS.race,
    days: [
      day("Mon", true,  false, shakeoutEntries(athletes, 3)),
      day("Tue", false, false, athletes.map(a => rest(a.id))),
      day("Wed", true,  false, shakeoutEntries(athletes, 2)),
      day("Thu", true,  false, raceDayEntries(athletes)),
      day("Fri", false, false, athletes.map(a => rest(a.id))),
      day("Sat", false, false, athletes.map(a => rest(a.id))),
      day("Sun", false, false, athletes.map(a => rest(a.id))),
    ],
  };
}

function buildSharpenWeek(weekNum, athletes, isTeam, condIdx) {
  const pDec = teamPaceDec(athletes);
  const lkm = 7;
  return {
    week_number: weekNum, phase: 3, focus: FOCUS.sharpen,
    days: [
      day("Mon", true,  false, strengthAEntries(athletes, true)),
      day("Tue", true,  false, runEntries(athletes, 4, pDec, isTeam, isTeam ? "together" : "run_easy")),
      day("Wed", true,  true,  conditioningEntries(athletes, condIdx)),
      day("Thu", true,  false, brickEntries(athletes, 3)),
      day("Fri", false, false, athletes.map(a => rest(a.id))),
      day("Sat", isTeam, false, longRunEntries(athletes, lkm, pDec, isTeam)),
      day("Sun", false, false, athletes.map(a => rest(a.id))),
    ],
  };
}

function buildRaceSimWeek(weekNum, athletes, isTeam) {
  const pDec = teamPaceDec(athletes);
  return {
    week_number: weekNum, phase: 3, focus: FOCUS.raceSim,
    days: [
      day("Mon", true,  false, strengthAEntries(athletes, false)),
      day("Tue", true,  false, runEntries(athletes, 5, pDec, isTeam, isTeam ? "together" : "run_easy")),
      day("Wed", false, false, athletes.map(a => rest(a.id))),
      day("Thu", true,  false, shakeoutEntries(athletes, 3)),
      day("Fri", false, false, athletes.map(a => rest(a.id))),
      day("Sat", true,  false, raceSimEntries(athletes)),
      day("Sun", false, false, athletes.map(a => rest(a.id))),
    ],
  };
}

function buildBaseWeek(weekNum, totalWeeks, athletes, isTeam, isDeload, deloads, baseIdx, condIdx) {
  const pDec = teamPaceDec(athletes);
  const lkm = longRunKm(weekNum, totalWeeks, deloads);
  const focus = isDeload ? FOCUS.deload : (FOCUS.base[baseIdx] || FOCUS.base[FOCUS.base.length - 1]);
  const runKm = isDeload ? 3 : Math.min(3 + baseIdx + 2, 7); // 5, 6, 7km
  const runType = isTeam ? "together" : "run_easy";

  if (isDeload) {
    return {
      week_number: weekNum, phase: 1, focus,
      days: [
        day("Mon", true,  false, strengthAEntries(athletes, true)),
        day("Tue", false, false, athletes.map(a => rest(a.id))),
        day("Wed", true,  false, runEntries(athletes, 3, pDec, isTeam, runType)),
        day("Thu", true,  true,  conditioningEntries(athletes, condIdx)),
        day("Fri", false, false, athletes.map(a => rest(a.id))),
        day("Sat", isTeam, false, longRunEntries(athletes, lkm, pDec, isTeam)),
        day("Sun", false, false, athletes.map(a => rest(a.id))),
      ],
    };
  }

  // Normal base week: alternate which day gets run vs strength
  const runFirst = baseIdx % 2 === 0;
  const hasStations = baseIdx >= 1;
  const hasStrB = baseIdx >= 2;
  return {
    week_number: weekNum, phase: 1, focus,
    days: [
      day("Mon", runFirst ? isTeam : true, false,
        runFirst
          ? runEntries(athletes, runKm, pDec, isTeam, runType)
          : strengthAEntries(athletes, false)),
      day("Tue", runFirst ? true : isTeam, false,
        runFirst
          ? strengthAEntries(athletes, false)
          : runEntries(athletes, runKm, pDec, isTeam, runType)),
      day("Wed", false, baseIdx >= 1, baseIdx >= 1
        ? conditioningEntries(athletes, condIdx)
        : athletes.map(a => rest(a.id))),
      day("Thu", hasStations, false, hasStations
        ? stationCircuitEntries(athletes)
        : athletes.map(a => rest(a.id))),
      day("Fri", hasStrB, false, hasStrB
        ? strengthBEntries(athletes, false)
        : athletes.map(a => rest(a.id))),
      day("Sat", isTeam, false, longRunEntries(athletes, lkm, pDec, isTeam)),
      day("Sun", false, false, athletes.map(a => rest(a.id))),
    ],
  };
}

function buildBuildWeek(weekNum, totalWeeks, athletes, isTeam, isDeload, deloads, buildIdx, brickCount, condIdx) {
  const pDec = teamPaceDec(athletes);
  const lkm = longRunKm(weekNum, totalWeeks, deloads);
  const focus = isDeload ? FOCUS.deload : (FOCUS.build[buildIdx] || FOCUS.build[FOCUS.build.length - 1]);
  const runKm = Math.min(5 + Math.min(buildIdx, 3), 8);
  const runType = isTeam ? "together" : "run_easy";

  // Dedicate every 3rd build week to a sled benchmark instead of a brick
  const isSledDay = (buildIdx + 1) % 3 === 0;

  if (isDeload) {
    return {
      week_number: weekNum, phase: 2, focus,
      days: [
        day("Mon", true,  false, strengthAEntries(athletes, true)),
        day("Tue", true,  false, runEntries(athletes, 4, pDec, isTeam, runType)),
        day("Wed", false, false, athletes.map(a => rest(a.id))),
        day("Thu", false, false, athletes.map(a => rest(a.id))),
        day("Fri", false, false, athletes.map(a => rest(a.id))),
        day("Sat", isTeam, false, longRunEntries(athletes, lkm, pDec, isTeam)),
        day("Sun", false, false, athletes.map(a => rest(a.id))),
      ],
    };
  }

  return {
    week_number: weekNum, phase: 2, focus,
    days: [
      day("Mon", false, false, athletes.map(a => rest(a.id))),
      day("Tue", true,  false, strengthAEntries(athletes, false)),
      day("Wed", true,  false, runEntries(athletes, runKm, pDec, isTeam, runType)),
      day("Thu", true,  false, isSledDay
        ? sledEntries(athletes)
        : brickEntries(athletes, Math.min(brickCount, 2))),
      day("Fri", true,  false, strengthBEntries(athletes, false)),
      day("Sat", false, false, athletes.map(a => rest(a.id))),
      day("Sun", isTeam, false, longRunEntries(athletes, lkm, pDec, isTeam)),
    ],
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function generatePlan(team, plan, athletes) {
  if (!athletes?.length) throw new Error("generatePlan: at least one athlete required");
  const rhythm = RHYTHM[plan.weeks];
  if (!rhythm) throw new Error(`Unsupported plan length: ${plan.weeks}. Must be 8, 12, 16, or 20.`);

  const isTeam = TEAM_FORMATS.has(team.format_id);
  const total = plan.weeks;
  const weeks = [];

  // Counters for progression within each phase
  let baseIdx = 0;    // non-deload base weeks (drives focus lines + run km)
  let buildIdx = 0;   // non-deload build weeks
  let brickCount = 0; // total bricks placed
  let condIdx = 0;    // total optional conditioning placed

  for (let w = 1; w <= total; w++) {
    const phase = rhythm.phaseOf(w);
    const isDeload = rhythm.deloads.has(w);
    const fromEnd = total - w + 1;

    let wk;
    if (fromEnd === 1) {
      wk = buildRaceWeek(w, athletes);
    } else if (fromEnd === 2) {
      wk = buildSharpenWeek(w, athletes, isTeam, condIdx++);
    } else if (fromEnd === 3) {
      wk = buildRaceSimWeek(w, athletes, isTeam);
    } else if (phase === 1) {
      wk = buildBaseWeek(w, total, athletes, isTeam, isDeload, rhythm.deloads, isDeload ? baseIdx : baseIdx++, isDeload ? condIdx : condIdx++);
    } else {
      wk = buildBuildWeek(w, total, athletes, isTeam, isDeload, rhythm.deloads, isDeload ? buildIdx : buildIdx++, isDeload ? brickCount : brickCount++, condIdx);
      if (!isDeload) condIdx++;
    }

    weeks.push(wk);
  }

  return { weeks };
}
