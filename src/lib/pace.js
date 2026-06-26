// ════════════════════════════════════════════════════════════════════════════
//  pace.js — pure pace/unit utilities. No React, no Supabase.
//
//  Rules (per coach):
//    • Pace always stored as min/km decimal. Display converts to user's units.
//    • Official HYROX station weights shown as "Nkg (Nlb)" — never just lb.
//    • Personal lift weights fully convert kg↔lb.
//    • Run distances stay metric (km/m). Coach authors all distances.
// ════════════════════════════════════════════════════════════════════════════

export const KM_PER_MI = 1.60934;
export const LB_PER_KG = 2.20462;

// "6:18" or "6:18/km" or "5.9" → decimal min/km. Returns null if unparseable.
export function parsePace(str) {
  if (!str) return null;
  const mmss = String(str).match(/(\d{1,2}):(\d{2})/);
  if (mmss) return parseInt(mmss[1], 10) + parseInt(mmss[2], 10) / 60;
  const dec = String(str).match(/(\d+(?:\.\d+)?)/);
  if (dec) { const v = parseFloat(dec[1]); return (v > 0 && v < 15) ? v : null; }
  return null;
}

// decimal min/km → "6:18"
export function paceLabel(dec) {
  if (dec == null) return "—";
  const m = Math.floor(dec);
  const s = Math.round((dec - m) * 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Stored pace (min/km decimal) → display string in user's units
export function paceDisplay(decKm, units = "metric") {
  if (decKm == null) return "—";
  const val = units === "us" ? decKm * KM_PER_MI : decKm;
  return `${paceLabel(val)}/${units === "us" ? "mi" : "km"}`;
}

// Convert a logged pace string for display in user's units
export function convertPaceStr(str, units = "metric") {
  const dec = parsePace(str);
  if (dec == null) return str || "—";
  return paceDisplay(dec, units);
}

// Official HYROX station weights (worldwide equipment spec). Annotate with lb
// equivalent when units=us but never drop the kg source value.
const STATION_WEIGHTS_KG = [152, 103, 24, 20, 6];
export function annotateStationWeights(text, units) {
  if (!text || units !== "us") return text;
  let out = text;
  for (const kg of STATION_WEIGHTS_KG) {
    const re = new RegExp(`(\\d+×)?${kg}kg`, "g");
    out = out.replace(re, (m) => `${m} (${Math.round(kg * LB_PER_KG)}lb)`);
  }
  return out;
}

// Convert a personal weight in kg to display string (fully converts)
export function weightDisplay(kg, units = "metric") {
  if (kg == null) return "—";
  if (units === "us") return `${Math.round(kg * LB_PER_KG)}lb`;
  return `${kg}kg`;
}
