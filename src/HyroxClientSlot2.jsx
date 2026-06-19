import { useState, useEffect } from "react";

// ════════════════════════════════════════════════════════════════════════════
//  HYROX TRAINING APP — multi-client version
//  Foundation: the Walker app (HT). Added: format + race dropdowns, plan-length
//  picker, generic Athlete 1/2 strategy, and a Metric/US unit toggle.
//
//  TO LAUNCH A NEW CLIENT:
//   1. Copy this file.
//   2. Edit the CLIENT block below (names, team, format, race, PLAN_ID).
//   3. Give it a unique PLAN_ID so their logs stay separate in Supabase.
//   4. Deploy. See the SETUP guide in chat for the per-client workflow.
// ════════════════════════════════════════════════════════════════════════════

// ── RACE FORMATS ──────────────────────────────────────────────────────────────
const FORMATS = {
  mens_solo:       { label: "Men's Solo",           athletes: 1, team: false },
  mens_solo_pro:   { label: "Men's Solo Pro",       athletes: 1, team: false },
  womens_solo:     { label: "Women's Solo",         athletes: 1, team: false },
  womens_solo_pro: { label: "Women's Solo Pro",     athletes: 1, team: false },
  doubles_men:     { label: "Doubles Men",          athletes: 2, team: true },
  doubles_women:   { label: "Doubles Women",        athletes: 2, team: true },
  mixed_doubles:   { label: "Mixed Doubles",        athletes: 2, team: true },
  relay_men:       { label: "Relay Men (4)",        athletes: 4, team: true },
  relay_women:     { label: "Relay Women (4)",      athletes: 4, team: true },
  relay_mixed:     { label: "Relay Mixed (2M/2W)",  athletes: 4, team: true },
};

// ── RACE LIST (snapshot from hyrox.com/find-my-race, refresh periodically) ─────
const RACES = [
  { name: "HYROX Buenos Aires", city: "Buenos Aires", iso: "2026-06-13" },
  { name: "PUMA HYROX World Championships Stockholm", city: "Stockholm", iso: "2026-06-18" },
  { name: "AirAsia HYROX Jakarta", city: "Jakarta", iso: "2026-06-27" },
  { name: "BYD HYROX Sydney", city: "Sydney", iso: "2026-07-01" },
  { name: "TORRAS HYROX Hangzhou", city: "Hangzhou", iso: "2026-07-04" },
  { name: "Masters' Union HYROX Delhi", city: "Delhi", iso: "2026-07-24" },
  { name: "HYROX Chengdu", city: "Chengdu", iso: "2026-08-01" },
  { name: "HYROX Istanbul", city: "Istanbul", iso: "2026-08-01" },
  { name: "AirAsia HYROX Chiba", city: "Chiba", iso: "2026-08-06" },
  { name: "BYD HYROX Bangkok", city: "Bangkok", iso: "2026-08-13" },
  { name: "Virgin Active HYROX Cape Town", city: "Cape Town", iso: "2026-08-14" },
  { name: "HYROX Shenzhen", city: "Shenzhen", iso: "2026-08-15" },
  { name: "AirAsia HYROX Perth", city: "Perth", iso: "2026-08-21" },
  { name: "Amazfit HYROX Washington D.C.", city: "Washington D.C.", iso: "2026-09-03" },
  { name: "HYROX Tenerife", city: "Tenerife", iso: "2026-09-04" },
  { name: "Mundo Imperial HYROX Acapulco", city: "Acapulco", iso: "2026-09-05" },
  { name: "HYROX Athens", city: "Athens", iso: "2026-09-05" },
  { name: "HYROX Beijing", city: "Beijing", iso: "2026-09-12" },
  { name: "HYROX Maastricht", city: "Maastricht", iso: "2026-09-17" },
  { name: "Masters' Union HYROX Mumbai", city: "Mumbai", iso: "2026-09-17" },
  { name: "InBody HYROX Salt Lake City", city: "Salt Lake City", iso: "2026-09-18" },
  { name: "HYROX Izmir", city: "Izmir", iso: "2026-09-19" },
  { name: "HYROX Rome", city: "Rome", iso: "2026-09-24" },
  { name: "HYROX Oslo", city: "Oslo", iso: "2026-09-25" },
  { name: "INTERSPORT HYROX Bordeaux", city: "Bordeaux", iso: "2026-09-30" },
  { name: "HYROX Karlsruhe", city: "Karlsruhe", iso: "2026-10-01" },
  { name: "GoodLife HYROX Toronto", city: "Toronto", iso: "2026-10-01" },
  { name: "HWPO HYROX Boston", city: "Boston", iso: "2026-10-08" },
  { name: "Let's Go Fitness HYROX Geneva", city: "Geneva", iso: "2026-10-09" },
  { name: "HYROX Gdansk", city: "Gdansk", iso: "2026-10-10" },
  { name: "HYROX Valencia", city: "Valencia", iso: "2026-10-16" },
  { name: "HYROX Sao Paulo", city: "Sao Paulo", iso: "2026-10-17" },
  { name: "MyFitnessPal HYROX Tampa", city: "Tampa", iso: "2026-10-23" },
  { name: "HYROX Birmingham", city: "Birmingham", iso: "2026-10-27" },
  { name: "INTERSPORT HYROX Hamburg", city: "Hamburg", iso: "2026-10-28" },
  { name: "TRAINSWEATEAT HYROX Nice", city: "Nice", iso: "2026-10-29" },
  { name: "HYROX Mexico City", city: "Mexico City", iso: "2026-10-30" },
  { name: "HYROX Shanghai", city: "Shanghai", iso: "2026-10-31" },
  { name: "HYROX Dublin", city: "Dublin", iso: "2026-11-11" },
  { name: "HYROX Dusseldorf", city: "Dusseldorf", iso: "2026-11-11" },
  { name: "Leapmotor HYROX Barcelona", city: "Barcelona", iso: "2026-11-12" },
  { name: "HYROX Denver", city: "Denver", iso: "2026-11-12" },
  { name: "AirAsia HYROX Seoul", city: "Seoul", iso: "2026-11-14" },
  { name: "HYROX Dallas", city: "Dallas", iso: "2026-11-18" },
  { name: "HYROX Poznan", city: "Poznan", iso: "2026-11-20" },
  { name: "HYROX Guangzhou", city: "Guangzhou", iso: "2026-11-21" },
  { name: "HYROX Rio de Janeiro", city: "Rio de Janeiro", iso: "2026-11-21" },
  { name: "HYROX Utrecht", city: "Utrecht", iso: "2026-11-26" },
  { name: "AIA HYROX Singapore", city: "Singapore", iso: "2026-11-27" },
  { name: "Virgin Active HYROX Johannesburg", city: "Johannesburg", iso: "2026-11-28" },
  { name: "HYROX London ExCel", city: "London", iso: "2026-12-02" },
  { name: "HYROX Anaheim", city: "Anaheim", iso: "2026-12-04" },
  { name: "HYROX Milan", city: "Milan", iso: "2026-12-05" },
  { name: "HYROX Sanya", city: "Sanya", iso: "2026-12-05" },
  { name: "INTERSPORT HYROX Stockholm", city: "Stockholm", iso: "2026-12-10" },
  { name: "Fitness First HYROX Frankfurt", city: "Frankfurt", iso: "2026-12-10" },
  { name: "HYROX Nashville", city: "Nashville", iso: "2026-12-10" },
  { name: "FITNESS PARK HYROX Paris", city: "Paris", iso: "2026-12-12" },
  { name: "HYROX Gent", city: "Gent", iso: "2026-12-17" },
  { name: "HYROX Helsinki", city: "Helsinki", iso: "2026-12-18" },
  { name: "HYROX Vancouver", city: "Vancouver", iso: "2026-12-18" },
];

const ATHLETE_COLORS = ["#60a5fa", "#6ee7b7", "#f0a0b4", "#f0c020"];

// ════════════════════════════════════════════════════════════════════════════
//  CLIENT  — edit this block per client. Everything in the UI reads from here.
// ════════════════════════════════════════════════════════════════════════════
const CLIENT = {
  teamName: "TEAM HYROX",                  // big title; "" = auto from athlete names
  tagline: "run together, win together",
  formatId: "mixed_doubles",               // key from FORMATS
  raceName: "Amazfit HYROX Washington D.C.",
  raceCity: "Washington D.C.",
  raceISO: "2026-09-03T07:00:00",          // drives countdown + week labels
  weeks: 12,                                // 8, 12, or 16
  defaultUnits: "us",                       // "us" (lb/mi) or "metric" (kg/km)
  startOptions: [
    { id: "jun15", label: "Start Mon Jun 15", iso: "2026-06-15" },
    { id: "jun22", label: "Start Mon Jun 22", iso: "2026-06-22" },
  ],
  // One entry per athlete. Color auto-fills if omitted.
  athletes: [
    { name: "Athlete 1", role: "Power lead · heavy stations", pace: "Race pace 6:15–6:30/km (hold back!)" },
    { name: "Athlete 2", role: "Pace lead · machines",        pace: "Race pace = your pace. Build the engine." },
  ],
  // Plan phases shown on the Overview tab.
  phases: [
    { id: 1, name: "Base",         weeks: "1–4",   dates: "Weeks 1–4",   color: "#3b82f6", goal: "Build the aerobic engine, get under the sled, practice pacing together." },
    { id: 2, name: "Build",        weeks: "5–9",   dates: "Weeks 5–9",   color: "#f0c020", goal: "Hyrox-specific bricks. Stations under fatigue. Lock in rep splits." },
    { id: 3, name: "Peak + Taper", weeks: "10–12", dates: "Weeks 10–12", color: "#f87171", goal: "Race simulation, sharpen, taper. Arrive fresh on race day." },
  ],
};

// ── PER-CLIENT STORAGE NAMESPACE ───────────────────────────────────────────────
// Unique per published client so logs/notes never collide in the shared database.
const PLAN_ID = "client-slot-2";

