import { useEffect, useState } from "react";
import * as db from "./lib/db.js";
import { generatePlan } from "./lib/plan.js";

// ── Phase 2/3 smoke UI: coach dashboard + plan generator wired to live DB. ──────
// Minimal styling on purpose — the polished UI (tabs/theme/countdown) lands in
// Phase 6. The point here is to prove the data layer and generator work.

const T = {
  bg: "#07070e", card: "#0f0f1e", inset: "#0a0a14", border: "#22223a",
  text: "#eceefa", dim: "#9c9cc0", faint: "#7c7ca6", accent: "#60a5fa",
};
const PHASE_NAME = { 1: "Base", 2: "Build", 3: "Peak + Taper" };

export default function App() {
  const [coach, setCoach] = useState(null);
  const [teams, setTeams] = useState([]);
  const [openTeam, setOpenTeam] = useState(null); // { team, plan }
  const [week, setWeek] = useState(1);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const c = await db.getCoach();
        setCoach(c);
        if (c) setTeams(await db.getTeamsForCoach(c.id));
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, []);

  async function openTeamPlan(team) {
    setError(null); setWeek(1);
    try {
      const plan = await db.getPlanForTeam(team.id);
      setOpenTeam({ team, plan });
    } catch (e) { setError(e.message); }
  }

  async function handleGenerate(team, plan) {
    setError(null); setGenerating(true);
    try {
      const athletes = await db.getAthletesForTeam(team.id);
      const generated = generatePlan(team, plan, athletes);
      const counts = await db.savePlanTree(plan.id, generated.weeks);
      console.log("savePlanTree counts:", counts);
      // Reload the plan tree from DB so the UI reflects what was saved
      const fresh = await db.getPlanForTeam(team.id);
      setOpenTeam({ team, plan: fresh });
      setWeek(1);
    } catch (e) { setError(e.message); }
    finally { setGenerating(false); }
  }

  if (loading) return <Shell><p style={{ color: T.dim }}>Loading…</p></Shell>;
  if (error) return <Shell><p style={{ color: "#f87171" }}>Error: {error}</p></Shell>;

  if (openTeam) {
    const { team, plan } = openTeam;
    const weeks = (plan?.plan_weeks ?? []).sort((a, b) => a.week_number - b.week_number);
    const wk = weeks.find((w) => w.week_number === week);
    const members = team.team_members.map((m) => m.athlete);
    return (
      <Shell>
        <button onClick={() => setOpenTeam(null)} style={btn}>← All teams</button>
        <h1 style={{ margin: "12px 0 2px", fontSize: 26 }}>{team.name}</h1>
        <p style={{ color: T.dim, marginTop: 0 }}>
          {fmtFormat(team.format_id)} · {plan?.race_name} · {plan?.weeks} weeks · {plan?.status}
        </p>

        {weeks.length === 0 ? (
          <div>
            <p style={{ color: T.faint, marginBottom: 12 }}>No plan generated yet (draft).</p>
            <button
              data-testid="generate-plan"
              onClick={() => handleGenerate(team, plan)}
              disabled={generating || !plan}
              style={{ ...btn, borderColor: T.accent, color: T.accent, opacity: generating ? 0.5 : 1 }}
            >
              {generating ? "Generating…" : `Generate ${plan?.weeks}-week plan`}
            </button>
            {error && <p style={{ color: "#f87171", marginTop: 8, fontSize: 13 }}>{error}</p>}
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "10px 0 16px" }}>
              {weeks.map((w) => (
                <button key={w.id} onClick={() => setWeek(w.week_number)} style={{
                  ...chip, ...(w.week_number === week ? { borderColor: T.accent, color: T.accent } : {}),
                }}>W{w.week_number}</button>
              ))}
            </div>
            {wk && (
              <div>
                <div style={{ color: T.faint, fontSize: 12, textTransform: "uppercase", letterSpacing: ".08em" }}>
                  {PHASE_NAME[wk.phase]} · Week {wk.week_number}
                </div>
                <div style={{ color: T.dim, marginBottom: 4 }}>{wk.focus}</div>
                {wk.coach_notes?.body && (
                  <div style={{ ...note }}>📋 {wk.coach_notes.body}</div>
                )}
                <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
                  <thead>
                    <tr style={{ color: T.faint, fontSize: 11, textAlign: "left" }}>
                      <th style={th}>Day</th>
                      {members.map((a) => <th key={a.id} style={{ ...th, color: a.color }}>{a.name}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {(wk.plan_days ?? []).sort(dayOrder).map((d) => (
                      <tr key={d.id} style={{ borderTop: `1px solid ${T.border}` }}>
                        <td style={{ ...td, color: T.dim, whiteSpace: "nowrap" }}>
                          {d.day_of_week}{d.shared ? " 👫" : ""}{d.optional ? " (opt)" : ""}
                        </td>
                        {members.map((a) => {
                          const e = (d.plan_entries ?? []).find((x) => x.athlete_id === a.id);
                          return (
                            <td key={a.id} style={td}>
                              {e ? <span title={e.detail || ""}>{e.label}</span> : <span style={{ color: T.faint }}>—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Shell>
    );
  }

  return (
    <Shell>
      <div style={{ color: T.faint, fontSize: 12, textTransform: "uppercase", letterSpacing: ".12em" }}>
        Coach dashboard
      </div>
      <h1 style={{ margin: "4px 0 16px", fontSize: 26 }}>{coach?.name ?? "—"}'s athletes</h1>
      {teams.map((team) => {
        const plan = team.plans?.[0];
        const members = team.team_members.map((m) => m.athlete);
        return (
          <button key={team.id} onClick={() => openTeamPlan(team)} style={teamCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 17, fontWeight: 700 }}>{team.name}</span>
              <span style={{ color: T.faint, fontSize: 12 }}>{fmtFormat(team.format_id)}</span>
            </div>
            <div style={{ color: T.dim, fontSize: 13, marginTop: 4 }}>
              {plan ? `${plan.race_name} · ${plan.weeks} wk · ${plan.status}` : "No plan"}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              {members.map((a) => (
                <span key={a.id} style={{ ...pill, color: a.color, borderColor: a.color }}>{a.name}</span>
              ))}
            </div>
          </button>
        );
      })}
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div style={{ background: T.bg, minHeight: "100vh", color: T.text,
      fontFamily: "'Avenir Next', system-ui, sans-serif", padding: "24px 16px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>{children}</div>
    </div>
  );
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const dayOrder = (a, b) => DAYS.indexOf(a.day_of_week) - DAYS.indexOf(b.day_of_week);
const fmtFormat = (id) => (id || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const btn = { background: "none", border: `1px solid ${T.border}`, color: T.dim, borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 13 };
const chip = { background: "none", border: `1px solid ${T.border}`, color: T.dim, borderRadius: 14, padding: "3px 11px", cursor: "pointer", fontSize: 12, fontWeight: 600 };
const teamCard = { display: "block", width: "100%", textAlign: "left", background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16, marginBottom: 12, cursor: "pointer", color: T.text };
const pill = { fontSize: 11, fontWeight: 700, border: "1px solid", borderRadius: 10, padding: "2px 8px" };
const th = { padding: "6px 8px", fontWeight: 600 };
const td = { padding: "8px 8px", fontSize: 13, verticalAlign: "top" };
const note = { background: T.inset, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, color: T.dim, margin: "8px 0" };
