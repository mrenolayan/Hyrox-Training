// ════════════════════════════════════════════════════════════════════════════
//  db.js — the ONLY module that talks to Supabase.
// ════════════════════════════════════════════════════════════════════════════
import { supabase } from "./supabaseClient.js";
import { generateInviteToken, inviteUrl } from "./auth.js";

function unwrap(label, { data, error }) {
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

// ── auth session (moved from auth.js — db.js is the ONLY Supabase boundary) ──
export async function sendMagicLink(email, redirectTo) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
  });
  if (error) throw new Error(`sendMagicLink: ${error.message}`);
}

export async function verifyOtpCode(email, token) {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) throw new Error(`verifyOtpCode: ${error.message}`);
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(`signOut: ${error.message}`);
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(`getSession: ${error.message}`);
  return data.session;
}

export function onAuthStateChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => callback(session)
  );
  return () => subscription.unsubscribe();
}

// ── coaches ──────────────────────────────────────────────────────────────────
export async function getCoach() {
  const rows = unwrap("getCoach", await supabase.from("coaches").select("*").limit(1));
  return rows[0] ?? null;
}

export async function linkCoachAuthId(userId, email) {
  await supabase
    .from("coaches")
    .update({ user_id: userId })
    .eq("email", email)
    .is("user_id", null);
}

// ── athlete invites ────────────────────────────────────────────────────────────
export async function createInvite(athleteId, teamId, email) {
  const token = generateInviteToken();
  const rows = unwrap("createInvite", await supabase
    .from("athlete_invites")
    .insert({ athlete_id: athleteId, team_id: teamId, email, token })
    .select());
  await sendMagicLink(
    email,
    inviteUrl(window.location.origin, window.location.pathname, token)
  );
  return rows[0];
}

export async function acceptInvite(token) {
  const { data, error } = await supabase.rpc("accept_invite", { p_token: token });
  if (error) throw new Error(`acceptInvite: ${error.message}`);
  return data; // claimed athlete id
}

// Mirror of linkCoachAuthId: best-effort claim by signed-in email when the
// athlete arrives without the token. The DB function is a no-op if already linked.
export async function linkAthleteAuthId() {
  const { data, error } = await supabase.rpc("link_athlete_from_invite");
  if (error) return null;
  return data;
}

// coach | athlete | null — RLS scopes each select to what the caller may see.
export async function getCurrentUserRole() {
  const session = await getSession();
  if (!session) return { role: null };
  const coach = await getCoach();
  if (coach) return { role: "coach", coach };
  const athletes = unwrap("getCurrentUserRole.athlete", await supabase
    .from("athletes")
    .select("id, name, color")
    .eq("user_id", session.user.id)
    .limit(1));
  if (athletes[0]) return { role: "athlete", athlete: athletes[0] };
  return { role: null };
}

// Everything an athlete's own screen needs; RLS scopes every query to what
// the caller may see (teammate rows just come back per the athlete policies).
export async function getMyAthleteContext(athleteId) {
  const memberships = unwrap("getMyAthleteContext.memberships", await supabase
    .from("team_members")
    .select("team_id")
    .eq("athlete_id", athleteId)
    .is("left_at", null)
    .limit(1));
  const teamId = memberships[0]?.team_id;
  if (!teamId) return null;
  const teamRows = unwrap("getMyAthleteContext.team", await supabase
    .from("teams")
    .select("id, name, format_id, units")
    .eq("id", teamId)
    .limit(1));
  const plan = await getPlanForTeam(teamId);
  const athletes = await getAthletesForTeam(teamId);
  return { team: teamRows[0], plan, athletes };
}

// ── coach dashboard ───────────────────────────────────────────────────────────
export async function getTeamsForCoach(coachId) {
  return unwrap("getTeamsForCoach", await supabase
    .from("teams")
    .select(`
      id, name, format_id, units, require_auth, created_at,
      plans ( id, weeks, days_per_week, race_name, race_city, race_iso, status ),
      team_members ( athlete:athletes (
        id, name, color, role, run_pace, user_id,
        athlete_invites ( id, email, accepted_at, expires_at, created_at )
      ) )
    `)
    .eq("coach_id", coachId)
    .order("created_at", { ascending: true }));
}

// ── athletes for a team ───────────────────────────────────────────────────────
export async function getAthletesForTeam(teamId) {
  const members = unwrap("getAthletesForTeam.members", await supabase
    .from("team_members")
    .select("athlete_id")
    .eq("team_id", teamId)
    .is("left_at", null));
  if (!members.length) return [];
  const ids = members.map((m) => m.athlete_id);
  return unwrap("getAthletesForTeam.athletes", await supabase
    .from("athletes")
    .select(`
      id, name, color, role, run_pace, longest_run,
      station_ratings ( station, rating ),
      athlete_profiles ( known_weights, team_split_notes, injuries_notes )
    `)
    .in("id", ids));
}

// ── one athlete ───────────────────────────────────────────────────────────────
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

// ── full plan tree ────────────────────────────────────────────────────────────
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
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .order("week_number", { referencedTable: "plan_weeks", ascending: true })
    .limit(1));
  return rows[0] ?? null;
}

// ── logs ──────────────────────────────────────────────────────────────────────
export async function getLogsForAthlete(athleteId) {
  return unwrap("getLogsForAthlete", await supabase
    .from("logs")
    .select("id, plan_entry_id, done, metric, notes, logged_date")
    .eq("athlete_id", athleteId));
}

