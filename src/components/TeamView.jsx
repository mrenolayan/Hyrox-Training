import { useEffect, useState } from "react";
import * as db from "../lib/db.js";
import { generatePlan } from "../lib/plan.js";

// ── constants ─────────────────────────────────────────────────────────────────
const SESSION_TYPES = {
  run_easy:     { color: "#60a5fa", bg: "#0e1f3a", icon: "🏃",  label: "Easy Run" },
  run_pace:     { color: "#34d399", bg: "#0e2a1e", icon: "⏱",   label: "Pace Run" },
  run_long:     { color: "#3b82f6", bg: "#0a1a30", icon: "🛣",   label: "Long Run" },
  strength:     { color: "#8b5cf6", bg: "#1a0a2a", icon: "🏋️",  label: "Strength" },
  sled:         { color: "#f59e0b", bg: "#2a1800", icon: "🛷",   label: "Sled Work" },
  brick:        { color: "#ef4444", bg: "#2a0a0a", icon: "🔥",   label: "Brick" },
  stations:     { color: "#f0c020", bg: "#2a2200", icon: "⚙️",   label: "Stations" },
  together:     { color: "#ec4899", bg: "#2a0a1e", icon: "👫",   label: "Together" },
  race_sim:     { color: "#f0f020", bg: "#1a1a00", icon: "🏁",   label: "Race Sim" },
  conditioning: { color: "#22d3ee", bg: "#0a2226", icon: "💪",   label: "Conditioning" },
  rest:         { color: "#374151", bg: "#0c0c10", icon: "😴",   label: "Rest" },
};
const PHASE_COLORS = { 1: "#3b82f6", 2: "#f0c020", 3: "#f87171" };
const PHASE_NAMES  = { 1: "Base",    2: "Build",   3: "Peak + Taper" };
const DAY_ORDER    = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const KM_PER_MI    = 1.60934;
const STATION_KG   = [152, 103, 24, 20, 6];

// ── helpers ────────────────────────────────────────────────────────────────────
const sortDays = (days) =>
  [...days].sort((a, b) => DAY_ORDER.indexOf(a.day_of_week) - DAY_ORDER.indexOf(b.day_of_week));

