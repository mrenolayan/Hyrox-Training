import { useEffect, useState } from "react";
import * as db from "./lib/db.js";
import { inviteStatus, latestInvite } from "./lib/auth.js";
import useAuth from "./hooks/useAuth.js";
import { palettes, autoTheme } from "./ui/theme.js";
import TeamView from "./components/TeamView.jsx";
import IntakeForm from "./components/IntakeForm.jsx";

const fmtFormat = (id) => (id || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const fmtDate = (iso) => iso
  ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  : "—";

// Inbound routes, read once at load and stripped after handling.
const urlParams       = new URLSearchParams(window.location.search);
const legacyTeamParam = urlParams.get("t");      // old Phase 7 share links
const inviteToken     = urlParams.get("invite"); // Phase 8 invite links

function clearUrlParams() {
  window.history.replaceState({}, "", window.location.pathname);
}

export default function App() {
  const { session, role, profile, loading: authLoading,
          inviteError, signInWithMagicLink, signOut } = useAuth(inviteToken);

  const [teams, setTeams]             = useState([]);
  const [openTeam, setOpenTeam]       = useState(null); // { team, plan, athletes, isCoach, selfAthleteId }
  const [showIntake, setShowIntake]   = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError]             = useState(null);
  const [themeMode, setThemeMode]     = useState(() => localStorage.getItem("hyrox-theme") || "auto");
  const [units, setUnits]             = useState(() => localStorage.getItem("hyrox-units") || "metric");
  const [inviting, setInviting]       = useState(null); // { athlete, teamId, email }

  const resolvedTheme = themeMode === "auto" ? autoTheme() : themeMode;
  const T = palettes[resolvedTheme];

  const changeTheme = (m) => { setThemeMode(m); localStorage.setItem("hyrox-theme", m); };
  const changeUnits = (u) => { setUnits(u); localStorage.setItem("hyrox-units", u); };

  const coach = role === "coach" ? profile : null;

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

  // ── load data once the role is known ───────────────────────────────────────
  useEffect(() => {
    if (authLoading || !session || !role || role === "unlinked") return;
    let cancelled = false;
    (async () => {
      setDataLoading(true);
      try {
        if (role === "coach") {
          const fresh = await db.getTeamsForCoach(profile.id);
          if (cancelled) return;
          setTeams(fresh);
          // old ?t= link: a signed-in coach lands directly on that team
          if (legacyTeamParam) {
            const target = fresh.find((t) => t.id === legacyTeamParam);
            if (target) await openTeamPlan(target);
          }
        } else if (role === "athlete") {
          const ctx = await db.getMyAthleteContext(profile.id);
          if (!cancelled && ctx) {
            setOpenTeam({ ...ctx, isCoach: false, selfAthleteId: profile.id });
          }
        }
        clearUrlParams(); // ?t= / ?invite= have served their purpose
      } catch (e) { if (!cancelled) setError(e.message); }
      finally { if (!cancelled) setDataLoading(false); }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, profile?.id, authLoading]);

  // ── loading / error states ────────────────────────────────────────────────
  if (authLoading || dataLoading) return <Shell T={T}><p style={{ color: T.dim }}>Loading…</p></Shell>;

  if (error) return (
    <Shell T={T}>
      <p style={{ color: "#f87171" }}>Error: {error}</p>
      <button onClick={() => signOut()} style={{
        background: "none", border: `1px solid ${T.border}`, color: T.dim,
        borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 12, marginTop: 10,
      }}>Sign out</button>
    </Shell>
  );

  // No session → always the login screen. Old ?t=<team_id> links land here
  // with a message instead of erroring or showing a blank page.
  if (!session) return (
    <LoginScreen
      T={T}
      claim={!!inviteToken}
      message={legacyTeamParam
        ? "Team links now require an account. Sign in with the email your coach has for you to continue."
        : null}
      onSend={(email) => signInWithMagicLink(
        email,
        inviteToken
          ? `${window.location.origin}${window.location.pathname}?invite=${inviteToken}`
          : undefined
      )}
    />
  );

  // Signed in but matches no coach/athlete row (bad, used, or missing invite).
  if (role === "unlinked") return (
    <UnlinkedScreen T={T} email={session.user.email} inviteError={inviteError} onSignOut={signOut} />
  );

  if (openTeam) return (
    <TeamView
      team={openTeam.team}
      plan={openTeam.plan}
      athletes={openTeam.athletes}
      coach={coach}
      isCoach={openTeam.isCoach}
      selfAthleteId={openTeam.selfAthleteId}
      T={T}
      themeMode={themeMode}
      resolvedTheme={resolvedTheme}
      units={units}
      onChangeTheme={changeTheme}
      onChangeUnits={changeUnits}
      onBack={openTeam.isCoach ? () => setOpenTeam(null) : null}
      onSignOut={signOut}
      onPlanUpdated={() => openTeam.isCoach
        ? openTeamPlan(openTeam.team)
        : db.getMyAthleteContext(openTeam.selfAthleteId).then((ctx) =>
            ctx && setOpenTeam((prev) => ({ ...prev, ...ctx })))
      }
    />
  );

  if (role === "athlete") return (
    <Shell T={T}>
      <p style={{ color: T.dim }}>You're signed in, but not on a team yet. Ask your coach.</p>
      <button onClick={() => signOut()} style={{
        background: "none", border: `1px solid ${T.border}`, color: T.dim,
        borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 12, marginTop: 10,
      }}>Sign out</button>
    </Shell>
  );

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
              <span style={{ color: T.faint, fontSize: 11 }}>{fmtFormat(team.format_id)}</span>
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
              {members.map((a) => {
                const inv = latestInvite(a.athlete_invites);
                const status = a.user_id ? "accepted" : inviteStatus(inv);
                return (
                  <span
                    key={a.id}
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (status !== "accepted") {
                        setInviting({ athlete: a, teamId: team.id, email: inv?.email ?? "" });
                      }
                    }}
                    title={
                      status === "accepted" ? "Account claimed"
                      : status === "pending"  ? `Invited ${inv.email} — click to re-send`
                      : status === "expired"  ? "Invite expired — click to re-send"
                      : "Click to invite"
                    }
                    style={{
                      fontSize: 12, fontWeight: 700, border: "1px solid", borderRadius: 10,
                      padding: "3px 10px", color: a.color, borderColor: a.color,
                      cursor: status === "accepted" ? "default" : "pointer",
                    }}
                  >
                    {a.name}
                    {status === "accepted" && <span style={{ color: "#4ade80", marginLeft: 5 }}>✓</span>}
                    {status === "pending"  && <span style={{ color: "#f0c020", marginLeft: 5 }}>⏳</span>}
                    {status === "expired"  && <span style={{ color: "#f87171", marginLeft: 5 }}>⚠</span>}
                    {!status               && <span style={{ color: T.faint, marginLeft: 5 }}>✉ invite</span>}
                  </span>
                );
              })}
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

      {inviting && (
        <InviteModal
          T={T}
          athlete={inviting.athlete}
          teamId={inviting.teamId}
          defaultEmail={inviting.email}
          onSent={async () => { await refreshTeams(); setInviting(null); }}
          onCancel={() => setInviting(null)}
        />
      )}
    </Shell>
  );
}

