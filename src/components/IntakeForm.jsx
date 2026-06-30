import { useState } from "react";
import * as db from "../lib/db.js";
import { generatePlan } from "../lib/plan.js";

// ── constants ─────────────────────────────────────────────────────────────────
const FORMATS = {
  mens_solo:       { label: "Men's Solo",          athletes: 1, team: false },
  womens_solo:     { label: "Women's Solo",         athletes: 1, team: false },
  doubles_men:     { label: "Doubles Men",          athletes: 2, team: true },
  doubles_women:   { label: "Doubles Women",        athletes: 2, team: true },
  mixed_doubles:   { label: "Mixed Doubles",        athletes: 2, team: true },
  relay_men:       { label: "Relay Men (4)",        athletes: 4, team: true },
  relay_women:     { label: "Relay Women (4)",      athletes: 4, team: true },
  relay_mixed:     { label: "Relay Mixed (2M/2W)",  athletes: 4, team: true },
};

const RACES = [
  { name: "Amazfit HYROX Washington D.C.", city: "Washington D.C.", iso: "2026-09-03" },
  { name: "InBody HYROX Salt Lake City",   city: "Salt Lake City",  iso: "2026-09-18" },
  { name: "HWPO HYROX Boston",             city: "Boston",          iso: "2026-10-08" },
  { name: "MyFitnessPal HYROX Tampa",      city: "Tampa",           iso: "2026-10-23" },
  { name: "INTERSPORT HYROX Hamburg",      city: "Hamburg",         iso: "2026-10-28" },
  { name: "HYROX Denver",                  city: "Denver",          iso: "2026-11-12" },
  { name: "HYROX Dallas",                  city: "Dallas",          iso: "2026-11-18" },
  { name: "HYROX London ExCel",            city: "London",          iso: "2026-12-02" },
  { name: "HYROX Anaheim",                 city: "Anaheim",         iso: "2026-12-04" },
  { name: "HYROX Nashville",               city: "Nashville",       iso: "2026-12-10" },
  { name: "HYROX Vancouver",               city: "Vancouver",       iso: "2026-12-18" },
];

const STATIONS = [
  { key: "ski_erg",             label: "Ski Erg" },
  { key: "sled_push",           label: "Sled Push" },
  { key: "sled_pull",           label: "Sled Pull" },
  { key: "burpee_broad_jumps",  label: "Burpee Broad Jumps" },
  { key: "row",                 label: "Row" },
  { key: "farmers_carry",       label: "Farmers Carry" },
  { key: "sandbag_lunges",      label: "Sandbag Lunges" },
  { key: "wall_balls",          label: "Wall Balls" },
  { key: "running",             label: "Running" },
];

const MODALITIES = ["crossfit", "lifting", "hiit", "running_club", "yoga_pilates", "other"];
const ATHLETE_COLORS = ["#60a5fa", "#a78bfa", "#f59e0b", "#fb7185"];

const defaultAthlete = (i) => ({
  name: "", color: ATHLETE_COLORS[i] ?? "#60a5fa", role: "",
  run_pace: "", longest_run: "",
  profile: { known_weights: "", team_split_notes: "", injuries_notes: "" },
  ratings: Object.fromEntries(STATIONS.map((s) => [s.key, "okay"])),
  modalities: [],
});