const weekRange = (startISO, weekNum) => {
  const d = new Date(startISO + "T12:00:00");
  d.setDate(d.getDate() + (weekNum - 1) * 7);
  const end = new Date(d); end.setDate(end.getDate() + 6);
  const f = (x) => x.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${f(d)} – ${f(end)}`;
};

const countdownParts = (raceISO) => {
  let ms = new Date(raceISO) - new Date();
  if (ms < 0) ms = 0;
  return {
    days:    Math.floor(ms / 86_400_000),
    hours:   Math.floor((ms % 86_400_000) / 3_600_000),
    minutes: Math.floor((ms % 3_600_000)  / 60_000),
    seconds: Math.floor((ms % 60_000)     / 1_000),
  };
};

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const parsePace = (str) => {
  if (!str) return null;
  const m = String(str).match(/(\d{1,2}):(\d{2})/);
  if (m) return parseInt(m[1], 10) + parseInt(m[2], 10) / 60;
  return null;
};
const paceLabel = (dec) => {
  if (dec == null) return "—";
  const m = Math.floor(dec); const s = Math.round((dec - m) * 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};

const annotateWeights = (text, units) => {
  if (!text || units !== "us") return text;
  let out = text;
  for (const kg of STATION_KG) {
    out = out.replace(new RegExp(`(\\d+×)?${kg}kg`, "g"), (m) => `${m} (${Math.round(kg * 2.20462)}lb)`);
  }
  return out;
};

const inferSessionType = (label) => {
  const l = (label || "").toLowerCase();
  if (l.includes("strength") || l.includes("deadlift") || l.includes("squat")) return "strength";
  if (l.includes("station") || l.includes("circuit"))                           return "stations";
  if (l.includes("sled"))                                                        return "sled";
  if (l.includes("brick"))                                                       return "brick";
  if (l.includes("hiit") || l.includes("amrap") || l.includes("conditioning"))  return "conditioning";
  if (l.includes("race sim") || l.includes("race day"))                          return "race_sim";
  if (l.includes("run") || l.includes("easy") || l.includes("long"))            return "run_easy";
  if (l.includes("rest") || l.includes("mobility"))                              return "rest";
  return null;
};

// Compute current plan week from start date
const currentPlanWeek = (startISO, totalWeeks) => {
  if (!startISO) return 1;
  const diff = Math.floor((new Date() - new Date(startISO + "T00:00:00")) / (7 * 86_400_000)) + 1;
  return Math.max(1, Math.min(diff, totalWeeks));
};

// ── TeamView ───────────────────────────────────────────────────────────────────
export default function TeamView({ team, plan, coach, T, themeMode, resolvedTheme, units, onChangeTheme, onChangeUnits, onBack, onPlanUpdated }) {
  const members = team.team_members.map((m) => m.athlete);
  const isTeamFormat = ["doubles_men","doubles_women","mixed_doubles","relay_men","relay_women","relay_mixed"].includes(team.format_id);

  const [planState, setPlanState]       = useState(plan);
  const [athleteIdx, setAthleteIdx]     = useState(0);
  const [view, setView]                 = useState("week");
  const [selectedWeek, setSelectedWeek] = useState(() => {
    const total = plan?.plan_weeks?.length ?? 1;
    return currentPlanWeek(plan?.start_iso, total);
  });
  const [logs, setLogs]               = useState({});    // plan_entry_id → log row
  const [logsLoading, setLogsLoading] = useState(false);
  const [openLog, setOpenLog]         = useState(null);  // entry_id whose form is open
  const [logDraft, setLogDraft]       = useState({ metric: "", notes: "" });
  const [editingEntry, setEditingEntry] = useState(null);
  const [editDraft, setEditDraft]       = useState({ label: "", detail: "", metric_label: "" });
  const [editingNote, setEditingNote]   = useState(false);
  const [noteDraft, setNoteDraft]       = useState("");
  const [showCountdown, setShowCountdown] = useState(false);
  const [, setTick]                     = useState(0);
  const [generating, setGenerating]     = useState(false);
  const [athleteDetails, setAthleteDetails] = useState([]); // full athlete rows w/ ratings
  const [error, setError]               = useState(null);

  const selectedAthlete = members[athleteIdx] ?? members[0];
  const sortedWeeks     = [...(planState?.plan_weeks ?? [])].sort((a, b) => a.week_number - b.week_number);
  const weekData        = sortedWeeks.find((w) => w.week_number === selectedWeek);
  const hasWeeks        = sortedWeeks.length > 0;

  // countdown ticker
  useEffect(() => {
    if (!showCountdown) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [showCountdown]);

  // load logs when selected athlete changes
  useEffect(() => {
    if (!selectedAthlete) return;
    setLogsLoading(true);
    db.getLogsForAthlete(selectedAthlete.id)
      .then((rows) => setLogs(Object.fromEntries(rows.map((r) => [r.plan_entry_id, r]))))
      .catch(() => {})
      .finally(() => setLogsLoading(false));
  }, [selectedAthlete?.id]);

  // load full athlete details (with station_ratings) for Strategy tab
  useEffect(() => {
    db.getAthletesForTeam(team.id).then(setAthleteDetails).catch(() => {});
  }, [team.id]);

  // ── generate plan ────────────────────────────────────────────────────────────
  async function handleGenerate() {
    setGenerating(true); setError(null);
    try {
      const athletes = await db.getAthletesForTeam(team.id);
      const generated = generatePlan(team, planState, athletes);
      await db.savePlanTree(planState.id, generated.weeks);
      const fresh = await db.getPlanForTeam(team.id);
      setPlanState(fresh);
      setSelectedWeek(currentPlanWeek(fresh.start_iso, fresh.plan_weeks?.length ?? 1));
    } catch (e) { setError(e.message); }
    finally { setGenerating(false); }
  }

  // ── log a session ────────────────────────────────────────────────────────────
  async function handleSaveLog(entry, day) {
    try {
      const saved = await db.saveLog({
        athleteId: selectedAthlete.id,
        planId: planState.id,
        planEntryId: entry.id,
        done: true,
        metric: logDraft.metric || null,
        notes: logDraft.notes || null,
      });
      setLogs((prev) => ({ ...prev, [entry.id]: saved }));
      setOpenLog(null);
      setLogDraft({ metric: "", notes: "" });
    } catch (e) { setError(e.message); }
  }

  async function handleToggleDone(entry) {
    const existing = logs[entry.id];
    try {
      const saved = await db.saveLog({
        athleteId: selectedAthlete.id,
        planId: planState.id,
        planEntryId: entry.id,
        done: !existing?.done,
        metric: existing?.metric ?? null,
        notes: existing?.notes ?? null,
      });
      setLogs((prev) => ({ ...prev, [entry.id]: saved }));
    } catch (e) { setError(e.message); }
  }

  // ── edit a plan entry ────────────────────────────────────────────────────────
  async function handleSaveEdit(entry, day) {
    try {
      await db.upsertPlanEntries([{
        plan_day_id: day.id,
        athlete_id: entry.athlete_id,
        session_type: inferSessionType(editDraft.label) ?? entry.session_type,
        label: editDraft.label,
        detail: editDraft.detail,
        metric_label: editDraft.metric_label,
      }]);
      // update local plan state
      setPlanState((prev) => ({
        ...prev,
        plan_weeks: prev.plan_weeks.map((w) => ({
          ...w,
          plan_days: w.plan_days.map((d) => ({
            ...d,
            plan_entries: d.plan_entries.map((e) =>
              e.id === entry.id
                ? { ...e, label: editDraft.label, detail: editDraft.detail, metric_label: editDraft.metric_label,
                    session_type: inferSessionType(editDraft.label) ?? e.session_type }
                : e
            ),
          })),
        })),
      }));
      setEditingEntry(null);
    } catch (e) { setError(e.message); }
  }

  // ── coach note ───────────────────────────────────────────────────────────────
  async function handleSaveNote(weekId) {
    try {
      await db.saveCoachNote(weekId, noteDraft);
      setPlanState((prev) => ({
        ...prev,
        plan_weeks: prev.plan_weeks.map((w) =>
          w.id === weekId ? { ...w, coach_notes: { body: noteDraft } } : w
        ),
      }));
      setEditingNote(false);
    } catch (e) { setError(e.message); }
  }

  // ── derived progress stats ────────────────────────────────────────────────────
  const runTypes = new Set(["run_easy", "run_pace", "run_long", "together"]);
  const weekStats = sortedWeeks.map((w) => {
    const sessions = (w.plan_days ?? []).flatMap((d) =>
      (d.plan_entries ?? []).filter((e) => e.athlete_id === selectedAthlete?.id && e.session_type !== "rest" && !d.optional)
    );
    const done = sessions.filter((e) => logs[e.id]?.done).length;
    return { week: w.week_number, total: sessions.length, done, phase: w.phase };
  });
  const totalDone     = weekStats.reduce((s, w) => s + w.done, 0);
  const totalSessions = weekStats.reduce((s, w) => s + w.total, 0);

  const paceByWeek = sortedWeeks.map((w) => {
    const paces = (w.plan_days ?? []).flatMap((d) =>
      (d.plan_entries ?? []).filter((e) => e.athlete_id === selectedAthlete?.id && runTypes.has(e.session_type))
        .map((e) => parsePace(logs[e.id]?.metric)).filter((v) => v != null)
    );
    return { week: w.week_number, avg: paces.length ? paces.reduce((s, v) => s + v, 0) / paces.length : null };
  }).filter((p) => p.avg != null);

  // ── render ────────────────────────────────────────────────────────────────────
  const tabBtn = (id, label) => (
    <button key={id} onClick={() => setView(id)} style={{
      background: "none", border: "none", cursor: "pointer", padding: "8px 12px", fontSize: 12,
      fontWeight: view === id ? 700 : 400,
      color: view === id ? (selectedAthlete?.color ?? "#60a5fa") : T.faint,
      borderBottom: view === id ? `2px solid ${selectedAthlete?.color ?? "#60a5fa"}` : "2px solid transparent",
      letterSpacing: "0.04em",
    }}>{label}</button>
  );

  return (
    <div style={{ background: T.bg, minHeight: "100vh", color: T.text, fontFamily: "'Avenir Next', system-ui, sans-serif" }}>
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div style={{ background: T.headerBg, borderBottom: `1px solid ${T.border}`, padding: "14px 16px 0" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>

          {/* back + theme + units */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <button onClick={onBack} style={{ background: "none", border: "none", color: T.dim, cursor: "pointer", fontSize: 13, padding: 0 }}>
              ← All teams
            </button>
            <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 9, color: T.faint, textTransform: "uppercase", letterSpacing: "0.1em" }}>Theme:</span>
              {["auto","light","dark"].map((m) => (
                <button key={m} onClick={() => onChangeTheme(m)} style={{
                  background: "none", border: `1px solid ${themeMode === m ? "#60a5fa" : T.border2}`,
                  color: themeMode === m ? "#60a5fa" : T.faint,
                  borderRadius: 10, padding: "2px 7px", fontSize: 9, fontWeight: 600, cursor: "pointer", textTransform: "capitalize",
                }}>{m}</button>
              ))}
              <span style={{ fontSize: 9, color: T.faint, textTransform: "uppercase", letterSpacing: "0.1em", marginLeft: 6 }}>Units:</span>
              {[["metric","Metric"],["us","US"]].map(([id,lbl]) => (
                <button key={id} onClick={() => onChangeUnits(id)} style={{
                  background: "none", border: `1px solid ${units === id ? "#60a5fa" : T.border2}`,
                  color: units === id ? "#60a5fa" : T.faint,
                  borderRadius: 10, padding: "2px 7px", fontSize: 9, fontWeight: 600, cursor: "pointer",
                }}>{lbl}</button>
              ))}
            </div>
          </div>

          {/* team name + subtitle */}
          <div style={{ fontSize: 9, letterSpacing: "0.18em", color: T.faint, textTransform: "uppercase", marginBottom: 4 }}>
            {team.format_id.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase())} · {planState?.race_city ?? ""} · {fmtDate(planState?.race_iso)}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: selectedAthlete?.color ?? "#60a5fa", letterSpacing: "-0.5px" }}>
              {team.name.toUpperCase()}
            </div>
            <button onClick={() => setShowCountdown((v) => !v)} style={{
              background: "none", border: "none", padding: 0, cursor: "pointer",
              color: T.body, fontSize: 12, textDecoration: "underline", textDecorationStyle: "dotted",
            }}>
              {showCountdown ? "hide countdown" : `${planState?.weeks ?? "?"} weeks to race`}
            </button>
          </div>

          {/* countdown */}
          {showCountdown && planState?.race_iso && (() => {
            const c = countdownParts(planState.race_iso);
            const cell = (val, lbl) => (
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ background: resolvedTheme === "dark" ? "#1a1a22" : "#e8e8f0", borderRadius: 8, padding: "10px 0" }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: T.text, fontVariantNumeric: "tabular-nums", letterSpacing: "1px" }}>
                    {String(val).padStart(2, "0")}
                  </div>
                </div>
                <div style={{ fontSize: 9, color: "#f0c020", textTransform: "uppercase", letterSpacing: "0.12em", marginTop: 4, fontWeight: 700 }}>{lbl}</div>
              </div>
            );
            return (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 9, color: T.faint, textTransform: "uppercase", letterSpacing: "0.18em", textAlign: "center", marginBottom: 6 }}>
                  Race day · {fmtDate(planState.race_iso)} · {planState.race_city}
                </div>
                <div style={{ display: "flex", gap: 8, maxWidth: 380, margin: "0 auto" }}>
                  {cell(c.days,"Days")}{cell(c.hours,"Hours")}{cell(c.minutes,"Min")}{cell(c.seconds,"Sec")}
                </div>
              </div>
            );
          })()}

          {/* athlete selector (teams only) */}
          {members.length > 1 && (
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              {members.map((a, i) => (
                <button key={a.id} onClick={() => setAthleteIdx(i)} style={{
                  flex: 1, cursor: "pointer", borderRadius: 10, padding: "10px 12px", textAlign: "left",
                  background: athleteIdx === i ? `${a.color}22` : T.card,
                  border: `1.5px solid ${athleteIdx === i ? a.color : T.border}`,
                  color: T.text,
                }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: athleteIdx === i ? a.color : T.dim }}>{a.name}</div>
                  {a.role && <div style={{ fontSize: 10, color: athleteIdx === i ? T.body : T.faint, marginTop: 2 }}>{a.role}</div>}
                </button>
              ))}
            </div>
          )}

          {/* pace pin */}
          {selectedAthlete?.run_pace && (
            <div style={{ fontSize: 11, color: T.body, marginBottom: 10 }}>
              📌 Race pace: {selectedAthlete.run_pace}
            </div>
          )}

          {/* tab bar */}
          <div style={{ display: "flex", gap: 2, flexWrap: "wrap", marginTop: 2 }}>
            {tabBtn("week", "This Week")}
            {tabBtn("plan", "Plan")}
            {isTeamFormat && tabBtn("strategy", "Race Strategy")}
            {tabBtn("progress", "Progress")}
          </div>
        </div>
      </div>

      {/* ── BODY ───────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "18px 14px 60px" }}>
        {error && (
          <div style={{ background: "#2a0a0a", border: "1px solid #f87171", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#f87171", marginBottom: 12 }}>
            {error}
            <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", float: "right", fontSize: 14 }}>×</button>
          </div>
        )}

        {/* ── THIS WEEK ──────────────────────────────────────────────────── */}
        {view === "week" && (
          <WeekTab
            sortedWeeks={sortedWeeks}
            selectedWeek={selectedWeek}
            setSelectedWeek={setSelectedWeek}
            weekData={weekData}
            planState={planState}
            selectedAthlete={selectedAthlete}
            logs={logs}
            logsLoading={logsLoading}
            openLog={openLog}
            setOpenLog={setOpenLog}
            logDraft={logDraft}
            setLogDraft={setLogDraft}
            editingEntry={editingEntry}
            setEditingEntry={setEditingEntry}
            editDraft={editDraft}
            setEditDraft={setEditDraft}
            editingNote={editingNote}
            setEditingNote={setEditingNote}
            noteDraft={noteDraft}
            setNoteDraft={setNoteDraft}
            units={units}
            resolvedTheme={resolvedTheme}
            T={T}
            isTeamFormat={isTeamFormat}
            onToggleDone={handleToggleDone}
            onSaveLog={handleSaveLog}
            onSaveEdit={handleSaveEdit}
            onSaveNote={handleSaveNote}
            hasWeeks={hasWeeks}
            generating={generating}
            onGenerate={handleGenerate}
          />
        )}

        {/* ── PLAN ───────────────────────────────────────────────────────── */}
        {view === "plan" && (
          <PlanTab
            sortedWeeks={sortedWeeks}
            planState={planState}
            selectedAthlete={selectedAthlete}
            T={T}
            resolvedTheme={resolvedTheme}
            units={units}
            generating={generating}
            hasWeeks={hasWeeks}
            onGenerate={handleGenerate}
            setSelectedWeek={setSelectedWeek}
            setView={setView}
          />
        )}

        {/* ── RACE STRATEGY ──────────────────────────────────────────────── */}
        {view === "strategy" && isTeamFormat && (
          <StrategyTab
            team={team}
            members={members}
            athleteDetails={athleteDetails}
            T={T}
            units={units}
          />
        )}

        {/* ── PROGRESS ───────────────────────────────────────────────────── */}
        {view === "progress" && (
          <ProgressTab
            selectedAthlete={selectedAthlete}
            weekStats={weekStats}
            totalDone={totalDone}
            totalSessions={totalSessions}
            paceByWeek={paceByWeek}
            logs={logs}
            sortedWeeks={sortedWeeks}
            units={units}
            T={T}
          />
        )}
      </div>
    </div>
  );
}

// ── THIS WEEK tab ─────────────────────────────────────────────────────────────
function WeekTab({ sortedWeeks, selectedWeek, setSelectedWeek, weekData, planState, selectedAthlete,
  logs, logsLoading, openLog, setOpenLog, logDraft, setLogDraft,
  editingEntry, setEditingEntry, editDraft, setEditDraft,
  editingNote, setEditingNote, noteDraft, setNoteDraft,
  units, resolvedTheme, T, isTeamFormat, onToggleDone, onSaveLog, onSaveEdit, onSaveNote,
  hasWeeks, generating, onGenerate,
}) {
  const PHASE_COLORS = { 1: "#3b82f6", 2: "#f0c020", 3: "#f87171" };
  const PHASE_NAMES  = { 1: "Base",    2: "Build",   3: "Peak + Taper" };

  if (!hasWeeks) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0" }}>
        <p style={{ color: T.dim, marginBottom: 16 }}>No plan generated yet.</p>
        <button onClick={onGenerate} disabled={generating} style={{
          background: "none", border: "1px solid #60a5fa", color: "#60a5fa",
          borderRadius: 8, padding: "10px 24px", fontSize: 14, cursor: "pointer",
          opacity: generating ? 0.5 : 1,
        }}>{generating ? "Generating…" : `Generate ${planState?.weeks ?? "?"}-week plan`}</button>
      </div>
    );
  }

  return (
    <div>
      {/* week chips */}
      <div style={{ display: "flex", gap: 4, marginBottom: 14, flexWrap: "wrap" }}>
        {sortedWeeks.map((w) => (
          <button key={w.id} onClick={() => setSelectedWeek(w.week_number)} style={{
            background: selectedWeek === w.week_number ? PHASE_COLORS[w.phase] : "none",
            border: `1px solid ${selectedWeek === w.week_number ? PHASE_COLORS[w.phase] : T.border}`,
            color: selectedWeek === w.week_number ? "#07070e" : T.dim,
            borderRadius: 6, padding: "5px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer",
          }}>W{w.week_number}</button>
        ))}
      </div>

      {weekData && (
        <div>
          {/* week header */}
          <div style={{
            background: T.card, border: `1px solid ${PHASE_COLORS[weekData.phase]}40`,
            borderRadius: 10, padding: "10px 14px", marginBottom: 12,
          }}>
            <div style={{ fontSize: 10, color: PHASE_COLORS[weekData.phase], textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Week {weekData.week_number} · {PHASE_NAMES[weekData.phase]} · {planState?.start_iso ? weekRange(planState.start_iso, weekData.week_number) : ""}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.strong, marginTop: 3 }}>{weekData.focus}</div>

            {/* coach note */}
            <div style={{ marginTop: 8, borderTop: `1px solid ${T.border}`, paddingTop: 8 }}>
              {!editingNote ? (
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                  <div style={{ fontSize: 11.5, color: weekData.coach_notes?.body ? "#f0c020" : T.faint, lineHeight: 1.5 }}>
                    📣 {weekData.coach_notes?.body || "No coach note this week."}
                  </div>
                  <button onClick={() => { setEditingNote(true); setNoteDraft(weekData.coach_notes?.body || ""); }} style={{
                    background: "none", border: `1px solid ${T.border2}`, color: T.dim,
                    borderRadius: 6, padding: "3px 8px", fontSize: 10, cursor: "pointer", flexShrink: 0,
                  }}>Edit</button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} rows={3}
                    placeholder="Coach note for this week (visible to athletes)…"
                    style={{ background: T.inset, border: `1px solid ${T.border2}`, borderRadius: 6, padding: "8px 10px", color: T.text, fontSize: 12, fontFamily: "inherit", resize: "vertical" }} />
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => onSaveNote(weekData.id)} style={{ background: "#f0c020", border: "none", color: "#07070e", borderRadius: 6, padding: "6px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Save note</button>
                    <button onClick={() => setEditingNote(false)} style={{ background: "none", border: `1px solid ${T.border2}`, color: T.dim, borderRadius: 6, padding: "6px 12px", fontSize: 11, cursor: "pointer" }}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* day cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {sortDays(weekData.plan_days ?? []).map((day) => {
              const entry = (day.plan_entries ?? []).find((e) => e.athlete_id === selectedAthlete?.id);
              if (!entry) return null;
              const log = logs[entry.id];
              const st  = SESSION_TYPES[entry.session_type] ?? SESSION_TYPES.rest;
              const isRest = entry.session_type === "rest";
              const isOpen  = openLog === entry.id;
              const isEditing = editingEntry === entry.id;
              const detailText = annotateWeights(entry.detail, units);
              const metricLbl  = units === "us" && entry.metric_label?.includes("/km")
                ? entry.metric_label.replace(/\/km/gi, "/mi") : entry.metric_label;

              return (
                <div key={day.id} style={{
                  background: resolvedTheme === "light" ? `${st.color}14` : st.bg,
                  border: `1px solid ${log?.done ? st.color : T.border}`,
                  borderRadius: 10, padding: "10px 12px",
                }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    {/* left: day + icon */}
                    <div style={{ width: 34, flexShrink: 0 }}>
                      <div style={{ fontSize: 10, color: T.faint, fontWeight: 700 }}>{day.day_of_week}</div>
                      <div style={{ fontSize: 18, marginTop: 2 }}>{st.icon}</div>
                    </div>

                    {/* middle: label + detail */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {isEditing ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <input value={editDraft.label} onChange={(e) => setEditDraft((p) => ({ ...p, label: e.target.value }))}
                            placeholder="Session label"
                            style={{ background: T.inset, border: `1px solid ${T.border2}`, borderRadius: 6, padding: "6px 10px", color: T.text, fontSize: 12, fontFamily: "inherit" }} />
                          <textarea value={editDraft.detail} onChange={(e) => setEditDraft((p) => ({ ...p, detail: e.target.value }))}
                            placeholder="Detail / instructions" rows={3}
                            style={{ background: T.inset, border: `1px solid ${T.border2}`, borderRadius: 6, padding: "6px 10px", color: T.text, fontSize: 12, fontFamily: "inherit", resize: "vertical" }} />
                          <input value={editDraft.metric_label} onChange={(e) => setEditDraft((p) => ({ ...p, metric_label: e.target.value }))}
                            placeholder="Metric label (e.g. Avg pace /km)"
                            style={{ background: T.inset, border: `1px solid ${T.border2}`, borderRadius: 6, padding: "6px 10px", color: T.text, fontSize: 12, fontFamily: "inherit" }} />
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => onSaveEdit(entry, day)} style={{ background: st.color, border: "none", color: "#07070e", borderRadius: 6, padding: "6px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Save</button>
                            <button onClick={() => setEditingEntry(null)} style={{ background: "none", border: `1px solid ${T.border2}`, color: T.dim, borderRadius: 6, padding: "6px 12px", fontSize: 11, cursor: "pointer" }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div style={{ fontSize: 13, fontWeight: 700, color: st.color }}>
                            {entry.label}
                            {day.optional && <span style={{ fontSize: 9, color: "#a78bfa", marginLeft: 6, fontWeight: 600 }}>OPTIONAL</span>}
                            {day.shared && isTeamFormat && !day.optional && <span style={{ fontSize: 9, color: "#ec4899", marginLeft: 6, fontWeight: 600 }}>TOGETHER</span>}
                          </div>
                          {detailText && <div style={{ fontSize: 11.5, color: T.body, marginTop: 3, lineHeight: 1.5 }}>{detailText}</div>}
                          {log?.metric && (
                            <div style={{ fontSize: 11, color: st.color, marginTop: 5, fontWeight: 600 }}>
                              📊 {log.metric}{log.notes ? ` — ${log.notes}` : ""}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* right: done circle */}
                    {!isRest && !isEditing && (
                      <button onClick={() => handleToggleDoneBtn(entry, log, onToggleDone)} style={{
                        width: 26, height: 26, borderRadius: 13, flexShrink: 0, cursor: "pointer",
                        background: log?.done ? st.color : "transparent",
                        border: `2px solid ${log?.done ? st.color : T.border2}`,
                        color: "#07070e", fontSize: 13, fontWeight: 900, lineHeight: 1,
                      }}>{log?.done ? "✓" : ""}</button>
                    )}
                  </div>

                  {/* log row */}
                  {!isRest && !isEditing && entry.metric_label && (
                    <div style={{ marginTop: 8 }}>
                      {!isOpen ? (
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <button onClick={() => { setOpenLog(entry.id); setLogDraft({ metric: log?.metric || "", notes: log?.notes || "" }); }} style={{
                            background: "none", border: `1px solid ${T.border2}`, color: T.body,
                            borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer",
                          }}>{log?.metric ? "Edit log" : `Log: ${metricLbl}`}</button>
                          <button onClick={() => { setEditingEntry(entry.id); setEditDraft({ label: entry.label, detail: entry.detail ?? "", metric_label: entry.metric_label ?? "" }); }} style={{
                            background: "none", border: `1px solid ${T.border2}`, color: T.faint,
                            borderRadius: 6, padding: "4px 8px", fontSize: 10, cursor: "pointer",
                          }}>Edit workout</button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <input value={logDraft.metric} onChange={(e) => setLogDraft((p) => ({ ...p, metric: e.target.value }))}
                            placeholder={metricLbl}
                            style={{ background: T.inset, border: `1px solid ${T.border2}`, borderRadius: 6, padding: "8px 10px", color: T.text, fontSize: 12 }} />
                          <input value={logDraft.notes} onChange={(e) => setLogDraft((p) => ({ ...p, notes: e.target.value }))}
                            placeholder="Notes (optional)"
                            style={{ background: T.inset, border: `1px solid ${T.border2}`, borderRadius: 6, padding: "8px 10px", color: T.text, fontSize: 12 }} />
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => onSaveLog(entry, day)} style={{ background: st.color, border: "none", color: "#07070e", borderRadius: 6, padding: "6px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Save</button>
                            <button onClick={() => setOpenLog(null)} style={{ background: "none", border: `1px solid ${T.border2}`, color: T.dim, borderRadius: 6, padding: "6px 12px", fontSize: 11, cursor: "pointer" }}>Cancel</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {/* edit workout button when no metric (rest days with overrides etc.) */}
                  {!isRest && !isEditing && !entry.metric_label && (
                    <div style={{ marginTop: 6 }}>
                      <button onClick={() => { setEditingEntry(entry.id); setEditDraft({ label: entry.label, detail: entry.detail ?? "", metric_label: entry.metric_label ?? "" }); }} style={{
                        background: "none", border: `1px solid ${T.border2}`, color: T.faint,
                        borderRadius: 6, padding: "4px 8px", fontSize: 10, cursor: "pointer",
                      }}>Edit workout</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function handleToggleDoneBtn(entry, log, onToggleDone) {
  onToggleDone(entry);
}

// ── PLAN tab ──────────────────────────────────────────────────────────────────
function PlanTab({ sortedWeeks, planState, selectedAthlete, T, resolvedTheme, units, generating, hasWeeks, onGenerate, setSelectedWeek, setView }) {
  if (!hasWeeks) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0" }}>
        <p style={{ color: T.dim, marginBottom: 16 }}>No plan generated yet.</p>
        <button onClick={onGenerate} disabled={generating} style={{
          background: "none", border: "1px solid #60a5fa", color: "#60a5fa",
          borderRadius: 8, padding: "10px 24px", fontSize: 14, cursor: "pointer",
          opacity: generating ? 0.5 : 1,
        }}>{generating ? "Generating…" : `Generate ${planState?.weeks ?? "?"}-week plan`}</button>
      </div>
    );
  }

  // Build phase summaries from plan_weeks
  const phases = [];
  const seen = {};
  for (const w of sortedWeeks) {
    if (!seen[w.phase]) {
      seen[w.phase] = { phase: w.phase, startWeek: w.week_number, endWeek: w.week_number };
      phases.push(seen[w.phase]);
    } else {
      seen[w.phase].endWeek = w.week_number;
    }
  }

  return (
    <div>
      {/* Phase cards */}
      {phases.map((p) => (
        <div key={p.phase} style={{
          background: T.card, border: `1px solid ${PHASE_COLORS[p.phase]}30`,
          borderRadius: 12, padding: "14px 16px", marginBottom: 10,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: PHASE_COLORS[p.phase] }}>
              Phase {p.phase}: {PHASE_NAMES[p.phase]}
            </div>
            <div style={{ fontSize: 10, color: T.faint }}>
              W{p.startWeek}–{p.endWeek}
              {planState?.start_iso && <> · {weekRange(planState.start_iso, p.startWeek).split("–")[0].trim()} – {weekRange(planState.start_iso, p.endWeek).split("–")[1].trim()}</>}
            </div>
          </div>
          <div style={{ fontSize: 12, color: T.body, marginTop: 6, lineHeight: 1.5 }}>
            {PHASE_NAMES[p.phase] === "Base" && "Build the aerobic engine. Learn pacing. Practice station basics."}
            {PHASE_NAMES[p.phase] === "Build" && "HYROX-specific bricks. Stations under fatigue. Lock in rep splits."}
            {PHASE_NAMES[p.phase] === "Peak + Taper" && "Race simulation. Sharpen. Taper. Arrive fresh on race day."}
          </div>
        </div>
      ))}

      {/* Week list */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 16px", marginTop: 4 }}>
        <div style={{ fontSize: 10, color: T.faint, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>All weeks</div>
        {sortedWeeks.map((w) => {
          const sessionsForAthlete = (w.plan_days ?? []).flatMap((d) =>
            (d.plan_entries ?? []).filter((e) => e.athlete_id === selectedAthlete?.id && e.session_type !== "rest")
          );
          return (
            <button key={w.id} onClick={() => { setSelectedWeek(w.week_number); setView("week"); }} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              width: "100%", textAlign: "left", background: "none", border: "none",
              borderBottom: `1px solid ${T.border}`, padding: "8px 0", cursor: "pointer", color: T.text,
            }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: 700, color: PHASE_COLORS[w.phase] }}>W{w.week_number}</span>
                <span style={{ fontSize: 11, color: T.dim, marginLeft: 8 }}>{w.focus}</span>
              </div>
              <div style={{ fontSize: 10, color: T.faint, flexShrink: 0, marginLeft: 8 }}>
                {planState?.start_iso ? weekRange(planState.start_iso, w.week_number) : ""} · {sessionsForAthlete.length} sessions
              </div>
            </button>
          );
        })}
      </div>

      {/* Plan rules */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 16px", marginTop: 10 }}>
        <div style={{ fontSize: 11, color: selectedAthlete?.color ?? "#60a5fa", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
          How this plan works
        </div>
        {[
          ["Run-first", "Three run stimuli per week minimum. Stations matter, but the race is won on the laps."],
          ["Deload weeks", "Every ~4th week is lighter on purpose. Don't add extra."],
          ["Log it or it didn't happen", "30 seconds after each session. The Progress tab tracks trends."],
          ["Hold the team pace", "Run every shared session at the agreed race pace. Faster solo work stays separate."],
        ].map(([t, b]) => (
          <div key={t} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: T.strong }}>{t}</div>
            <div style={{ fontSize: 11.5, color: T.body, lineHeight: 1.55, marginTop: 2 }}>{b}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── RACE STRATEGY tab ─────────────────────────────────────────────────────────
function StrategyTab({ team, members, athleteDetails, T, units }) {
  const a0 = athleteDetails[0];
  const a1 = athleteDetails[1];

  const STATIONS = [
    { key: "ski_erg",          label: "SkiErg (1000m)",          weight: "—" },
    { key: "sled_push",        label: "Sled Push (152kg)",        weight: "152kg" },
    { key: "sled_pull",        label: "Sled Pull (103kg)",        weight: "103kg" },
    { key: "burpee_broad_jumps", label: "Burpee Broad Jumps",    weight: "—" },
    { key: "row",              label: "Row (1000m)",              weight: "—" },
    { key: "farmers_carry",    label: "Farmers Carry (2×24kg)",   weight: "24kg" },
    { key: "sandbag_lunges",   label: "Sandbag Lunges (20kg)",    weight: "20kg" },
    { key: "wall_balls",       label: "Wall Balls (6kg)",         weight: "6kg" },
    { key: "running",          label: "Running (8×1km laps)",     weight: "—" },
  ];

  const ratingOf = (athlete, stationKey) =>
    athlete?.station_ratings?.find((r) => r.station === stationKey)?.rating ?? "okay";

  const leadFor = (stationKey) => {
    if (!a0 || !a1) return null;
    const r0 = ratingOf(a0, stationKey);
    const r1 = ratingOf(a1, stationKey);
    if (r0 === "strength" && r1 !== "strength") return { athlete: a0, share: "~60–70%" };
    if (r1 === "strength" && r0 !== "strength") return { athlete: a1, share: "~60–70%" };
    return null;
  };

  return (
    <div>
      <div style={{ fontSize: 11, color: T.faint, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
        Station split strategy · lock it before race day
      </div>

      {STATIONS.map((s) => {
        const lead = leadFor(s.key);
        const r0   = a0 ? ratingOf(a0, s.key) : "—";
        const r1   = a1 ? ratingOf(a1, s.key) : "—";
        const ratingColor = (r) => r === "strength" ? "#34d399" : r === "weak" ? "#f87171" : T.dim;
        const stationLabel = units === "us" && s.weight !== "—"
          ? `${s.label.replace(s.weight, `${s.weight} (${Math.round(parseFloat(s.weight) * 2.20462)}lb)`)}`
          : s.label;

        return (
          <div key={s.key} style={{
            background: T.card, border: `1px solid ${T.border}`,
            borderRadius: 10, padding: "10px 14px", marginBottom: 6,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.strong }}>{stationLabel}</div>
                <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                  {a0 && <span style={{ fontSize: 11, color: ratingColor(r0) }}>{a0.name}: {r0}</span>}
                  {a1 && <span style={{ fontSize: 11, color: ratingColor(r1) }}>{a1.name}: {r1}</span>}
                </div>
              </div>
              {lead ? (
                <div style={{ fontSize: 11, fontWeight: 800, color: lead.athlete.color, flexShrink: 0, border: `1px solid ${lead.athlete.color}50`, borderRadius: 20, padding: "3px 10px" }}>
                  {lead.athlete.name} leads {lead.share}
                </div>
              ) : (
                <div style={{ fontSize: 11, fontWeight: 700, color: T.dim, flexShrink: 0, border: `1px solid ${T.border2}`, borderRadius: 20, padding: "3px 10px" }}>
                  Even split
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Doubles rules */}
      <div style={{ background: T.amberBg, border: `1px solid ${T.amberBorder}`, borderRadius: 12, padding: "14px 16px", marginTop: 14 }}>
        <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
          Key rules — memorize these
        </div>
        {[
          "Run every 1km lap together, side by side",
          "Split station reps any way you like — but only one athlete works at a time",
          "Sleds are solo efforts: alternate, never push/pull together",
          "Machines (SkiErg, Row): one must fully let go before the other takes over",
          "Farmers carry + sandbag lunges: pass equipment sideways or backwards only",
        ].map((r) => (
          <div key={r} style={{ fontSize: 12, color: T.amberText, lineHeight: 1.7 }}>• {r}</div>
        ))}
      </div>
    </div>
  );
}

// ── PROGRESS tab ──────────────────────────────────────────────────────────────
function ProgressTab({ selectedAthlete, weekStats, totalDone, totalSessions, paceByWeek, logs, sortedWeeks, units, T }) {
  const paceMin   = paceByWeek.length ? Math.min(...paceByWeek.map((p) => p.avg)) : 0;
  const paceMax   = paceByWeek.length ? Math.max(...paceByWeek.map((p) => p.avg)) : 0;
  const paceRange = Math.max(0.5, paceMax - paceMin);
  const KM_PER_MI = 1.60934;
  const pxPace  = (dec) => units === "us" ? paceLabel(dec * KM_PER_MI) : paceLabel(dec);
  const paceUnit = units === "us" ? "/mi" : "/km";

  // Recent logged entries
  const recentLogs = Object.entries(logs)
    .filter(([, v]) => v?.metric)
    .sort(([, a], [, b]) => (b.logged_date || "").localeCompare(a.logged_date || ""))
    .slice(0, 12);

  return (
    <div>
      {/* summary card */}
      <div style={{ background: T.card, border: `1px solid ${selectedAthlete?.color ?? "#60a5fa"}30`, borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
        <div style={{ fontSize: 28, fontWeight: 900, color: selectedAthlete?.color ?? "#60a5fa" }}>
          {totalDone}<span style={{ fontSize: 14, color: T.dim }}> / {totalSessions} sessions</span>
        </div>
        <div style={{ fontSize: 10, color: T.faint, textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 2 }}>
          {selectedAthlete?.name} · completed across {sortedWeeks.length} weeks
        </div>
      </div>

      {/* bar chart — sessions by week */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: T.faint, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Sessions completed by week</div>
        <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 80 }}>
          {weekStats.map((w) => (
            <div key={w.week} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <div style={{ width: "100%", height: 64, background: T.inset, borderRadius: 3, display: "flex", alignItems: "flex-end" }}>
                <div style={{
                  width: "100%",
                  height: `${w.total ? (w.done / w.total) * 100 : 0}%`,
                  background: w.done === w.total && w.total > 0 ? (selectedAthlete?.color ?? "#60a5fa") : `${selectedAthlete?.color ?? "#60a5fa"}70`,
                  borderRadius: 3, minHeight: w.done ? 4 : 0,
                }} />
              </div>
              <div style={{ fontSize: 8, color: T.faint }}>{w.week}</div>
            </div>
          ))}
        </div>
      </div>

      {/* pace chart */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: T.faint, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
          Avg run pace by week ({paceUnit})
        </div>
        {paceByWeek.length < 1 ? (
          <div style={{ fontSize: 12, color: T.dim }}>Log a run pace and your trend line appears here.</div>
        ) : (() => {
          const Wd = 320, Hd = 130, padL = 40, padB = 22, padT = 8, padR = 8;
          const plotW = Wd - padL - padR, plotH = Hd - padT - padB;
          const xFor = (wk) => padL + (plotW * (wk - 1)) / Math.max(1, sortedWeeks.length - 1);
          const yFor = (avg) => padT + (plotH * (avg - (paceMin - 0.1))) / (paceRange + 0.2);
          const pts  = paceByWeek.map((p) => ({ x: xFor(p.week), y: yFor(p.avg), ...p }));
          const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
          const accentColor = selectedAthlete?.color ?? "#60a5fa";
          const first = paceByWeek[0].avg, last = paceByWeek[paceByWeek.length - 1].avg;
          const delta = first - last;
          return (
            <div>
              <svg viewBox={`0 0 ${Wd} ${Hd}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
                {[paceMin, (paceMin + paceMax) / 2, paceMax].map((v, i) => (
                  <g key={i}>
                    <line x1={padL} y1={yFor(v)} x2={Wd - padR} y2={yFor(v)} stroke={T.border} strokeWidth="1" />
                    <text x={padL - 4} y={yFor(v) + 3} textAnchor="end" fontSize="9" fill={T.faint}>{pxPace(v)}</text>
                  </g>
                ))}
                <path d={path} fill="none" stroke={accentColor} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                {pts.map((p, i) => (
                  <g key={i}>
                    <circle cx={p.x} cy={p.y} r="3.5" fill={accentColor} />
                    <text x={p.x} y={Hd - padB + 14} textAnchor="middle" fontSize="9" fill={T.faint}>{p.week}</text>
                  </g>
                ))}
              </svg>
              <div style={{ fontSize: 11, color: T.body, marginTop: 4, textAlign: "center" }}>
                {delta > 0.01
                  ? <span style={{ color: accentColor, fontWeight: 700 }}>↓ {pxPace(Math.abs(delta))}{paceUnit} faster since week 1</span>
                  : delta < -0.01
                  ? <span style={{ color: "#f59e0b", fontWeight: 700 }}>↑ {pxPace(Math.abs(delta))}{paceUnit} slower since week 1</span>
                  : <span>Holding steady</span>}
              </div>
            </div>
          );
        })()}
      </div>

      {/* recent logs */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 16px" }}>
        <div style={{ fontSize: 10, color: T.faint, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Recent logged numbers</div>
        {recentLogs.length === 0 ? (
          <div style={{ fontSize: 12, color: T.dim }}>Nothing logged yet. Tap "Log" on a session card after training.</div>
        ) : recentLogs.map(([entryId, v]) => {
          const entry = sortedWeeks.flatMap((w) => w.plan_days ?? []).flatMap((d) => d.plan_entries ?? []).find((e) => e.id === entryId);
          return (
            <div key={entryId} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 0", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 11, color: T.body }}>{entry?.label ?? "Session"}</div>
              <div style={{ fontSize: 12, color: T.strong, fontWeight: 600, textAlign: "right" }}>
                {v.metric}{v.notes ? <span style={{ color: T.dim, fontWeight: 400 }}> — {v.notes}</span> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
