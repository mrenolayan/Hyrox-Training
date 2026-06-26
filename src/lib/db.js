// ════════════════════════════════════════════════════════════════════════════
//  db.js — the ONLY module that talks to Supabase.
//
//  UI and hooks call these named functions; they get back plain JS objects and
//  arrays, never raw Supabase query builders or responses. If you need data,
//  add a function here — don't import supabaseClient anywhere else.
//
//  Convention: every function throws on error (with a readable message) and
//  returns the data. Callers/hooks catch and surface errors in the UI.
// ════════════════════════════════════════════════════════════════════════════
import { supabase } from "./supabaseClient.js";

// small helper: unwrap { data, error }, throw on error
function unwrap(label, { data, error }) {
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

// ── coaches ──────────────────────────────────────────────────────────────────
export async function getCoach() {
  // single-coach app for now: return the first coach
  const rows = unwrap("getCoach", await supabase.from("coaches").select("*").limit(1));
  return rows[0] ?? null;
}

// ── coach dashboard: team + athlete summaries (lightweight; no plan tree) ─────
export async function getTeamsForCoach(coachId) {
  return unwrap("getTeamsForCoach", await supabase
    .from("teams")
    .select(`
      id, name, format_id, units, created_at,
      plans ( id, weeks, days_per_week, race_name, race_city, race_iso, status ),
      team_members ( athlete:athletes ( id, name, color, role, run_pace ) )
    `)
    .eq("coach_id", coachId)
    .order("created_at", { ascending: true }));
}

// ── one athlete: profile + ratings + modalities (intake view) ─────────────────
export async function getAthlete(athleteId) {
  const rows = unwrap("getAthlete", await supabase
    .from("athletes")
    .select(`
      id, name, color, role, run_pace, longest_run,
      athlete_profiles ( known_weights, team_split_notes, injuries_notes, meta ),
      station_ratings ( station, rating ),
      athlete_modalities ( modality )
    `)
    .eq("id", athleteId)
    .limit(1));
  return rows[0] ?? null;
}

// ── full plan tree for a team (lazy-loaded when a team is opened) ──────────────
export async function getPlanForTeam(teamId) {
  const rows = unwrap("getPlanForTeam", await supabase
    .from("plans")
    .select(`
      id, weeks, days_per_week, start_iso, race_name, race_city, race_iso, status,
      plan_weeks (
        id, week_number, phase, focus,
        coach_notes ( body ),
        plan_days (
          id, day_of_week, shared, optional,
          plan_entries (
            id, athlete_id, session_type, label, detail, metric_label, meta
          )
        )
      )
    `)
    .eq("team_id", teamId)
    .order("week_number", { referencedTable: "plan_weeks", ascending: true })
    .limit(1));
  return rows[0] ?? null;
}

// ── logs for one athlete (their own) ──────────────────────────────────────────
export async function getLogsForAthlete(athleteId) {
  return unwrap("getLogsForAthlete", await supabase
    .from("logs")
    .select("id, plan_entry_id, done, metric, notes, logged_date")
    .eq("athlete_id", athleteId));
}

// ── logs for a whole team (own + teammates' — the shared team view) ───────────
export async function getLogsForTeam(teamId) {
  // athletes currently on the team
  const members = unwrap("getLogsForTeam.members", await supabase
    .from("team_members")
    .select("athlete_id")
    .eq("team_id", teamId)
    .is("left_at", null));
  const ids = members.map((m) => m.athlete_id);
  if (ids.length === 0) return [];
  return unwrap("getLogsForTeam.logs", await supabase
    .from("logs")
    .select(`
      id, athlete_id, plan_entry_id, done, metric, notes, logged_date,
      team_notes ( id, author_athlete_id, body, reaction )
    `)
    .in("athlete_id", ids));
}

// ── write: upsert a log (one row per athlete+entry; re-logging overwrites) ─────
export async function saveLog({ athleteId, planId, planEntryId, done, metric, notes, loggedDate }) {
  const row = {
    athlete_id: athleteId, plan_id: planId, plan_entry_id: planEntryId,
    done: done ?? true, metric: metric ?? null, notes: notes ?? null,
    logged_date: loggedDate ?? new Date().toISOString().slice(0, 10),
  };
  const rows = unwrap("saveLog", await supabase
    .from("logs")
    .upsert(row, { onConflict: "athlete_id,plan_entry_id" })
    .select());
  return rows[0];
}

// ── write: coach note for a week (one per week; upsert) ───────────────────────
export async function saveCoachNote(planWeekId, body) {
  const rows = unwrap("saveCoachNote", await supabase
    .from("coach_notes")
    .upsert({ plan_week_id: planWeekId, body, updated_at: new Date().toISOString() },
            { onConflict: "plan_week_id" })
    .select());
  return rows[0];
}

// ── write: teammate note/reaction on a log ────────────────────────────────────
export async function addTeamNote({ logId, authorAthleteId, body, reaction }) {
  const rows = unwrap("addTeamNote", await supabase
    .from("team_notes")
    .insert({ log_id: logId, author_athlete_id: authorAthleteId, body, reaction })
    .select());
  return rows[0];
}

// ── write: persist generated/edited plan entries (upsert by day+athlete) ──────
// Used by the generator (Phase 3) and coach inline edits. Manual tweaks survive
// regeneration because we upsert on (plan_day_id, athlete_id) rather than wipe.
export async function upsertPlanEntries(entries) {
  if (!entries?.length) return [];
  return unwrap("upsertPlanEntries", await supabase
    .from("plan_entries")
    .upsert(entries, { onConflict: "plan_day_id,athlete_id" })
    .select());
}