const palettes = {
  dark: {
    bg: "#07070e", headerBg: "linear-gradient(180deg, #0c0c1e 0%, #07070e 100%)",
    card: "#0f0f1e", inset: "#0a0a14",
    border: "#22223a", border2: "#3a3a55",
    faint: "#7c7ca6", dim: "#9c9cc0", body: "#b4b4d6", strong: "#dcdcf0", text: "#eceefa",
    amberBg: "#150e00", amberBorder: "#4a3000", amberText: "#b0a078",
  },
  light: {
    bg: "#f4f4f7", headerBg: "linear-gradient(180deg, #ffffff 0%, #f4f4f7 100%)",
    card: "#ffffff", inset: "#ebebf0",
    border: "#d8d8e2", border2: "#bcbccc",
    faint: "#62627a", dim: "#4c4c64", body: "#34344c", strong: "#1a1a2c", text: "#0e0e16",
    amberBg: "#fff6e0", amberBorder: "#e0c070", amberText: "#6a5a20",
  },
};
const autoTheme = () => { const h = new Date().getHours(); return h >= 7 && h < 19 ? "light" : "dark"; };

const weekRange = (startISO, week) => {
  const d = new Date(startISO + "T12:00:00");
  d.setDate(d.getDate() + (week - 1) * 7);
  const end = new Date(d); end.setDate(end.getDate() + 6);
  const f = (x) => x.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${f(d)} – ${f(end)}`;
};
const countdownParts = (raceISO) => {
  let ms = new Date(raceISO) - new Date();
  if (ms < 0) ms = 0;
  return {
    days: Math.floor(ms / 86400000),
    hours: Math.floor((ms % 86400000) / 3600000),
    minutes: Math.floor((ms % 3600000) / 60000),
    seconds: Math.floor((ms % 60000) / 1000),
  };
};
const fmtRaceDate = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const autoTeamName = (athletes) => {
  const names = athletes.map(a => a.name).filter(Boolean);
  if (names.length === 0) return "MY HYROX PLAN";
  if (names.length === 1) return names[0].toUpperCase();
  return "TEAM " + names.map(n => n.split(" ")[0]).join(" & ").toUpperCase();
};

// pull a numeric pace (min/km as decimal) out of "6:18" or "6:18/km" or "5.9"
const parsePace = (str) => {
  if (!str) return null;
  const mmss = String(str).match(/(\d{1,2}):(\d{2})/);
  if (mmss) return parseInt(mmss[1], 10) + parseInt(mmss[2], 10) / 60;
  const dec = String(str).match(/(\d+(?:\.\d+)?)/);
  if (dec) { const v = parseFloat(dec[1]); return v > 0 && v < 15 ? v : null; }
  return null;
};
const paceLabel = (dec) => {
  if (dec == null) return "—";
  const m = Math.floor(dec); const s = Math.round((dec - m) * 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};

// ════════════════════════════════════════════════════════════════════════════
//  UNIT CONVERSION
//  Rules (per coach):
//   • Personal lift weights  → fully convert kg↔lb
//   • Official Hyrox station weights → show "kg (lb)", never bare-converted
//   • Run distances → stay metric (km/m). Coach authors distances.
//   • Pace → the one thing that flips: min/km ↔ min/mi on labels + logged value
// ════════════════════════════════════════════════════════════════════════════
const KM_PER_MI = 1.60934;
const LB_PER_KG = 2.20462;

// Official Hyrox station weights — these are fixed equipment specs worldwide.
// We show both units but never replace the metric source of truth.
const STATION_WEIGHTS_KG = [152, 103, 24, 20, 6];

// Convert a personal-lift metric LABEL and a logged value's unit suffix.
const unitizeMetricLabel = (label, units) => {
  if (!label) return label;
  // pace labels
  if (/\/km/i.test(label)) return units === "us" ? label.replace(/\/km/gi, "/mi") : label;
  // generic weight prompts ("Top weight", "Push/pull weights")
  return label;
};

// Annotate station weights inside a free-text detail string with the converted
// value in parentheses, e.g. "152kg" -> "152kg (335lb)" when units = us.
const annotateStationWeights = (text, units) => {
  if (!text || units !== "us") return text;
  let out = text;
  for (const kg of STATION_WEIGHTS_KG) {
    // match e.g. 152kg, 2×24kg (handle the multiplier case for farmers)
    const re = new RegExp(`(\\d+×)?${kg}kg`, "g");
    out = out.replace(re, (m) => {
      const lb = Math.round(kg * LB_PER_KG);
      return `${m} (${lb}lb)`;
    });
  }
  return out;
};

// Convert a logged pace string between min/km and min/mi for display.
const convertPaceForDisplay = (str, units) => {
  if (!str) return str;
  const dec = parsePace(str); // assume stored as min/km
  if (dec == null) return str;
  if (units === "us") {
    const perMi = dec * KM_PER_MI;
    return `${paceLabel(perMi)}/mi`;
  }
  return `${paceLabel(dec)}/km`;
};

const phaseColors = { 1: "#3b82f6", 2: "#f0c020", 3: "#f87171" };

const sessionTypes = {
  run_easy:  { color: "#60a5fa", bg: "#0e1f3a", icon: "🏃", label: "Easy Run" },
  run_pace:  { color: "#34d399", bg: "#0e2a1e", icon: "⏱", label: "Pace Run" },
  run_long:  { color: "#3b82f6", bg: "#0a1a30", icon: "🛣", label: "Long Run" },
  strength:  { color: "#8b5cf6", bg: "#1a0a2a", icon: "🏋️", label: "Strength" },
  sled:      { color: "#f59e0b", bg: "#2a1800", icon: "🛷", label: "Sled Work" },
  brick:     { color: "#ef4444", bg: "#2a0a0a", icon: "🔥", label: "Brick" },
  stations:  { color: "#f0c020", bg: "#2a2200", icon: "⚙️", label: "Stations" },
  together:  { color: "#ec4899", bg: "#2a0a1e", icon: "👫", label: "Together" },
  race_sim:  { color: "#f0f020", bg: "#1a1a00", icon: "🏁", label: "Race Sim" },
  conditioning: { color: "#22d3ee", bg: "#0a2226", icon: "💪", label: "Conditioning" },
  rest:      { color: "#374151", bg: "#0c0c10", icon: "😴", label: "Rest" },
};

const weeklyQuotes = {
  1: { q: "Without commitment, you'll never start. Without consistency, you'll never finish.", by: "Denzel Washington" },
  2: { q: "We are what we repeatedly do.", by: "Aristotle (attributed)" },
  3: { q: "The work works on you more than you work on it.", by: "Alex Hormozi" },
  4: { q: "Luck is what happens when preparation meets opportunity.", by: "Seneca" },
  5: { q: "Don't quit. Suffer now and live the rest of your life as a champion.", by: "Muhammad Ali" },
  6: { q: "The battles that count aren't the ones for gold medals.", by: "Jesse Owens" },
  7: { q: "Everything negative — pressure, challenges — is all an opportunity for me to rise.", by: "Kobe Bryant" },
  8: { q: "I didn't come this far to only come this far.", by: "Tom Brady" },
  9: { q: "No human is limited.", by: "Eliud Kipchoge" },
  10: { q: "Individual commitment to a group effort — that is what makes a team work.", by: "Vince Lombardi" },
  11: { q: "It ain't about how hard you hit. It's about how hard you can get hit and keep moving forward.", by: "Rocky Balboa" },
  12: { q: "Alone we can do so little; together we can do so much.", by: "Helen Keller" },
  13: { q: "Discipline is choosing between what you want now and what you want most.", by: "Abraham Lincoln (attributed)" },
  14: { q: "Hard work beats talent when talent doesn't work hard.", by: "Tim Notke" },
  15: { q: "It's not the will to win that matters — it's the will to prepare to win.", by: "Bobby Knight" },
  16: { q: "The only way to prove you're a good sport is to lose.", by: "Ernie Banks" },
};

// metric: what to log for the session. shared? = same session for the team.
// Day entries use a0..a3 (athlete index). a0/a1 carry the Walker seed plan;
// a2/a3 fall back to a0 for relay formats until a per-athlete plan is authored.
const weekPlan = [
  {
    week: 1, phase: 1, focus: "Ease in. Monday run, midweek skills, weekend long run.",
    days: [
      { day: "Mon", shared: true, a0: { type: "together", label: "Easy Run 3km", detail: "At 6:15–6:30/km, Zone 2, conversational. Hold back — this is the team pace.", metric: "Avg pace /km" }, a1: { type: "together", label: "Easy Run 3km", detail: "At 6:15–6:30/km, Zone 2, conversational. This is your race pace — own it.", metric: "Avg pace /km" } },
      { day: "Tue", shared: true, a0: { type: "strength", label: "Strength A", detail: "Heavier loads. Back squat 4×6 · RDL 3×8 · Walking lunges 3×20/leg · Kettlebell carry 3×100m · Calf raises 3×15.", metric: "Top weight" }, a1: { type: "strength", label: "Strength A", detail: "Same session, your loads. Back squat 4×6 · RDL 3×8 · Walking lunges 3×20/leg · Kettlebell carry 3×100m · Wall balls 2×15 (6kg, your accessory).", metric: "Top weight" } },
      { day: "Wed", a0: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null }, a1: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null } },
      { day: "Thu", shared: true, a0: { type: "stations", label: "Station Skills", detail: "Sled push 4×12.5m moderate + 3×500m row easy + wall ball technique. Alternate — one works at a time, learn the rhythm.", metric: "Sled / row time" }, a1: { type: "stations", label: "Station Skills", detail: "Sled push 4×12.5m moderate + 3×500m row easy (you lead) + wall ball technique. Practice your share. Note splits.", metric: "Sled / row time" } },
      { day: "Fri", a0: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null }, a1: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null } },
      { day: "Sat", shared: true, a0: { type: "together", label: "Long Run 5km", detail: "At 6:30–6:45/km, Zone 2. Steady aerobic effort, fuel as you go.", metric: "Avg pace /km" }, a1: { type: "together", label: "Long Run 5km", detail: "At 6:30–6:45/km, Zone 2. Steady — relax and talk, fuel as you go.", metric: "Avg pace /km" } },
      { day: "Sun", a0: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null }, a1: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null } },
    ],
  },
  {
    week: 2, phase: 1, focus: "Twice-weekly strength block. Build the base.",
    days: [
      { day: "Mon", shared: true, a0: { type: "strength", label: "Strength A", detail: "Heavier loads. Back squat 4×6 · RDL 3×8 · Walking lunges 3×20/leg · Kettlebell carry 3×100m · Calf raises 3×15.", metric: "Top weight" }, a1: { type: "strength", label: "Strength A", detail: "Same session, your loads. Back squat 4×6 · RDL 3×8 · Walking lunges 3×20/leg · Kettlebell carry 3×100m · Wall balls 2×15 (6kg, your accessory).", metric: "Top weight" } },
      { day: "Tue", shared: true, a0: { type: "together", label: "Easy Run 4km", detail: "At 6:15–6:30/km, Zone 2, conversational. Hold back — this is the team pace.", metric: "Avg pace /km" }, a1: { type: "together", label: "Easy Run 4km", detail: "At 6:15–6:30/km, Zone 2, conversational. This is your race pace — own it.", metric: "Avg pace /km" } },
      { day: "Wed", shared: true, optional: true, a0: { type: "conditioning", label: "Optional — Conditioning", detail: "AMRAP 16:00: 200m run · 12 air squats · 10 walking lunges · 8 burpees. Steady rounds. NOTES: Easy intro conditioning — smooth and controlled, not a sprint. Optional.", metric: "Rounds / time" }, a1: { type: "conditioning", label: "Optional — Conditioning", detail: "AMRAP 16:00: 200m run · 12 air squats · 10 walking lunges · 8 burpees. Steady rounds. NOTES: Easy intro conditioning — smooth and controlled, not a sprint. Optional.", metric: "Rounds / time" } },
      { day: "Thu", a0: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null }, a1: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null } },
      { day: "Fri", shared: true, a0: { type: "strength", label: "Strength B", detail: "Heavier loads. Deadlift 4×5 · Bent-over row 3×8 · Sandbag lunges 3×20m · Burpee broad jumps 3×8.", metric: "Top weight" }, a1: { type: "strength", label: "Strength B", detail: "Same session, your loads. Deadlift 4×5 · Bent-over row 3×8 · Sandbag lunges 3×20m · Burpee broad jumps 4×8 (your accessory).", metric: "Top weight" } },
      { day: "Sat", shared: true, a0: { type: "together", label: "Long Run 6km", detail: "At 6:30–6:45/km, Zone 2. Steady aerobic effort, fuel as you go.", metric: "Avg pace /km" }, a1: { type: "together", label: "Long Run 6km", detail: "At 6:30–6:45/km, Zone 2. Steady — relax and talk, fuel as you go.", metric: "Avg pace /km" } },
      { day: "Sun", a0: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null }, a1: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null } },
    ],
  },
  {
    week: 3, phase: 1, focus: "Stations land midweek. First conditioning piece.",
    days: [
      { day: "Mon", shared: true, a0: { type: "together", label: "Easy Run 4km", detail: "At 6:15–6:30/km, Zone 2, conversational. Hold back — this is the team pace.", metric: "Avg pace /km" }, a1: { type: "together", label: "Easy Run 4km", detail: "At 6:15–6:30/km, Zone 2, conversational. This is your race pace — own it.", metric: "Avg pace /km" } },
      { day: "Tue", shared: true, optional: true, a0: { type: "conditioning", label: "Optional — Conditioning", detail: "30:00 @ 7 RPE. Continuous: 400m run · 20 walking lunges · 20 air squats · 10 jumping lunges · 10 jumping air squats. Repeat for 30 min. NOTES: Keep continuously moving even as muscular fatigue builds. The first 200m of each run should feel tough after the lunges and squats — focus on a relaxed stride length and getting your breathing back under control. Optional.", metric: "Rounds / time" }, a1: { type: "conditioning", label: "Optional — Conditioning", detail: "30:00 @ 7 RPE. Continuous: 400m run · 20 walking lunges · 20 air squats · 10 jumping lunges · 10 jumping air squats. Repeat for 30 min. NOTES: Keep continuously moving even as muscular fatigue builds. The first 200m of each run should feel tough after the lunges and squats — focus on a relaxed stride length and getting your breathing back under control. Optional.", metric: "Rounds / time" } },
      { day: "Wed", a0: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null }, a1: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null } },
      { day: "Thu", shared: true, a0: { type: "stations", label: "STATION CIRCUIT", detail: "500m row → 500m ski → 30 wall balls → 20 BBJ → 40m farmers (24kg) → sled push 12.5m. Split reps your way, ONE works at a time. Transition drill: switch every 250m.", metric: "Total time / splits" }, a1: { type: "stations", label: "STATION CIRCUIT", detail: "Circuit: 500m row → 500m ski → 30 WB → 20 BBJ → 40m farmers → sled push 12.5m. You lead WB, BBJ and machines. Log your split.", metric: "Total time / splits" } },
      { day: "Fri", shared: true, a0: { type: "strength", label: "Strength A", detail: "Heavier loads. Back squat 4×6 · RDL 3×8 · Walking lunges 3×20/leg · Kettlebell carry 3×100m · Calf raises 3×15.", metric: "Top weight" }, a1: { type: "strength", label: "Strength A", detail: "Same session, your loads. Back squat 4×6 · RDL 3×8 · Walking lunges 3×20/leg · Kettlebell carry 3×100m · Wall balls 2×15 (6kg, your accessory).", metric: "Top weight" } },
      { day: "Sat", shared: true, a0: { type: "together", label: "Long Run 7km", detail: "At 6:30–6:45/km, Zone 2. Steady aerobic effort, fuel as you go.", metric: "Avg pace /km" }, a1: { type: "together", label: "Long Run 7km", detail: "At 6:30–6:45/km, Zone 2. Steady — relax and talk, fuel as you go.", metric: "Avg pace /km" } },
      { day: "Sun", a0: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null }, a1: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null } },
    ],
  },
  {
    week: 4, phase: 1, focus: "Deload. Three sessions, lighter all round.",
    days: [
      { day: "Mon", shared: true, a0: { type: "strength", label: "Strength (light)", detail: "Deload — 70% loads. Back squat 3×5 · RDL 3×6 · Walking lunges 2×16/leg. Keep it easy.", metric: "Top weight" }, a1: { type: "strength", label: "Strength (light)", detail: "Deload — 70% loads. Back squat 3×5 · RDL 3×6 · Walking lunges 2×16/leg · Wall balls 2×12 easy. Keep it easy.", metric: "Top weight" } },
      { day: "Tue", a0: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null }, a1: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null } },
      { day: "Wed", shared: true, a0: { type: "together", label: "Easy Run 3km", detail: "At 6:15–6:30/km, Zone 2, conversational. Hold back — this is the team pace.", metric: "Avg pace /km" }, a1: { type: "together", label: "Easy Run 3km", detail: "At 6:15–6:30/km, Zone 2, conversational. This is your race pace — own it.", metric: "Avg pace /km" } },
      { day: "Thu", shared: true, optional: true, a0: { type: "conditioning", label: "Optional — Light Conditioning", detail: "AMRAP 12:00 (light): 200m easy jog · 10 air squats · 10 walking lunges · 5 burpees. NOTES: Deload week — keep it gentle, just move and sweat lightly. Stop if it feels like work. Optional.", metric: "Rounds / time" }, a1: { type: "conditioning", label: "Optional — Light Conditioning", detail: "AMRAP 12:00 (light): 200m easy jog · 10 air squats · 10 walking lunges · 5 burpees. NOTES: Deload week — keep it gentle, just move and sweat lightly. Stop if it feels like work. Optional.", metric: "Rounds / time" } },
      { day: "Fri", a0: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null }, a1: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null } },
      { day: "Sat", shared: true, a0: { type: "together", label: "Long Run 5km", detail: "At 6:30–6:45/km, Zone 2. Steady aerobic effort, fuel as you go.", metric: "Avg pace /km" }, a1: { type: "together", label: "Long Run 5km", detail: "At 6:30–6:45/km, Zone 2. Steady — relax and talk, fuel as you go.", metric: "Avg pace /km" } },
      { day: "Sun", a0: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null }, a1: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null } },
    ],
  },
  {
    week: 5, phase: 2, focus: "Bricks begin. Run-station fatigue work.",
    days: [
      { day: "Mon", shared: true, a0: { type: "together", label: "Easy Run 5km", detail: "At 6:15–6:30/km, Zone 2, conversational. Hold back — this is the team pace.", metric: "Avg pace /km" }, a1: { type: "together", label: "Easy Run 5km", detail: "At 6:15–6:30/km, Zone 2, conversational. This is your race pace — own it.", metric: "Avg pace /km" } },
      { day: "Tue", shared: true, a0: { type: "strength", label: "Strength A", detail: "Heavier loads. Back squat 4×6 · RDL 3×8 · Walking lunges 3×20/leg · Kettlebell carry 3×100m · Calf raises 3×15.", metric: "Top weight" }, a1: { type: "strength", label: "Strength A", detail: "Same session, your loads. Back squat 4×6 · RDL 3×8 · Walking lunges 3×20/leg · Kettlebell carry 3×100m · Wall balls 2×15 (6kg, your accessory).", metric: "Top weight" } },
      { day: "Wed", shared: true, optional: true, a0: { type: "conditioning", label: "Optional — Conditioning", detail: "AMRAP 20:00: 300m run · 15 wall balls (6kg) · 15 air squats · 10 burpees. NOTES: Treat it like Hyrox pacing — smooth and unbroken beats fast and gassed. Optional.", metric: "Rounds / time" }, a1: { type: "conditioning", label: "Optional — Conditioning", detail: "AMRAP 20:00: 300m run · 15 wall balls (6kg) · 15 air squats · 10 burpees. NOTES: Treat it like Hyrox pacing — smooth and unbroken beats fast and gassed. Optional.", metric: "Rounds / time" } },
      { day: "Thu", shared: true, a0: { type: "brick", label: "BRICK — Sled + Run", detail: "4×(sled push 12.5m heavy + 800m run at 6:15/km). Alternate the push, run every 800m together.", metric: "Round times" }, a1: { type: "brick", label: "BRICK — Sled + Run", detail: "4×(sled push 12.5m + 800m run at your pace). Take your share of each push, run every 800m together.", metric: "Round times" } },
      { day: "Fri", a0: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null }, a1: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null } },
      { day: "Sat", shared: true, a0: { type: "together", label: "Long Run 8km", detail: "At 6:30–6:45/km, Zone 2. Steady aerobic effort, fuel as you go.", metric: "Avg pace /km" }, a1: { type: "together", label: "Long Run 8km", detail: "At 6:30–6:45/km, Zone 2. Steady — relax and talk, fuel as you go.", metric: "Avg pace /km" } },
      { day: "Sun", a0: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null }, a1: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null } },
    ],
  },
  {
    week: 6, phase: 2, focus: "New shape: split strength, sled day, Sunday long run.",
    days: [
      { day: "Mon", a0: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null }, a1: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null } },
      { day: "Tue", shared: true, a0: { type: "strength", label: "Strength A", detail: "Heavier loads. Back squat 4×6 · RDL 3×8 · Walking lunges 3×20/leg · Kettlebell carry 3×100m · Calf raises 3×15.", metric: "Top weight" }, a1: { type: "strength", label: "Strength A", detail: "Same session, your loads. Back squat 4×6 · RDL 3×8 · Walking lunges 3×20/leg · Kettlebell carry 3×100m · Wall balls 2×15 (6kg, your accessory).", metric: "Top weight" } },
      { day: "Wed", shared: true, a0: { type: "together", label: "Easy Run 5km", detail: "At 6:15–6:30/km, Zone 2, conversational. Hold back — this is the team pace.", metric: "Avg pace /km" }, a1: { type: "together", label: "Easy Run 5km", detail: "At 6:15–6:30/km, Zone 2, conversational. This is your race pace — own it.", metric: "Avg pace /km" } },
      { day: "Thu", shared: true, a0: { type: "sled", label: "SLED @ RACE WEIGHT", detail: "Sled push 4×12.5m @ 152kg + pull 4×12.5m @ 103kg (or max). Alternate, full rest. Finish: 2km easy run together. Benchmark — log everything.", metric: "Push/pull weights" }, a1: { type: "sled", label: "SLED @ RACE WEIGHT", detail: "Sled push 4×12.5m + pull 4×12.5m at real weight (or your max) — take your relief reps, you step in race day. Finish: 2km easy run together. Log everything.", metric: "Push/pull weights" } },
      { day: "Fri", shared: true, a0: { type: "strength", label: "Strength B", detail: "Heavier loads. Deadlift 4×5 · Bent-over row 3×8 · Sandbag lunges 3×20m · Burpee broad jumps 3×8.", metric: "Top weight" }, a1: { type: "strength", label: "Strength B", detail: "Same session, your loads. Deadlift 4×5 · Bent-over row 3×8 · Sandbag lunges 3×20m · Burpee broad jumps 4×8 (your accessory).", metric: "Top weight" } },
      { day: "Sat", a0: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null }, a1: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null } },
      { day: "Sun", shared: true, a0: { type: "together", label: "Long Run 9km", detail: "At 6:30–6:45/km, Zone 2. Steady aerobic effort, fuel as you go.", metric: "Avg pace /km" }, a1: { type: "together", label: "Long Run 9km", detail: "At 6:30–6:45/km, Zone 2. Steady — relax and talk, fuel as you go.", metric: "Avg pace /km" } },
    ],
  },
  {
    week: 7, phase: 2, focus: "Midweek brick, conditioning Friday. Mix it up.",
    days: [
      { day: "Mon", shared: true, a0: { type: "together", label: "Easy Run 6km", detail: "At 6:15–6:30/km, Zone 2, conversational. Hold back — this is the team pace.", metric: "Avg pace /km" }, a1: { type: "together", label: "Easy Run 6km", detail: "At 6:15–6:30/km, Zone 2, conversational. This is your race pace — own it.", metric: "Avg pace /km" } },
      { day: "Tue", a0: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null }, a1: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null } },
      { day: "Wed", shared: true, a0: { type: "brick", label: "BRICK — Sled Sandwich", detail: "3×(800m run + sled push 12.5m + 800m run + sled pull 12.5m). Run every leg together at race pace, alternate the sleds.", metric: "Round times" }, a1: { type: "brick", label: "BRICK — Sled Sandwich", detail: "3×(800m run + sled push + 800m run + sled pull). Take your share of each sled, run every 800m together.", metric: "Round times" } },
      { day: "Thu", shared: true, a0: { type: "strength", label: "Strength A", detail: "Heavier loads. Back squat 4×6 · RDL 3×8 · Walking lunges 3×20/leg · Kettlebell carry 3×100m · Calf raises 3×15.", metric: "Top weight" }, a1: { type: "strength", label: "Strength A", detail: "Same session, your loads. Back squat 4×6 · RDL 3×8 · Walking lunges 3×20/leg · Kettlebell carry 3×100m · Wall balls 2×15 (6kg, your accessory).", metric: "Top weight" } },
      { day: "Fri", shared: true, optional: true, a0: { type: "conditioning", label: "Optional — Conditioning", detail: "5 Rounds For Time: 400m run · 20 walking lunges · 15 sit-ups · 10 burpee broad jumps. NOTES: Push the rounds but keep running form relaxed off the floor work. Note your total time. Optional.", metric: "Rounds / time" }, a1: { type: "conditioning", label: "Optional — Conditioning", detail: "5 Rounds For Time: 400m run · 20 walking lunges · 15 sit-ups · 10 burpee broad jumps. NOTES: Push the rounds but keep running form relaxed off the floor work. Note your total time. Optional.", metric: "Rounds / time" } },
      { day: "Sat", shared: true, a0: { type: "together", label: "Long Run 10km", detail: "At 6:30–6:45/km, Zone 2. Steady aerobic effort, fuel as you go.", metric: "Avg pace /km" }, a1: { type: "together", label: "Long Run 10km", detail: "At 6:30–6:45/km, Zone 2. Steady — relax and talk, fuel as you go.", metric: "Avg pace /km" } },
      { day: "Sun", a0: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null }, a1: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null } },
    ],
  },
  {
    week: 8, phase: 2, focus: "Deload. Recover before the final build.",
    days: [
      { day: "Mon", shared: true, a0: { type: "strength", label: "Strength (light)", detail: "Deload — 70% loads. Back squat 3×5 · RDL 3×6 · Walking lunges 2×16/leg. Keep it easy.", metric: "Top weight" }, a1: { type: "strength", label: "Strength (light)", detail: "Deload — 70% loads. Back squat 3×5 · RDL 3×6 · Walking lunges 2×16/leg · Wall balls 2×12 easy. Keep it easy.", metric: "Top weight" } },
      { day: "Tue", shared: true, a0: { type: "together", label: "Easy Run 4km", detail: "At 6:15–6:30/km, Zone 2, conversational. Hold back — this is the team pace.", metric: "Avg pace /km" }, a1: { type: "together", label: "Easy Run 4km", detail: "At 6:15–6:30/km, Zone 2, conversational. This is your race pace — own it.", metric: "Avg pace /km" } },
      { day: "Wed", a0: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null }, a1: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null } },
      { day: "Thu", a0: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null }, a1: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null } },
      { day: "Fri", a0: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null }, a1: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null } },
      { day: "Sat", shared: true, a0: { type: "together", label: "Long Run 7km", detail: "At 6:30–6:45/km, Zone 2. Steady aerobic effort, fuel as you go.", metric: "Avg pace /km" }, a1: { type: "together", label: "Long Run 7km", detail: "At 6:30–6:45/km, Zone 2. Steady — relax and talk, fuel as you go.", metric: "Avg pace /km" } },
      { day: "Sun", a0: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null }, a1: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null } },
    ],
  },
  {
    week: 9, phase: 2, focus: "Peak build week. Everything at race intensity.",
    days: [
      { day: "Mon", shared: true, a0: { type: "strength", label: "Strength A", detail: "Heavier loads. Back squat 4×6 · RDL 3×8 · Walking lunges 3×20/leg · Kettlebell carry 3×100m · Calf raises 3×15.", metric: "Top weight" }, a1: { type: "strength", label: "Strength A", detail: "Same session, your loads. Back squat 4×6 · RDL 3×8 · Walking lunges 3×20/leg · Kettlebell carry 3×100m · Wall balls 2×15 (6kg, your accessory).", metric: "Top weight" } },
      { day: "Tue", shared: true, a0: { type: "together", label: "Easy Run 6km", detail: "At 6:15–6:30/km, Zone 2, conversational. Hold back — this is the team pace.", metric: "Avg pace /km" }, a1: { type: "together", label: "Easy Run 6km", detail: "At 6:15–6:30/km, Zone 2, conversational. This is your race pace — own it.", metric: "Avg pace /km" } },
      { day: "Wed", shared: true, optional: true, a0: { type: "conditioning", label: "Optional — Conditioning", detail: "AMRAP 18:00: 250m row · 12 wall balls · 12 jumping lunges · 8 burpees. NOTES: Last hard optional before taper — only if fresh. Quick transitions. Optional.", metric: "Rounds / time" }, a1: { type: "conditioning", label: "Optional — Conditioning", detail: "AMRAP 18:00: 250m row · 12 wall balls · 12 jumping lunges · 8 burpees. NOTES: Last hard optional before taper — only if fresh. Quick transitions. Optional.", metric: "Rounds / time" } },
      { day: "Thu", shared: true, a0: { type: "brick", label: "BRICK — Race Pace", detail: "4×(sled push 12.5m @ race wt + 1km at 6:15/km). The exact race demand — alternate sleds, run together.", metric: "Round times" }, a1: { type: "brick", label: "BRICK — Race Pace", detail: "4×(sled push 12.5m @ race wt + 1km at your pace). Take your sled share, run every km together.", metric: "Round times" } },
      { day: "Fri", a0: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null }, a1: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null } },
      { day: "Sat", shared: true, a0: { type: "together", label: "Long Run 11km", detail: "At 6:30–6:45/km, Zone 2. Steady aerobic effort, fuel as you go.", metric: "Avg pace /km" }, a1: { type: "together", label: "Long Run 11km", detail: "At 6:30–6:45/km, Zone 2. Steady — relax and talk, fuel as you go.", metric: "Avg pace /km" } },
      { day: "Sun", a0: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null }, a1: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null } },
    ],
  },
  {
    week: 10, phase: 3, focus: "RACE SIMULATION week. Full dress rehearsal.",
    days: [
      { day: "Mon", shared: true, a0: { type: "strength", label: "Strength (moderate)", detail: "Moderate loads. Back squat 3×5 · RDL 3×6 · Walking lunges 2×16/leg. Touch every movement, nothing new.", metric: "Top weight" }, a1: { type: "strength", label: "Strength (moderate)", detail: "Moderate loads. Back squat 3×5 · RDL 3×6 · Walking lunges 2×16/leg · Wall balls 2×12. Touch every movement, nothing new.", metric: "Top weight" } },
      { day: "Tue", shared: true, a0: { type: "together", label: "Easy Run 5km", detail: "At 6:15–6:30/km, Zone 2, conversational. Hold back — this is the team pace.", metric: "Avg pace /km" }, a1: { type: "together", label: "Easy Run 5km", detail: "At 6:15–6:30/km, Zone 2, conversational. This is your race pace — own it.", metric: "Avg pace /km" } },
      { day: "Wed", a0: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null }, a1: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null } },
      { day: "Thu", shared: true, a0: { type: "together", label: "Shakeout 3km", detail: "Very easy, just moving the legs. Stay relaxed.", metric: "Avg pace /km" }, a1: { type: "together", label: "Shakeout 3km", detail: "Very easy, just moving. Stay loose.", metric: "Avg pace /km" } },
      { day: "Fri", a0: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null }, a1: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null } },
      { day: "Sat", shared: true, a0: { type: "race_sim", label: "🏁 FULL RACE SIM", detail: "8×(1km run + station) using your locked splits. Run every km together, alternate sleds, clean transitions. Time EVERYTHING — runs, stations, transitions. This is your race plan.", metric: "Total time" }, a1: { type: "race_sim", label: "🏁 FULL RACE SIM", detail: "Full simulation together. Log total time and every split you can.", metric: "Total time" } },
      { day: "Sun", a0: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null }, a1: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null } },
    ],
  },
  {
    week: 11, phase: 3, focus: "Sharpen. Fix what the sim exposed.",
    days: [
      { day: "Mon", shared: true, a0: { type: "strength", label: "Strength (light)", detail: "Deload — 70% loads. Back squat 3×5 · RDL 3×6 · Walking lunges 2×16/leg. Keep it easy.", metric: "Top weight" }, a1: { type: "strength", label: "Strength (light)", detail: "Deload — 70% loads. Back squat 3×5 · RDL 3×6 · Walking lunges 2×16/leg · Wall balls 2×12 easy. Keep it easy.", metric: "Top weight" } },
      { day: "Tue", shared: true, a0: { type: "together", label: "Easy Run 4km", detail: "At 6:15–6:30/km, Zone 2, conversational. Hold back — this is the team pace.", metric: "Avg pace /km" }, a1: { type: "together", label: "Easy Run 4km", detail: "At 6:15–6:30/km, Zone 2, conversational. This is your race pace — own it.", metric: "Avg pace /km" } },
      { day: "Wed", shared: true, optional: true, a0: { type: "conditioning", label: "Optional — Conditioning", detail: "AMRAP 12:00 (light): 200m run · 10 wall balls · 10 air squats. Easy spin. NOTES: Keep it light — race is close. Optional.", metric: "Rounds / time" }, a1: { type: "conditioning", label: "Optional — Conditioning", detail: "AMRAP 12:00 (light): 200m run · 10 wall balls · 10 air squats. Easy spin. NOTES: Keep it light — race is close. Optional.", metric: "Rounds / time" } },
      { day: "Thu", shared: true, a0: { type: "brick", label: "BRICK — Weakness Fix", detail: "3×(800m race pace + whatever the sim exposed — sled, WB, or transitions). Short and sharp.", metric: "Round times" }, a1: { type: "brick", label: "BRICK — Weakness Fix", detail: "3×(800m race pace + your weakest station from the sim). Short, sharp. Attack the gap.", metric: "Round times" } },
      { day: "Fri", a0: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null }, a1: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null } },
      { day: "Sat", shared: true, a0: { type: "together", label: "Long Run 7km", detail: "At 6:30–6:45/km, Zone 2. Steady aerobic effort, fuel as you go.", metric: "Avg pace /km" }, a1: { type: "together", label: "Long Run 7km", detail: "At 6:30–6:45/km, Zone 2. Steady — relax and talk, fuel as you go.", metric: "Avg pace /km" } },
      { day: "Sun", a0: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null }, a1: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null } },
    ],
  },
  {
    week: 12, phase: 3, focus: "RACE WEEK. Protect the legs. Trust the work.",
    days: [
      { day: "Mon", shared: true, a0: { type: "together", label: "Shakeout 3km", detail: "Very easy, just moving the legs. Stay relaxed.", metric: "Avg pace /km" }, a1: { type: "together", label: "Shakeout 3km", detail: "Very easy, just moving. Stay loose.", metric: "Avg pace /km" } },
      { day: "Tue", a0: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null }, a1: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null } },
      { day: "Wed", shared: true, a0: { type: "together", label: "Shakeout 2km", detail: "Very easy, just moving the legs. Stay relaxed.", metric: "Avg pace /km" }, a1: { type: "together", label: "Shakeout 2km", detail: "Very easy, just moving. Stay loose.", metric: "Avg pace /km" } },
      { day: "Thu", shared: true, a0: { type: "race_sim", label: "🏁 RACE DAY", detail: "Run together at the team pace, every lap. Lead athlete takes sleds + sandbag, partner leads WB + BBJ, even on farmers/ski/row. Clean transitions. Enjoy it.", metric: "RACE TIME" }, a1: { type: "race_sim", label: "🏁 RACE DAY", detail: "Your pace sets the race. Steady runs, attack your stations. You're ready.", metric: "RACE TIME" } },
      { day: "Fri", a0: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null }, a1: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null } },
      { day: "Sat", a0: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null }, a1: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null } },
      { day: "Sun", a0: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null }, a1: { type: "rest", label: "Rest / Mobility", detail: "Recovery.", metric: null } },
    ],
  },
];

// Generic station split strategy in HYROX race order — references Athlete 1 / Athlete 2.
const splitStrategy = [
  { station: "Ski Erg 1000m",                lead: "Athlete 2 50–60%",  note: "Take a touch more so the sled lead recovers." },
  { station: "Sled Push 50m · 152kg",        lead: "Athlete 1 ~70%",    note: "Stronger athlete leads; partner relieves when needed. Both train it." },
  { station: "Sled Pull 50m · 103kg",        lead: "Athlete 1 ~70%",    note: "Same model — one grinds, the other gives recovery windows." },
  { station: "Burpee Broad Jumps 80m",       lead: "Athlete 2 ~60%",    note: "One athlete's strength — but both still train and share them." },
  { station: "Row 1000m",                    lead: "Athlete 2 50–60%",  note: "Machines buy the sled lead recovery." },
  { station: "Farmers Carry 200m · 2×24kg", lead: "Even",              note: "~50/50. No forward passing." },
  { station: "Sandbag Lunges 100m · 20kg",  lead: "Athlete 1 ~60%",    note: "Stronger athlete takes the bigger share. Pass sideways/back only." },
  { station: "Wall Balls 100 reps · 6kg",   lead: "Athlete 2 ~60%",    note: "Lead in big sets, partner covers the rest." },
];

// ── STORAGE (Supabase-backed shared KV; falls back silently on error) ─────────
const SUPABASE_URL = "https://srbgpxuvrfyxbgbftcop.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyYmdweHV2cmZ5eGJnYmZ0Y29wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MTk0MTUsImV4cCI6MjA5NzI5NTQxNX0.QcCd8EbvUjyoHeQYHQKVnTpVWxITmjCyEPIJPCVCWQo";

const sb = async (method, path, body) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Prefer: "return=representation,resolution=merge-duplicates",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Supabase ${method} ${path} failed: ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
};

const storage = {
  get: async (key) => {
    try {
      const rows = await sb("GET", `kv_store?key=eq.${encodeURIComponent(key)}&select=value`);
      return rows && rows.length ? { value: rows[0].value } : null;
    } catch (e) { console.error("storage.get failed", e); return null; }
  },
  set: async (key, value) => {
    try {
      await sb("POST", "kv_store?on_conflict=key", { key, value: String(value) });
      return { value };
    } catch (e) { console.error("storage.set failed", e); return null; }
  },
};

const storageKey = (athleteIdx) => `hyrox-${PLAN_ID}-logs-a${athleteIdx}`;

export default function HyroxTrainingApp() {
  // Config in state so dropdowns can override CLIENT defaults at runtime.
  const [cfg, setCfg] = useState(() => JSON.parse(JSON.stringify(CLIENT)));
  const fmt = FORMATS[cfg.formatId] || FORMATS.mixed_doubles;
  const nAth = fmt.athletes;

  const [athleteIdx, setAthleteIdx] = useState(0);
  const [view, setView] = useState("week");
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [logs, setLogs] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [openLog, setOpenLog] = useState(null);
  const [draft, setDraft] = useState({ metric: "", notes: "" });
  const [startId, setStartId] = useState(cfg.startOptions[0]?.id);
  const [themeMode, setThemeMode] = useState("auto");
  const [units, setUnits] = useState(cfg.defaultUnits || "us");
  const [showCountdown, setShowCountdown] = useState(false);
  const [, setTick] = useState(0);
  const [coachNotes, setCoachNotes] = useState({});
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [editingNames, setEditingNames] = useState(false);

  useEffect(() => {
    if (!showCountdown) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [showCountdown]);

  // Load persisted bits
  useEffect(() => {
    (async () => {
      try { const r = await storage.get(`hyrox-${PLAN_ID}-theme`); if (r?.value && ["auto","light","dark"].includes(r.value)) setThemeMode(r.value); } catch (e) {}
      try { const r = await storage.get(`hyrox-${PLAN_ID}-units`); if (r?.value && ["us","metric"].includes(r.value)) setUnits(r.value); } catch (e) {}
      try { const r = await storage.get(`hyrox-${PLAN_ID}-coach-notes`); if (r?.value) setCoachNotes(JSON.parse(r.value)); } catch (e) {}
      try { const r = await storage.get(`hyrox-${PLAN_ID}-start`); if (r?.value) setStartId(r.value); } catch (e) {}
      try { const r = await storage.get(`hyrox-${PLAN_ID}-cfg`); if (r?.value) setCfg(JSON.parse(r.value)); } catch (e) {}
      const next = {};
      for (let i = 0; i < 4; i++) {
        try { const r = await storage.get(storageKey(i)); if (r?.value) next[i] = JSON.parse(r.value); } catch (e) {}
      }
      setLogs(next);
      setLoaded(true);
    })();
  }, []);

  const persistCfg = async (next) => {
    setCfg(next);
    try { await storage.set(`hyrox-${PLAN_ID}-cfg`, JSON.stringify(next)); } catch (e) {}
  };
  const changeTheme = async (m) => { setThemeMode(m); try { await storage.set(`hyrox-${PLAN_ID}-theme`, m); } catch (e) {} };
  const changeUnits = async (u) => { setUnits(u); try { await storage.set(`hyrox-${PLAN_ID}-units`, u); } catch (e) {} };
  const changeStart = async (id) => { setStartId(id); try { await storage.set(`hyrox-${PLAN_ID}-start`, id); } catch (e) {} };
  const saveNote = async (week) => {
    const updated = { ...coachNotes, [week]: noteDraft };
    setCoachNotes(updated); setEditingNote(false);
    try { await storage.set(`hyrox-${PLAN_ID}-coach-notes`, JSON.stringify(updated)); } catch (e) {}
  };

  const resolvedTheme = themeMode === "auto" ? autoTheme() : themeMode;
  const T = palettes[resolvedTheme];

  const athleteAt = (i) => {
    const base = cfg.athletes[i] || { name: `Athlete ${i + 1}`, role: "", pace: "" };
    return { ...base, color: base.color || ATHLETE_COLORS[i % ATHLETE_COLORS.length] };
  };
  const a = athleteAt(athleteIdx);
  const teamName = cfg.teamName || autoTeamName(cfg.athletes.slice(0, nAth));

  // Day → this athlete's entry. Relay athletes (idx 2,3) fall back to a0.
  const entryFor = (day) => day[`a${athleteIdx}`] || day.a0;

  const startISO = (cfg.startOptions.find(o => o.id === startId) || cfg.startOptions[0]).iso;
  const planWeeks = weekPlan.slice(0, cfg.weeks);
  const weekData = planWeeks.find(w => w.week === selectedWeek) || planWeeks[0];
  const myLogs = logs[athleteIdx] || {};

  const saveLogs = async (updated) => {
    setLogs(prev => ({ ...prev, [athleteIdx]: updated }));
    try { await storage.set(storageKey(athleteIdx), JSON.stringify(updated)); } catch (e) {}
  };
  const toggleDone = (key) => {
    const e = myLogs[key] || {};
    saveLogs({ ...myLogs, [key]: { ...e, done: !e.done, date: new Date().toISOString().slice(0, 10) } });
  };
  const submitLog = (key) => {
    const e = myLogs[key] || {};
    saveLogs({ ...myLogs, [key]: { ...e, done: true, metric: draft.metric, notes: draft.notes, date: new Date().toISOString().slice(0, 10) } });
    setOpenLog(null); setDraft({ metric: "", notes: "" });
  };

  // Progress stats — optional sessions excluded.
  const weekStats = planWeeks.map(w => {
    const sessions = w.days.filter(d => entryFor(d).type !== "rest" && !d.optional);
    const done = sessions.filter(d => myLogs[`w${w.week}-${d.day}`]?.done).length;
    return { week: w.week, total: sessions.length, done };
  });
  const totalDone = weekStats.reduce((s, w) => s + w.done, 0);
  const totalSessions = weekStats.reduce((s, w) => s + w.total, 0);

  const runTypes = new Set(["run_easy", "run_pace", "run_long", "together"]);
  const paceByWeek = planWeeks.map(w => {
    const paces = w.days.filter(d => runTypes.has(entryFor(d).type))
      .map(d => parsePace(myLogs[`w${w.week}-${d.day}`]?.metric)).filter(v => v != null);
    return { week: w.week, avg: paces.length ? paces.reduce((s, v) => s + v, 0) / paces.length : null };
  });
  const loggedPaces = paceByWeek.filter(p => p.avg != null);
  const paceMin = loggedPaces.length ? Math.min(...loggedPaces.map(p => p.avg)) : 0;
  const paceMax = loggedPaces.length ? Math.max(...loggedPaces.map(p => p.avg)) : 0;
  const paceRange = Math.max(0.5, paceMax - paceMin);
  const recentEntries = Object.entries(myLogs).filter(([, v]) => v.metric)
    .sort((x, y) => (y[1].date || "").localeCompare(x[1].date || "")).slice(0, 12);

  // Display helper: pace axis label respects unit toggle.
  const axisPaceLabel = (decKm) => units === "us" ? `${paceLabel(decKm * KM_PER_MI)}` : paceLabel(decKm);
  const paceUnitSuffix = units === "us" ? "/mi" : "/km";

  const tabBtn = (id, label) => (
    <button key={id} onClick={() => setView(id)} style={{
      background: "none", border: "none", cursor: "pointer", padding: "8px 10px", fontSize: 12,
      fontWeight: view === id ? 700 : 400, color: view === id ? a.color : T.faint,
      borderBottom: view === id ? `2px solid ${a.color}` : "2px solid transparent", letterSpacing: "0.04em",
    }}>{label}</button>
  );

  const selectStyle = { background: T.card, color: T.strong, border: `1px solid ${T.border2}`, borderRadius: 8, padding: "5px 8px", fontSize: 12, fontWeight: 600, cursor: "pointer", maxWidth: "100%" };

  return (
    <div style={{ background: T.bg, minHeight: "100vh", color: T.text, fontFamily: "'Avenir Next', 'Segoe UI', system-ui, sans-serif" }}>
      {/* HEADER */}
      <div style={{ background: T.headerBg, borderBottom: `1px solid ${T.border}`, padding: "16px 16px 0" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>

          {/* FORMAT + RACE selectors */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <select value={cfg.formatId} onChange={e => {
              const formatId = e.target.value; const newN = FORMATS[formatId].athletes;
              const athletes = [...cfg.athletes];
              while (athletes.length < newN) athletes.push({ name: `Athlete ${athletes.length + 1}`, role: "", pace: "" });
              persistCfg({ ...cfg, formatId, athletes: athletes.slice(0, newN) });
              setAthleteIdx(0);
            }} style={selectStyle}>
              {Object.entries(FORMATS).map(([id, f]) => <option key={id} value={id}>{f.label}</option>)}
            </select>

            <select value={cfg.raceName} onChange={e => {
              const r = RACES.find(x => x.name === e.target.value);
              if (r) persistCfg({ ...cfg, raceName: r.name, raceCity: r.city, raceISO: r.iso + "T07:00:00" });
            }} style={selectStyle}>
              {!RACES.find(x => x.name === cfg.raceName) && <option value={cfg.raceName}>{cfg.raceName}</option>}
              {RACES.map(r => <option key={r.name} value={r.name}>{r.city} · {fmtRaceDate(r.iso + "T07:00:00")}</option>)}
            </select>

            <button onClick={() => setShowSettings(s => !s)} style={{ ...selectStyle, fontWeight: 700 }}>⚙</button>
          </div>

          {/* SETTINGS panel */}
          {showSettings && (
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: T.faint, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Plan settings</div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: T.dim }}>Plan length:</span>
                {[8, 12, 16].map(w => (
                  <button key={w} onClick={() => { persistCfg({ ...cfg, weeks: w }); if (selectedWeek > w) setSelectedWeek(1); }} style={{
                    background: cfg.weeks === w ? a.color : "none", border: `1px solid ${cfg.weeks === w ? a.color : T.border2}`,
                    color: cfg.weeks === w ? "#07070e" : T.dim, borderRadius: 12, padding: "3px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer",
                  }}>{w} wk</button>
                ))}
                {weekPlan.length < cfg.weeks && <span style={{ fontSize: 10, color: "#f59e0b" }}>Plan data has {weekPlan.length} wks — extend weekPlan.</span>}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: T.dim }}>Team name:</span>
                <input value={cfg.teamName} onChange={e => persistCfg({ ...cfg, teamName: e.target.value })}
                  placeholder={autoTeamName(cfg.athletes.slice(0, nAth))}
                  style={{ background: T.inset, border: `1px solid ${T.border2}`, borderRadius: 6, padding: "6px 10px", color: T.text, fontSize: 12, flex: 1, minWidth: 140 }} />
              </div>
              <button onClick={() => setEditingNames(v => !v)} style={{ background: "none", border: `1px solid ${T.border2}`, color: T.dim, borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>
                {editingNames ? "Done editing names" : "Edit athlete names"}
              </button>
              {editingNames && (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                  {Array.from({ length: nAth }).map((_, i) => (
                    <input key={i} value={cfg.athletes[i]?.name || ""} onChange={e => {
                      const athletes = [...cfg.athletes]; athletes[i] = { ...(athletes[i] || { role: "", pace: "" }), name: e.target.value };
                      persistCfg({ ...cfg, athletes });
                    }} placeholder={`Athlete ${i + 1}`}
                      style={{ background: T.inset, border: `1px solid ${T.border2}`, borderRadius: 6, padding: "6px 10px", color: T.text, fontSize: 12 }} />
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ fontSize: 9, letterSpacing: "0.18em", color: T.faint, textTransform: "uppercase", marginBottom: 6 }}>
            {fmt.label} · {cfg.raceCity} · {fmtRaceDate(cfg.raceISO)}
          </div>

          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: a.color, letterSpacing: "-1px" }}>{teamName}</div>
            <button onClick={() => setShowCountdown(v => !v)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: T.body, fontSize: 12, textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 3 }}>
              {showCountdown ? "show summary" : `${cfg.weeks} weeks · ${cfg.tagline}`}
            </button>
          </div>

          {showCountdown && (() => {
            const c = countdownParts(cfg.raceISO);
            const cell = (val, lbl) => (
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ background: "#1a1a22", borderRadius: 8, padding: "10px 0", position: "relative" }}>
                  <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 1, background: "rgba(0,0,0,0.45)" }} />
                  <div style={{ fontSize: 32, fontWeight: 900, color: "#f2f2f2", fontVariantNumeric: "tabular-nums", lineHeight: 1, letterSpacing: "1px" }}>{String(val).padStart(2, "0")}</div>
                </div>
                <div style={{ fontSize: 9, color: "#f0c020", textTransform: "uppercase", letterSpacing: "0.12em", marginTop: 5, fontWeight: 700 }}>{lbl}</div>
              </div>
            );
            return (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 9, color: T.faint, textTransform: "uppercase", letterSpacing: "0.18em", textAlign: "center", marginBottom: 8 }}>Race day · {fmtRaceDate(cfg.raceISO)} · {cfg.raceCity}</div>
                <div style={{ display: "flex", gap: 8, maxWidth: 420, margin: "0 auto" }}>
                  {cell(c.days, "Days")}{cell(c.hours, "Hours")}{cell(c.minutes, "Minutes")}{cell(c.seconds, "Seconds")}
                </div>
              </div>
            );
          })()}

          {/* THEME + UNITS row */}
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 9, color: T.faint, textTransform: "uppercase", letterSpacing: "0.1em" }}>Theme:</span>
            {["auto", "light", "dark"].map(m => (
              <button key={m} onClick={() => changeTheme(m)} style={{
                background: themeMode === m ? (resolvedTheme === "light" ? "#e8e8f0" : "#1a1a2e") : "none",
                border: `1px solid ${themeMode === m ? a.color : T.border2}`, color: themeMode === m ? a.color : T.dim,
                borderRadius: 12, padding: "3px 10px", fontSize: 10, fontWeight: 600, cursor: "pointer", textTransform: "capitalize",
              }}>{m}</button>
            ))}
            <span style={{ fontSize: 9, color: T.faint, textTransform: "uppercase", letterSpacing: "0.1em", marginLeft: 8 }}>Units:</span>
            {[["metric", "Metric"], ["us", "US"]].map(([id, lbl]) => (
              <button key={id} onClick={() => changeUnits(id)} style={{
                background: units === id ? (resolvedTheme === "light" ? "#e8e8f0" : "#1a1a2e") : "none",
                border: `1px solid ${units === id ? a.color : T.border2}`, color: units === id ? a.color : T.dim,
                borderRadius: 12, padding: "3px 10px", fontSize: 10, fontWeight: 600, cursor: "pointer",
              }}>{lbl}</button>
            ))}
          </div>

          {/* ATHLETE TOGGLE — only when team */}
          {nAth > 1 && (
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              {Array.from({ length: nAth }).map((_, i) => {
                const at = athleteAt(i);
                return (
                  <button key={i} onClick={() => setAthleteIdx(i)} style={{
                    flex: nAth <= 2 ? 1 : "1 1 45%", cursor: "pointer", borderRadius: 10, padding: "10px 12px", textAlign: "left",
                    background: athleteIdx === i ? `${at.color}22` : T.card, border: `1.5px solid ${athleteIdx === i ? at.color : T.border}`,
                  }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: athleteIdx === i ? at.color : T.dim }}>{at.name}</div>
                    {at.role ? <div style={{ fontSize: 10, color: athleteIdx === i ? T.body : T.faint, marginTop: 2 }}>{at.role}</div> : null}
                  </button>
                );
              })}
            </div>
          )}
          {a.pace ? <div style={{ fontSize: 11, color: T.body, marginBottom: 10 }}>📌 {a.pace}</div> : null}

          {selectedWeek === 1 && cfg.startOptions.length > 0 && (
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 9, color: T.faint, textTransform: "uppercase", letterSpacing: "0.1em" }}>Plan start:</span>
              {cfg.startOptions.map(o => (
                <button key={o.id} onClick={() => changeStart(o.id)} style={{
                  background: startId === o.id ? T.border : "none", border: `1px solid ${startId === o.id ? a.color : T.border2}`,
                  color: startId === o.id ? a.color : T.dim, borderRadius: 12, padding: "3px 10px", fontSize: 10, fontWeight: 600, cursor: "pointer",
                }}>{o.label}</button>
              ))}
            </div>
          )}

          {weeklyQuotes[selectedWeek] && (
            <div style={{ fontSize: 12, fontStyle: "italic", color: T.body, marginBottom: 10, lineHeight: 1.5 }}>
              "{weeklyQuotes[selectedWeek].q}" <span style={{ fontStyle: "normal", color: T.faint }}>— {weeklyQuotes[selectedWeek].by}</span>
            </div>
          )}

          <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            {tabBtn("week", "This Week")}{tabBtn("overview", "Plan")}
            {fmt.team && tabBtn("strategy", "Race Strategy")}{tabBtn("progress", "Progress")}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "18px 14px 60px" }}>
        {/* WEEK */}
        {view === "week" && (
          <div>
            <div style={{ display: "flex", gap: 4, marginBottom: 14, flexWrap: "wrap" }}>
              {planWeeks.map(w => (
                <button key={w.week} onClick={() => setSelectedWeek(w.week)} style={{
                  background: selectedWeek === w.week ? phaseColors[w.phase] : T.card,
                  border: `1px solid ${selectedWeek === w.week ? phaseColors[w.phase] : T.border}`,
                  color: selectedWeek === w.week ? "#07070e" : T.dim, borderRadius: 6, padding: "6px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer",
                }}>W{w.week}</button>
              ))}
            </div>
            {weekData && (
              <div>
                <div style={{ background: T.card, border: `1px solid ${phaseColors[weekData.phase]}40`, borderRadius: 10, padding: "10px 14px", marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: phaseColors[weekData.phase], textTransform: "uppercase", letterSpacing: "0.1em" }}>Week {weekData.week} · Phase {weekData.phase} · {weekRange(startISO, weekData.week)}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.strong, marginTop: 3 }}>{weekData.focus}</div>
                  <div style={{ marginTop: 8, borderTop: `1px solid ${T.border}`, paddingTop: 8 }}>
                    {!editingNote ? (
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                        <div style={{ fontSize: 11.5, color: coachNotes[weekData.week] ? "#f0c020" : T.faint, lineHeight: 1.5 }}>📣 {coachNotes[weekData.week] || "No coach's note this week."}</div>
                        <button onClick={() => { setEditingNote(true); setNoteDraft(coachNotes[weekData.week] || ""); }} style={{ background: "none", border: `1px solid ${T.border2}`, color: T.dim, borderRadius: 6, padding: "3px 8px", fontSize: 10, cursor: "pointer", flexShrink: 0 }}>Edit</button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <textarea value={noteDraft} onChange={e => setNoteDraft(e.target.value)} rows={3} placeholder="Coach's adjustment for this week (visible to everyone)…"
                          style={{ background: T.inset, border: `1px solid ${T.border2}`, borderRadius: 6, padding: "8px 10px", color: T.text, fontSize: 12, fontFamily: "inherit", resize: "vertical" }} />
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => saveNote(weekData.week)} style={{ background: "#f0c020", border: "none", color: "#07070e", borderRadius: 6, padding: "6px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Save note</button>
                          <button onClick={() => setEditingNote(false)} style={{ background: "none", border: `1px solid ${T.border2}`, color: T.dim, borderRadius: 6, padding: "6px 12px", fontSize: 11, cursor: "pointer" }}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {weekData.days.map((d) => {
                    const s = entryFor(d); const st = sessionTypes[s.type] || sessionTypes.rest;
                    const key = `w${weekData.week}-${d.day}`; const entry = myLogs[key];
                    const isOpen = openLog === key; const isRest = s.type === "rest";
                    const detailText = annotateStationWeights(s.detail, units);
                    const metricLabel = unitizeMetricLabel(s.metric, units);
                    return (
                      <div key={d.day} style={{ background: resolvedTheme === "light" ? `${st.color}14` : st.bg, border: `1px solid ${entry?.done ? st.color : T.border}`, borderRadius: 10, padding: "10px 12px" }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                          <div style={{ width: 34, flexShrink: 0 }}>
                            <div style={{ fontSize: 10, color: T.faint, fontWeight: 700 }}>{d.day}</div>
                            <div style={{ fontSize: 17, marginTop: 2 }}>{st.icon}</div>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: st.color }}>{s.label}{d.optional && <span style={{ fontSize: 9, color: "#a78bfa", marginLeft: 6, fontWeight: 600 }}>OPTIONAL</span>}{d.shared && fmt.team && !d.optional && <span style={{ fontSize: 9, color: "#ec4899", marginLeft: 6, fontWeight: 600 }}>TOGETHER</span>}</div>
                            <div style={{ fontSize: 11.5, color: T.body, marginTop: 3, lineHeight: 1.5 }}>{detailText}</div>
                            {entry?.metric && <div style={{ fontSize: 11, color: st.color, marginTop: 5, fontWeight: 600 }}>📊 {entry.metric}{entry.notes ? ` — ${entry.notes}` : ""}</div>}
                          </div>
                          {!isRest && (
                            <button onClick={() => toggleDone(key)} aria-label="Mark complete" style={{ width: 26, height: 26, borderRadius: 13, flexShrink: 0, cursor: "pointer", background: entry?.done ? st.color : "transparent", border: `2px solid ${entry?.done ? st.color : T.border2}`, color: "#07070e", fontSize: 13, fontWeight: 900, lineHeight: 1 }}>{entry?.done ? "✓" : ""}</button>
                          )}
                        </div>
                        {!isRest && s.metric && (
                          <div style={{ marginTop: 8 }}>
                            {!isOpen ? (
                              <button onClick={() => { setOpenLog(key); setDraft({ metric: entry?.metric || "", notes: entry?.notes || "" }); }} style={{ background: "none", border: `1px solid ${T.border2}`, color: T.body, borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>{entry?.metric ? "Edit log" : `Log: ${metricLabel}`}</button>
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                <input value={draft.metric} onChange={e => setDraft(p => ({ ...p, metric: e.target.value }))} placeholder={metricLabel} style={{ background: T.inset, border: `1px solid ${T.border2}`, borderRadius: 6, padding: "8px 10px", color: T.text, fontSize: 12 }} />
                                <input value={draft.notes} onChange={e => setDraft(p => ({ ...p, notes: e.target.value }))} placeholder="Notes (optional)" style={{ background: T.inset, border: `1px solid ${T.border2}`, borderRadius: 6, padding: "8px 10px", color: T.text, fontSize: 12 }} />
                                <div style={{ display: "flex", gap: 6 }}>
                                  <button onClick={() => submitLog(key)} style={{ background: st.color, border: "none", color: "#07070e", borderRadius: 6, padding: "6px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Save</button>
                                  <button onClick={() => setOpenLog(null)} style={{ background: "none", border: `1px solid ${T.border2}`, color: T.dim, borderRadius: 6, padding: "6px 12px", fontSize: 11, cursor: "pointer" }}>Cancel</button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* OVERVIEW */}
        {view === "overview" && (
          <div>
            {cfg.phases ? cfg.phases.map(p => (
              <div key={p.id} style={{ background: T.card, border: `1px solid ${p.color}30`, borderRadius: 12, padding: "14px 16px", marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: p.color }}>Phase {p.id}: {p.name}</div>
                  <div style={{ fontSize: 10, color: T.faint }}>W{p.weeks} · {p.dates}</div>
                </div>
                <div style={{ fontSize: 12, color: T.body, lineHeight: 1.6, marginTop: 6 }}>{p.goal}</div>
              </div>
            )) : null}
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 16px", marginTop: 14 }}>
              <div style={{ fontSize: 11, color: a.color, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>The rules of this plan</div>
              {[
                ["Hyrox is 60% running", "Every plan is run-first: 3 run stimuli a week each, plus running inside every brick. Stations matter, but the race is won on the laps."],
                ["Both train everything", "Race day splits aren't 100/0. Every station shows up in both plans — leads just take the bigger share."],
                ["Lead your strengths, cover each other", "Each athlete leads their strengths and covers the other. Every share buys the partner recovery — it works both directions."],
                ["Transitions are free speed", "Every shared station session includes partner switch-off practice. Sloppy changeovers cost minutes; clean ones cost nothing."],
                ["The long run is sacred", "The weekend long run is the key shared session. Paired runs and station practice live there — make it work anywhere."],
                ["Hold the team pace", "Run every paired session at the agreed race pace. Faster solo work stays separate."],
                ["Deloads are weeks 4 and 8", "Lighter on purpose. Don't add extra."],
                ["Log it or it didn't happen", "30 seconds after each session. The progress tab does the rest."],
              ].map(([t, b], i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: T.strong }}>{t}</div>
                  <div style={{ fontSize: 11.5, color: T.body, lineHeight: 1.55, marginTop: 2 }}>{b}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STRATEGY */}
        {view === "strategy" && fmt.team && (
          <div>
            <div style={{ fontSize: 11, color: T.faint, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Station split strategy · lock it before race day</div>
            {splitStrategy.map((s, i) => {
              const c = s.lead.startsWith("Athlete 1") ? athleteAt(0).color : s.lead.startsWith("Athlete 2") ? athleteAt(1).color : "#a78bfa";
              const stationText = annotateStationWeights(s.station, units);
              return (
                <div key={i} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 14px", marginBottom: 6, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <div><div style={{ fontSize: 13, fontWeight: 700, color: T.strong }}>{stationText}</div><div style={{ fontSize: 11, color: T.body, marginTop: 2 }}>{s.note}</div></div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: c, flexShrink: 0, border: `1px solid ${c}50`, borderRadius: 20, padding: "3px 10px" }}>{s.lead}</div>
                </div>
              );
            })}
            <div style={{ background: T.amberBg, border: `1px solid ${T.amberBorder}`, borderRadius: 12, padding: "14px 16px", marginTop: 14 }}>
              <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Doubles / relay rules — memorize these</div>
              {[
                "Run every 1km lap together, side by side",
                "Split station reps any way you like — but only one athlete works at a time",
                "Sleds are solo efforts: alternate, never push/pull together",
                "Machines (SkiErg, Row): one must fully let go before the other takes over",
                "Farmers carry + sandbag lunges: pass equipment sideways or backwards only",
              ].map((r, i) => (
                <div key={i} style={{ fontSize: 12, color: T.amberText, lineHeight: 1.7 }}>• {r}</div>
              ))}
              <div style={{ fontSize: 11, color: T.body, marginTop: 10 }}>{annotateStationWeights("Weights: Sled push 152kg · pull 103kg · farmers 2×24kg · sandbag 20kg · wall ball 6kg", units)}</div>
            </div>
          </div>
        )}

        {/* PROGRESS */}
        {view === "progress" && (
          <div>
            {!loaded ? <div style={{ color: T.dim, fontSize: 12 }}>Loading logs…</div> : (
              <div>
                <div style={{ background: T.card, border: `1px solid ${a.color}30`, borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
                  <div style={{ fontSize: 26, fontWeight: 900, color: a.color }}>{totalDone}<span style={{ fontSize: 14, color: T.dim }}> / {totalSessions} sessions</span></div>
                  <div style={{ fontSize: 10, color: T.faint, textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 2 }}>{a.name} · completed across {cfg.weeks} weeks</div>
                </div>

                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: T.faint, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Average run pace by week ({paceUnitSuffix})</div>
                  <div style={{ fontSize: 11, color: T.dim, marginBottom: 12 }}>Lower is faster. Logged from your run sessions.</div>
                  {loggedPaces.length < 1 ? (
                    <div style={{ fontSize: 12, color: T.dim }}>Log a run pace (like 6:18) and your trend line appears here.</div>
                  ) : (() => {
                    const Wd = 320, Hd = 130, padL = 38, padB = 22, padT = 8, padR = 8;
                    const plotW = Wd - padL - padR, plotH = Hd - padT - padB;
                    const xFor = (wk) => padL + (plotW * (wk - 1)) / Math.max(1, cfg.weeks - 1);
                    const yFor = (avg) => padT + (plotH * (avg - (paceMin - 0.1))) / (paceRange + 0.2);
                    const pts = loggedPaces.map(p => ({ x: xFor(p.week), y: yFor(p.avg), ...p }));
                    const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
                    const first = loggedPaces[0].avg, last = loggedPaces[loggedPaces.length - 1].avg; const delta = first - last;
                    return (
                      <div>
                        <svg viewBox={`0 0 ${Wd} ${Hd}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
                          {[paceMin, (paceMin + paceMax) / 2, paceMax].map((v, i) => (
                            <g key={i}><line x1={padL} y1={yFor(v)} x2={Wd - padR} y2={yFor(v)} stroke={T.border} strokeWidth="1" /><text x={padL - 6} y={yFor(v) + 3} textAnchor="end" fontSize="9" fill={T.faint}>{axisPaceLabel(v)}</text></g>
                          ))}
                          <path d={path} fill="none" stroke={a.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                          {pts.map((p, i) => (<g key={i}><circle cx={p.x} cy={p.y} r="3.5" fill={a.color} /><text x={p.x} y={Hd - padB + 14} textAnchor="middle" fontSize="9" fill={T.faint}>{p.week}</text></g>))}
                        </svg>
                        <div style={{ fontSize: 11, color: T.body, marginTop: 6, textAlign: "center" }}>
                          {delta > 0.01 ? <span style={{ color: a.color, fontWeight: 700 }}>↓ {axisPaceLabel(Math.abs(delta))}{paceUnitSuffix} faster</span> : delta < -0.01 ? <span style={{ color: "#f59e0b", fontWeight: 700 }}>↑ {axisPaceLabel(Math.abs(delta))}{paceUnitSuffix} slower</span> : <span>Holding steady</span>} since first logged week
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: T.faint, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Sessions completed by week</div>
                  <div style={{ display: "flex", gap: 5, alignItems: "flex-end", height: 80 }}>
                    {weekStats.map(w => (
                      <div key={w.week} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                        <div style={{ width: "100%", height: 64, background: T.inset, borderRadius: 3, display: "flex", alignItems: "flex-end" }}>
                          <div style={{ width: "100%", height: `${w.total ? (w.done / w.total) * 100 : 0}%`, background: w.done === w.total && w.total > 0 ? a.color : `${a.color}70`, borderRadius: 3, minHeight: w.done ? 4 : 0 }} />
                        </div>
                        <div style={{ fontSize: 8, color: T.faint }}>{w.week}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ fontSize: 10, color: T.faint, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Logged numbers (most recent)</div>
                  {recentEntries.length === 0 ? (
                    <div style={{ fontSize: 12, color: T.dim }}>Nothing logged yet. Open a session in This Week and tap "Log" after you train.</div>
                  ) : recentEntries.map(([key, v]) => (
                    <div key={key} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 0", borderBottom: `1px solid ${T.border}` }}>
                      <div style={{ fontSize: 11, color: T.body }}>{key.replace("w", "Week ").replace("-", " · ")}</div>
                      <div style={{ fontSize: 12, color: T.strong, fontWeight: 600, textAlign: "right" }}>{v.metric}{v.notes ? <span style={{ color: T.dim, fontWeight: 400 }}> — {v.notes}</span> : null}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
