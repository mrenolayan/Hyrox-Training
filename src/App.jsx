import { useEffect, useState } from "react";
import * as db from "./lib/db.js";
import { getSession, onAuthStateChange, sendMagicLink, signOut } from "./lib/auth.js";
import { palettes, autoTheme } from "./ui/theme.js";
import TeamView from "./components/TeamView.jsx";
import IntakeForm from "./components/IntakeForm.jsx";

const fmtFormat = (id) => (id || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const fmtDate = (iso) => iso
  ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  : "—";

// Copy team link to clipboard
function copyTeamLink(teamId) {
  const url = `${window.location.origin}${window.location.pathname}?t=${teamId}`;
  navigator.clipboard.writeText(url).catch(() => {});
}

export default function App() {
  const [session, setSession]       = useState(undefined);
  const [coach, setCoach]           = useState(null);
  const [teams, setTeams]           = useState([]);
  const [openTeam, setOpenTeam]     = useState(null); // { team, plan, isCoach }
  const [showIntake, setShowIntake] = useState(false);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [themeMode, setThemeMode]   = useState(() => localStorage.getItem("hyrox-theme") || "auto");
  const [units, setUnits]           = useState(() => localStorage.getItem("hyrox-units") || "metric");
  const [copied, setCopied]         = useState(null); // team id that was just copied

  const resolvedTheme = themeMode === "auto" ? autoTheme() : themeMode;
  const T = palettes[resolvedTheme];

  const changeTheme = (m) => { setThemeMode(m); localStorage.setItem("hyrox-theme", m); };
  const changeUnits = (u) => { setUnits(u); localStorage.setItem("hyrox-units", u); };

  // ── check for ?t=<teamId> public link ──────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const teamId = params.get("t");
    if (!teamId) return;
    setLoading(true);
    db.getPublicTeamView(teamId)
      .then(({ team, plan, athletes }) => {
        setOpenTeam({ team, plan, athletes, isCoach: false });
        setLoading(false);
      })
      .catch((err) => {
        if (err.message === "AUTH_REQUIRED") {
          // require_auth=true team — fall through to normal coach/athlete auth flow
          setLoading(false);
        } else {
          setError(err.message);
          setLoading(false);
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── coach auth ────────────────────────────────────────────────────────────
  useEffect(() => {
    getSession().then(setSession).catch(() => setSession(null));
    return onAuthStateChange(setSession);
  }, []);

  useEffect(() => {
    // Skip coach load if we already resolved a public team link
    if (openTeam) return;
    if (!session) return;
    setLoading(true);
    (async () => {
      try {
        await db.linkCoachAuthId(session.user.id, session.user.email);
        const c = await db.getCoach();
        setCoach(c);
        if (c) setTeams(await db.getTeamsForCoach(c.id));
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function openTeamPlan(team) {
    setError(null);
    try {
      const plan = await db.getPlanForTeam(team.id);
      const athletes = await db.getAthletesForTeam(team.id);
      setOpenTeam({ team, plan, athletes, isCoach: true });
    } catch (e) { setError(e.message); }
  }

  async function refreshTeams() {
    if (!coach) return;
    const fresh = await db.getTeamsForCoach(coach.id);
    setTeams(fresh);
  }

  function handleCopyLink(e, teamId) {
    e.stopPropagation();
    copyTeamLink(teamId);
    setCopied(teamId);
    setTimeout(() => setCopied(null), 1800);
  }

  // ── loading / error states ────────────────────────────────────────────────
  if (loading) return <Shell T={T}><p style={{ color: T.dim }}>Loading…</p></Shell>;
  if (error)   return <Shell T={T}><p style={{ color: "#f87171" }}>Error: {error}</p></Shell>;

  // ── public athlete view (team link) ───────────────────────────────────────
  if (openTeam) {
    return (
      <TeamView
        team={openTeam.team}
        plan={openTeam.plan}
        athletes={openTeam.athletes}
        coach={coach}
        isCoach={openTeam.isCoach}
        T={T}
        themeMode={themeMode}
        resolvedTheme={resolvedTheme}
        units={units}
        onChangeTheme={changeTheme}
        onChangeUnits={changeUnits}
        onBack={() => {
          setOpenTeam(null);
          // Clear ?t= param so back goes to coach dashboard
          window.history.replaceState({}, "", window.location.pathname);
        }}
        onPlanUpdated={() => openTeam.isCoach
          ? openTeamPlan(openTeam.team)
          : db.getPublicTeamView(openTeam.team.id).then(({ team, plan, athletes }) =>
              setOpenTeam((prev) => ({ ...prev, team, plan, athletes }))
            )
        }
      />
    );
  }

  // ── coach login gate ──────────────────────────────────────────────────────
  if (session === undefined) return <Shell T={T}><p style={{ color: T.dim }}>Loading…</p></Shell>;
  if (!session) return <LoginScreen T={T} />;

  // ── coach dashboard ───────────────────────────────────────────────────────
  return (
    <Shell T={T}>
      {/* header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ fontSize: 9, color: T.faint, textTransform: "uppercase", letterSpacing: ".12em" }}>
          Coach dashboard
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {["auto", "light", "dark"].map(m => (
            <button key={m} onClick={() => changeTheme(m)} style={{
              background: "none",
              border: `1px solid ${themeMode === m ? "#60a5fa" : T.border2}`,
              color: themeMode === m ? "#60a5fa" : T.faint,
              borderRadius: 10, padding: "2px 8px", fontSize: 10, fontWeight: 600,
              cursor: "pointer", textTransform: "capitalize",
            }}>{m}</button>
          ))}
          <button onClick={() => signOut()} style={{
            background: "none", border: `1px solid ${T.border}`, color: T.dim,
            borderRadius: 8, padding: "3px 8px", cursor: "pointer", fontSize: 11, marginLeft: 4,
          }}>Sign out</button>
        </div>
      </div>

      <h1 style={{ margin: "4px 0 20px", fontSize: 26, color: T.text }}>
        {coach?.name ?? "—"}'s athletes
      </h1>

      {teams.map((team) => {
        const plan = team.plans?.[0];
        const members = team.team_members.map((m) => m.athlete);
        const daysOut = plan?.race_iso
          ? Math.ceil((new Date(plan.race_iso) - new Date()) / 86_400_000)
          : null;
        return (
          <button key={team.id} onClick={() => openTeamPlan(team)} style={{
            display: "block", width: "100%", textAlign: "left",
            background: T.card, border: `1px solid ${T.border}`,
            borderRadius: 12, padding: 16, marginBottom: 10,
            cursor: "pointer", color: T.text, position: "relative",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 17, fontWeight: 700, color: T.strong }}>{team.name}</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ color: T.faint, fontSize: 11 }}>{fmtFormat(team.format_id)}</span>
                <span
                  onClick={(e) => handleCopyLink(e, team.id)}
                  role="button"
                  style={{
                    fontSize: 10, padding: "2px 8px", borderRadius: 8,
                    border: `1px solid ${T.border2}`,
                    color: copied === team.id ? "#4ade80" : T.faint,
                    cursor: "pointer", userSelect: "none",
                  }}
                >
                  {copied === team.id ? "Copied!" : "Copy link"}
                </span>
              </div>
            </div>
            {plan && (
              <div style={{ color: T.dim, fontSize: 12, marginTop: 4 }}>
                {plan.race_name} · {plan.weeks} wk · {fmtDate(plan.race_iso)}
                {daysOut > 0 && (
                  <span style={{ color: "#60a5fa", marginLeft: 8, fontWeight: 600 }}>
                    {daysOut}d out
                  </span>
                )}
              </div>
            )}
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              {members.map((a) => (
                <span key={a.id} style={{
                  fontSize: 12, fontWeight: 700,
                  border: "1px solid", borderRadius: 10, padding: "3px 10px",
                  color: a.color, borderColor: a.color,
                }}>{a.name}</span>
              ))}
            </div>
          </button>
        );
      })}

      <button onClick={() => setShowIntake(true)} style={{
        display: "block", width: "100%", textAlign: "center",
        background: "none", border: `1px dashed ${T.border2}`,
        borderRadius: 12, padding: 14, cursor: "pointer",
        color: T.dim, fontSize: 13, marginTop: 4,
      }}>+ Add new team / athlete</button>

      {showIntake && (
        <IntakeForm
          T={T}
          resolvedTheme={resolvedTheme}
          coachId={coach?.id}
          onDone={async () => { await refreshTeams(); setShowIntake(false); }}
          onCancel={() => setShowIntake(false)}
        />
      )}
    </Shell>
  );
}

// ── Login screen ───────────────────────────────────────────────────────────────
function LoginScreen({ T }) {
  const [email, setEmail]     = useState("mrenolayan@gmail.com");
  const [sent, setSent]       = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr]         = useState(null);

  async function handleSend() {
    setErr(null); setSending(true);
    try { await sendMagicLink(email); setSent(true); }
    catch (e) { setErr(e.message); }
    finally { setSending(false); }
  }

  if (sent) {
    return (
      <Shell T={T}>
        <div style={{ maxWidth: 340, margin: "60px auto", textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📬</div>
          <p style={{ color: T.dim }}>Magic link sent to <strong style={{ color: T.text }}>{email}</strong>.</p>
          <p style={{ color: T.faint, fontSize: 13 }}>Check your inbox and click the link to sign in.</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell T={T}>
      <div style={{ maxWidth: 340, margin: "60px auto" }}>
        <div style={{ fontSize: 9, color: T.faint, textTransform: "uppercase", letterSpacing: ".12em", marginBottom: 8 }}>
          Hyrox Trainer
        </div>
        <h1 style={{ margin: "0 0 24px", fontSize: 26, color: T.text }}>Coach login</h1>
        <label style={{ display: "block", color: T.dim, fontSize: 12, marginBottom: 6 }}>Email</label>
        <input
          type="email" value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          style={{
            display: "block", width: "100%", boxSizing: "border-box",
            background: T.inset, border: `1px solid ${T.border}`,
            borderRadius: 8, color: T.text, fontSize: 15,
            padding: "10px 12px", marginBottom: 12,
            outline: "none", fontFamily: "inherit",
          }}
        />
        <button onClick={handleSend} disabled={sending || !email} style={{
          display: "block", width: "100%", padding: "10px 0",
          background: "none", border: `1px solid #60a5fa`,
          color: "#60a5fa", borderRadius: 8, fontSize: 14,
          cursor: "pointer", opacity: (sending || !email) ? 0.5 : 1,
        }}>{sending ? "Sending…" : "Send magic link"}</button>
        {err && <p style={{ color: "#f87171", fontSize: 13, marginTop: 10 }}>{err}</p>}
      </div>
    </Shell>
  );
}

function Shell({ T, children }) {
  return (
    <div style={{
      background: T.bg, minHeight: "100vh", color: T.text,
      fontFamily: "'Avenir Next', system-ui, sans-serif", padding: "24px 16px",
    }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>{children}</div>
    </div>
  );
}