// ── Invite modal ──────────────────────────────────────────────────────────────
function InviteModal({ T, athlete, teamId, defaultEmail, onSent, onCancel }) {
  const [email, setEmail]     = useState(defaultEmail || "");
  const [sending, setSending] = useState(false);
  const [err, setErr]         = useState(null);

  async function handleSend() {
    setErr(null); setSending(true);
    try {
      await db.createInvite(athlete.id, teamId, email);
      onSent();
    } catch (e) { setErr(e.message); }
    finally { setSending(false); }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      zIndex: 1000, overflowY: "auto", padding: "20px 12px",
    }}>
      <div style={{
        background: T.bg, border: `1px solid ${T.border}`, borderRadius: 14,
        padding: "20px", width: "100%", maxWidth: 420,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>
            Invite {athlete.name}
          </div>
          <button onClick={onCancel} style={{ background: "none", border: "none", color: T.faint, cursor: "pointer", fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
        <label style={{ display: "block", color: T.dim, fontSize: 12, marginBottom: 6 }}>Athlete's email</label>
        <input
          type="email" value={email} autoFocus
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          style={{
            display: "block", width: "100%", boxSizing: "border-box",
            background: T.inset, border: `1px solid ${T.border}`,
            borderRadius: 8, color: T.text, fontSize: 15,
            padding: "10px 12px", marginBottom: 12, outline: "none", fontFamily: "inherit",
          }}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleSend} disabled={sending || !email} style={{
            background: "#60a5fa", border: "none", color: "#07070e",
            borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700,
            cursor: "pointer", opacity: (sending || !email) ? 0.5 : 1,
          }}>{sending ? "Sending…" : "Send invite"}</button>
          <button onClick={onCancel} style={{
            background: "none", border: `1px solid ${T.border2}`, color: T.dim,
            borderRadius: 8, padding: "10px 16px", fontSize: 13, cursor: "pointer",
          }}>Cancel</button>
        </div>
        {err && <p style={{ color: "#f87171", fontSize: 13, marginTop: 10 }}>{err}</p>}
        <p style={{ color: T.faint, fontSize: 11, marginTop: 12 }}>
          Link expires in 30 days. Re-sending replaces any pending invite for this athlete.
        </p>
      </div>
    </div>
  );
}

// ── Login screen ───────────────────────────────────────────────────────────────
function LoginScreen({ T, claim, message, onSend }) {
  const [email, setEmail]     = useState("");
  const [sent, setSent]       = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr]         = useState(null);

  async function handleSend() {
    setErr(null); setSending(true);
    try { await onSend(email); setSent(true); }
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
        <h1 style={{ margin: "0 0 12px", fontSize: 26, color: T.text }}>
          {claim ? "Claim your account" : "Sign in"}
        </h1>
        {claim && (
          <p style={{ color: T.dim, fontSize: 13, marginBottom: 16 }}>
            Your coach set up a training plan for you — enter your email and we'll send a sign-in link.
          </p>
        )}
        {message && (
          <p style={{ color: T.faint, fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>{message}</p>
        )}
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

// ── Unlinked screen (signed in, no matching coach/athlete row) ─────────────────
function UnlinkedScreen({ T, email, inviteError, onSignOut }) {
  const inviteMessage = {
    INVITE_NOT_FOUND: "That invite link isn't valid.",
    INVITE_EXPIRED: "That invite link has expired — ask your coach to re-send it.",
    INVITE_ALREADY_USED: "That invite has already been used by another account.",
    ATHLETE_ALREADY_CLAIMED: "That athlete profile has already been claimed by a different account.",
    NOT_AUTHENTICATED: null,
  }[inviteError] ?? (inviteError ? "Something went wrong claiming your invite." : null);

  return (
    <Shell T={T}>
      <div style={{ maxWidth: 360, margin: "60px auto", textAlign: "center" }}>
        <p style={{ color: T.dim }}>
          Signed in as <strong style={{ color: T.text }}>{email}</strong>, but no plan is linked to this account yet.
        </p>
        {inviteMessage && (
          <p style={{ color: "#f87171", fontSize: 13, marginTop: 10 }}>{inviteMessage}</p>
        )}
        <p style={{ color: T.faint, fontSize: 13, marginTop: 10 }}>
          Ask your coach to invite this email address.
        </p>
        <button onClick={onSignOut} style={{
          background: "none", border: `1px solid ${T.border}`, color: T.dim,
          borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 12, marginTop: 16,
        }}>Sign out</button>
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