const fmtDate = (iso) => new Date(iso + "T07:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// ── IntakeForm ─────────────────────────────────────────────────────────────────
export default function IntakeForm({ T, resolvedTheme, coachId, onDone, onCancel }) {
  // step: 0 = team, 1 = athletes, 2 = ratings, 3 = saving
  const [step, setStep]   = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState(null);
  const [requireAuth, setRequireAuth] = useState(false);

  // team fields
  const [teamName, setTeamName]           = useState("");
  const [formatId, setFormatId]           = useState("doubles_men");
  const [raceName, setRaceName]           = useState(RACES[0].name);
  const [planWeeks, setPlanWeeks]         = useState(12);
  const [daysPerWeek, setDaysPerWeek]     = useState(5);
  const [startISO, setStartISO]           = useState("");
  const [teamUnits, setTeamUnits]         = useState("metric");

  const fmt    = FORMATS[formatId] ?? FORMATS.doubles_men;
  const nAth   = fmt.athletes;
  const race   = RACES.find((r) => r.name === raceName) ?? RACES[0];

  // per-athlete fields (array, length changes with format)
  const [athletes, setAthletes] = useState([defaultAthlete(0), defaultAthlete(1)]);

  function ensureAthletes(count) {
    setAthletes((prev) => {
      const next = [...prev];
      while (next.length < count) next.push(defaultAthlete(next.length));
      return next.slice(0, count);
    });
  }

  function updateAthlete(i, patch) {
    setAthletes((prev) => prev.map((a, idx) => idx === i ? { ...a, ...patch } : a));
  }
  function updateProfile(i, patch) {
    setAthletes((prev) => prev.map((a, idx) => idx === i ? { ...a, profile: { ...a.profile, ...patch } } : a));
  }
  function updateRating(i, stationKey, value) {
    setAthletes((prev) => prev.map((a, idx) =>
      idx === i ? { ...a, ratings: { ...a.ratings, [stationKey]: value } } : a
    ));
  }
  function toggleModality(i, mod) {
    setAthletes((prev) => prev.map((a, idx) => {
      if (idx !== i) return a;
      const has = a.modalities.includes(mod);
      return { ...a, modalities: has ? a.modalities.filter((m) => m !== mod) : [...a.modalities, mod] };
    }));
  }

  // ── validation ────────────────────────────────────────────────────────────────
  const step0Valid = teamName.trim() && startISO;
  const step1Valid = athletes.slice(0, nAth).every((a) => a.name.trim());

  // ── save ──────────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true); setSaveErr(null);
    try {
      const athletePayload = athletes.slice(0, nAth).map((a) => ({
        name: a.name.trim(),
        color: a.color,
        role: a.role.trim() || null,
        run_pace: a.run_pace.trim() || null,
        longest_run: a.longest_run ? parseFloat(a.longest_run) : null,
        profile: {
          known_weights: a.profile.known_weights || null,
          team_split_notes: a.profile.team_split_notes || null,
          injuries_notes: a.profile.injuries_notes || null,
        },
        ratings: STATIONS.map((s) => ({ station: s.key, rating: a.ratings[s.key] })),
        modalities: a.modalities,
      }));

      const { team, plan, athletes: athleteRows } = await db.createTeamFull({
      requireAuth,
        coachId,
        teamName: teamName.trim(),
        formatId,
        teamUnits,
        planWeeks,
        planDaysPerWeek: daysPerWeek,
        startISO,
        raceName: race.name,
        raceCity: race.city,
        raceISO: race.iso + "T07:00:00",
        athletes: athletePayload,
      });

      // generate plan
      const generated = generatePlan(team, plan, athleteRows);
      await db.savePlanTree(plan.id, generated.weeks);

      onDone();
    } catch (e) {
      setSaveErr(e.message);
      setSaving(false);
    }
  }

  // ── shared input styles ───────────────────────────────────────────────────────
  const inp = (extra = {}) => ({
    background: T.inset, border: `1px solid ${T.border2}`, borderRadius: 6,
    padding: "8px 10px", color: T.text, fontSize: 12, fontFamily: "inherit",
    width: "100%", boxSizing: "border-box", outline: "none",
    ...extra,
  });
  const label = (text) => (
    <div style={{ fontSize: 11, color: T.dim, marginBottom: 4, marginTop: 10 }}>{text}</div>
  );
  const sectionHead = (text) => (
    <div style={{ fontSize: 10, color: T.faint, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, marginTop: 16 }}>{text}</div>
  );

  const btnPrimary = { background: "#60a5fa", border: "none", color: "#07070e", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" };
  const btnSecondary = { background: "none", border: `1px solid ${T.border2}`, color: T.dim, borderRadius: 8, padding: "10px 16px", fontSize: 13, cursor: "pointer" };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      zIndex: 1000, overflowY: "auto", padding: "20px 12px",
    }}>
      <div style={{
        background: T.bg, border: `1px solid ${T.border}`, borderRadius: 14,
        padding: "20px", width: "100%", maxWidth: 560,
      }}>
        {/* header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>
              {step === 0 && "New team"}
              {step === 1 && "Athlete details"}
              {step === 2 && "Station ratings"}
              {step === 3 && "Generating plan…"}
            </div>
            <div style={{ fontSize: 11, color: T.faint, marginTop: 2 }}>Step {step + 1} of 3</div>
          </div>
          <button onClick={onCancel} style={{ background: "none", border: "none", color: T.faint, cursor: "pointer", fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        {/* ── STEP 0: team details ─────────────────────────────────────── */}
        {step === 0 && (
          <div>
            {label("Team / athlete name *")}
            <input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="e.g. Reece & Samantha — DC" style={inp()} />

            {label("Race format *")}
            <select value={formatId} onChange={(e) => { setFormatId(e.target.value); ensureAthletes(FORMATS[e.target.value].athletes); }}
              style={inp()}>
              {Object.entries(FORMATS).map(([id, f]) => <option key={id} value={id}>{f.label}</option>)}
            </select>

            {label("Target race *")}
            <select value={raceName} onChange={(e) => setRaceName(e.target.value)} style={inp()}>
              {RACES.map((r) => <option key={r.name} value={r.name}>{r.name} · {fmtDate(r.iso)}</option>)}
            </select>

            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                {label("Plan length (weeks) *")}
                <select value={planWeeks} onChange={(e) => setPlanWeeks(Number(e.target.value))} style={inp()}>
                  {[8, 12, 16, 20].map((w) => <option key={w} value={w}>{w} weeks</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                {label("Training days / week")}
                <select value={daysPerWeek} onChange={(e) => setDaysPerWeek(Number(e.target.value))} style={inp()}>
                  {[3, 4, 5, 6].map((d) => <option key={d} value={d}>{d} days</option>)}
                </select>
              </div>
            </div>

            {label("Plan start date *")}
            <input type="date" value={startISO} onChange={(e) => setStartISO(e.target.value)} style={inp()} />

            {label("Units")}
            <div style={{ display: "flex", gap: 8 }}>
              {[["metric","Metric (kg/km)"],["us","US (lb/mi)"]].map(([id, lbl]) => (
                <button key={id} onClick={() => setTeamUnits(id)} style={{
                  flex: 1, background: teamUnits === id ? "#60a5fa22" : "none",
                  border: `1px solid ${teamUnits === id ? "#60a5fa" : T.border2}`,
                  color: teamUnits === id ? "#60a5fa" : T.dim,
                  borderRadius: 8, padding: "8px", fontSize: 12, cursor: "pointer",
                }}>{lbl}</button>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 16 }}>
              <input
                type="checkbox"
                id="require_auth"
                checked={requireAuth}
                onChange={(e) => setRequireAuth(e.target.checked)}
                style={{ width: 16, height: 16, cursor: "pointer", marginTop: 2 }}
              />
              <label htmlFor="require_auth" style={{ color: T.body, fontSize: 13, cursor: "pointer" }}>
                Require athlete login (magic link) for this team
                <span style={{ color: T.faint, fontSize: 11, display: "block" }}>
                  Leave unchecked for link-only access (existing teams like Walker, Hung/Andrew use this)
                </span>
              </label>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={onCancel} style={btnSecondary}>Cancel</button>
              <button onClick={() => setStep(1)} disabled={!step0Valid} style={{ ...btnPrimary, opacity: step0Valid ? 1 : 0.4 }}>
                Next: Athlete details →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 1: athlete details ───────────────────────────────────── */}
        {step === 1 && (
          <div>
            {athletes.slice(0, nAth).map((a, i) => (
              <div key={i} style={{ background: T.card, border: `1px solid ${a.color}40`, borderRadius: 10, padding: "14px", marginBottom: 14 }}>
                {sectionHead(`Athlete ${i + 1}${nAth > 1 ? ` of ${nAth}` : ""}`)}

                <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                  <div style={{ flex: 1 }}>
                    {label("Name *")}
                    <input value={a.name} onChange={(e) => updateAthlete(i, { name: e.target.value })} placeholder="First name" style={inp()} />
                  </div>
                  <div>
                    {label("Color")}
                    <div style={{ display: "flex", gap: 6 }}>
                      {ATHLETE_COLORS.map((c) => (
                        <button key={c} onClick={() => updateAthlete(i, { color: c })} style={{
                          width: 26, height: 26, borderRadius: 13, background: c, cursor: "pointer",
                          border: a.color === c ? `2px solid white` : "2px solid transparent",
                        }} />
                      ))}
                    </div>
                  </div>
                </div>

                {label("Role (optional)")}
                <input value={a.role} onChange={(e) => updateAthlete(i, { role: e.target.value })} placeholder="e.g. Power lead · Sled, Sandbag" style={inp()} />

                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    {label("Comfortable run pace")}
                    <input value={a.run_pace} onChange={(e) => updateAthlete(i, { run_pace: e.target.value })} placeholder="e.g. 6:15/km" style={inp()} />
                  </div>
                  <div style={{ flex: 1 }}>
                    {label("Longest run (km)")}
                    <input type="number" value={a.longest_run} onChange={(e) => updateAthlete(i, { longest_run: e.target.value })} placeholder="e.g. 10" style={inp()} />
                  </div>
                </div>

                {label("Training background")}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                  {MODALITIES.map((m) => (
                    <button key={m} onClick={() => toggleModality(i, m)} style={{
                      background: a.modalities.includes(m) ? `${a.color}22` : "none",
                      border: `1px solid ${a.modalities.includes(m) ? a.color : T.border2}`,
                      color: a.modalities.includes(m) ? a.color : T.faint,
                      borderRadius: 10, padding: "4px 10px", fontSize: 11, cursor: "pointer",
                      textTransform: "capitalize",
                    }}>{m.replace("_", " ")}</button>
                  ))}
                </div>

                {label("Known weights / PRs")}
                <input value={a.profile.known_weights} onChange={(e) => updateProfile(i, { known_weights: e.target.value })} placeholder="e.g. Back squat 100kg, 5k 23 min" style={inp()} />

                {nAth > 1 && (
                  <>
                    {label("Split / role notes")}
                    <input value={a.profile.team_split_notes} onChange={(e) => updateProfile(i, { team_split_notes: e.target.value })} placeholder="e.g. Leads sled push and sandbag" style={inp()} />
                  </>
                )}

                {label("Injuries / limits / schedule constraints")}
                <input value={a.profile.injuries_notes} onChange={(e) => updateProfile(i, { injuries_notes: e.target.value })} placeholder="e.g. Left knee — avoid deep lunges" style={inp()} />
              </div>
            ))}

            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button onClick={() => setStep(0)} style={btnSecondary}>← Back</button>
              <button onClick={() => setStep(2)} disabled={!step1Valid} style={{ ...btnPrimary, opacity: step1Valid ? 1 : 0.4 }}>
                Next: Station ratings →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: station ratings ───────────────────────────────────── */}
        {step === 2 && (
          <div>
            <div style={{ fontSize: 12, color: T.dim, marginBottom: 14, lineHeight: 1.5 }}>
              Rate each station for each athlete. The plan generator uses these to bias programming toward weak stations and schedule strengths on high-intensity days.
            </div>

            {athletes.slice(0, nAth).map((a, i) => (
              <div key={i} style={{ background: T.card, border: `1px solid ${a.color}40`, borderRadius: 10, padding: "14px", marginBottom: 14 }}>
                {sectionHead(a.name || `Athlete ${i + 1}`)}
                {STATIONS.map((s) => (
                  <div key={s.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ fontSize: 12, color: T.body, flex: 1 }}>{s.label}</div>
                    <div style={{ display: "flex", gap: 4 }}>
                      {[["strength","Strength","#34d399"],["okay","OK","#9c9cc0"],["weak","Weak","#f87171"]].map(([val,lbl,col]) => (
                        <button key={val} onClick={() => updateRating(i, s.key, val)} style={{
                          background: a.ratings[s.key] === val ? `${col}22` : "none",
                          border: `1px solid ${a.ratings[s.key] === val ? col : T.border2}`,
                          color: a.ratings[s.key] === val ? col : T.faint,
                          borderRadius: 6, padding: "3px 10px", fontSize: 11, cursor: "pointer",
                        }}>{lbl}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}

            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button onClick={() => setStep(1)} style={btnSecondary}>← Back</button>
              <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
                {saving ? "Creating team + generating plan…" : "Create team & generate plan"}
              </button>
            </div>

            {saveErr && (
              <div style={{ background: "#2a0a0a", border: "1px solid #f87171", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#f87171", marginTop: 12 }}>
                {saveErr}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