export async function getLogsForTeam(teamId) {
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

// ── write: upsert a log ───────────────────────────────────────────────────────
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

// ── write: coach note ─────────────────────────────────────────────────────────
export async function saveCoachNote(planWeekId, body) {
  const rows = unwrap("saveCoachNote", await supabase
    .from("coach_notes")
    .upsert({ plan_week_id: planWeekId, body, updated_at: new Date().toISOString() },
            { onConflict: "plan_week_id" })
    .select());
  return rows[0];
}

// ── write: team note ──────────────────────────────────────────────────────────
export async function addTeamNote({ logId, authorAthleteId, body, reaction }) {
  const rows = unwrap("addTeamNote", await supabase
    .from("team_notes")
    .insert({ log_id: logId, author_athlete_id: authorAthleteId, body, reaction })
    .select());
  return rows[0];
}

// ── write: upsert plan entries ────────────────────────────────────────────────
export async function upsertPlanEntries(entries) {
  if (!entries?.length) return [];
  return unwrap("upsertPlanEntries", await supabase
    .from("plan_entries")
    .upsert(entries, { onConflict: "plan_day_id,athlete_id" })
    .select());
}

// ── write: create a full team + athletes + plan ───────────────────────────────
export async function createTeamFull({
  coachId, teamName, formatId, teamUnits, planWeeks, planDaysPerWeek,
  startISO, raceName, raceCity, raceISO, requireAuth, athletes,
}) {
  const teamRows = unwrap("createTeam", await supabase
    .from("teams")
    .insert({
      coach_id: coachId, name: teamName, format_id: formatId, units: teamUnits,
      require_auth: requireAuth ?? false,
    })
    .select());
  const team = teamRows[0];

  const planRows = unwrap("createPlan", await supabase
    .from("plans")
    .insert({
      team_id: team.id, weeks: planWeeks, days_per_week: planDaysPerWeek,
      start_iso: startISO, race_name: raceName, race_city: raceCity, race_iso: raceISO,
      status: "draft",
    })
    .select());
  const plan = planRows[0];

  const athleteRows = [];
  for (const a of athletes) {
    const aRows = unwrap("createAthlete", await supabase
      .from("athletes")
      .insert({
        coach_id: coachId, name: a.name, color: a.color ?? "#60a5fa",
        role: a.role ?? null, run_pace: a.run_pace ?? null, longest_run: a.longest_run ?? null,
      })
      .select());
    const athlete = aRows[0];

    if (a.profile) {
      const profileData = Object.fromEntries(Object.entries(a.profile).filter(([, v]) => v != null));
      if (Object.keys(profileData).length) {
        unwrap("createTeamFull.profile", await supabase
          .from("athlete_profiles")
          .insert({ athlete_id: athlete.id, ...profileData }));
      }
    }
    if (a.ratings?.length) {
      unwrap("createTeamFull.station_ratings", await supabase
        .from("station_ratings")
        .insert(a.ratings.map((r) => ({ athlete_id: athlete.id, station: r.station, rating: r.rating }))));
    }
    if (a.modalities?.length) {
      unwrap("createTeamFull.athlete_modalities", await supabase
        .from("athlete_modalities")
        .insert(a.modalities.map((m) => ({ athlete_id: athlete.id, modality: m }))));
    }
    unwrap("createTeamFull.team_members", await supabase
      .from("team_members")
      .insert({ team_id: team.id, athlete_id: athlete.id }));

    athleteRows.push({
      ...athlete,
      station_ratings: a.ratings ?? [],
      athlete_profiles: a.profile ?? null,
    });
  }

  return { team, plan, athletes: athleteRows };
}

// ── write: save full plan tree ────────────────────────────────────────────────
export async function savePlanTree(planId, generatedWeeks) {
  if (!generatedWeeks?.length) return { weeks: 0, days: 0, entries: 0 };

  let totalDays = 0;
  let totalEntries = 0;

  for (const wk of generatedWeeks) {
    const weekRows = unwrap(`savePlanTree.week_${wk.week_number}`, await supabase
      .from("plan_weeks")
      .upsert(
        { plan_id: planId, week_number: wk.week_number, phase: wk.phase, focus: wk.focus },
        { onConflict: "plan_id,week_number" }
      )
      .select("id, week_number"));
    const weekId = weekRows[0]?.id;
    if (!weekId) throw new Error(`savePlanTree: failed to upsert week ${wk.week_number}`);

    for (const d of wk.days ?? []) {
      const dayRows = unwrap(`savePlanTree.day_${wk.week_number}_${d.day_of_week}`, await supabase
        .from("plan_days")
        .upsert(
          { plan_week_id: weekId, day_of_week: d.day_of_week, shared: d.shared, optional: d.optional },
          { onConflict: "plan_week_id,day_of_week" }
        )
        .select("id"));
      const dayId = dayRows[0]?.id;
      if (!dayId) throw new Error(`savePlanTree: failed to upsert day ${d.day_of_week} wk ${wk.week_number}`);
      totalDays++;

      const entryRows = d.entries ?? [];
      if (entryRows.length) {
        const toUpsert = entryRows.map(e => ({
          plan_day_id: dayId,
          athlete_id: e.athlete_id,
          session_type: e.session_type,
          label: e.label,
          detail: e.detail ?? null,
          metric_label: e.metric_label ?? null,
        }));
        const inserted = unwrap(`savePlanTree.entries_${wk.week_number}_${d.day_of_week}`, await supabase
          .from("plan_entries")
          .upsert(toUpsert, { onConflict: "plan_day_id,athlete_id" })
          .select("id"));
        totalEntries += inserted.length;
      }
    }
  }

  return { weeks: generatedWeeks.length, days: totalDays, entries: totalEntries };
}
