import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as db from "../lib/db.js";
import { formatShortDate } from "../lib/weekView.js";
import WorkoutDetailList from "./WorkoutDetailList.jsx";
import DateField from "./DateField.jsx";

// Full-screen-ish workout view: opens when an athlete taps a day card. Shows
// the whole workout plus the logging controls, so there's no bouncing back
// to the small card mid-set. Writes go through db.js only (saveLog) — the
// same function the old inline card form used.
export default function WorkoutModal({
  entry, day, dateISO, detailText, metricLbl, st, log,
  athleteId, planId, canWrite, T, onClose, onSaved,
}) {
  const [metric, setMetric] = useState(log?.metric ?? "");
  const [notes, setNotes]   = useState(log?.notes ?? "");
  const [date, setDate]     = useState(log?.logged_date || dateISO);
  const [done, setDone]     = useState(log?.done ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);

  const panelRef = useRef(null);

  // Body scroll lock; restore both overflow and iOS scroll position on close.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const scrollY = window.scrollY;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
      window.scrollTo(0, scrollY);
    };
  }, []);

  // Focus the panel on open; return focus to whatever triggered the open
  // (the card button) on close.
  useEffect(() => {
    const prevActive = document.activeElement;
    panelRef.current?.focus();
    return () => { prevActive?.focus?.(); };
  }, []);

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSave() {
    setSaving(true); setError(null);
    try {
      const saved = await db.saveLog({
        athleteId, planId, planEntryId: entry.id,
        done, metric: metric || null, notes: notes || null, loggedDate: date,
      });
      onSaved(saved);
      onClose();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  const headerDate = `${day.day_of_week} · ${formatShortDate(dateISO)}`;

  return createPortal(
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, padding: 16,
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        style={{
          width: "min(680px, 94vw)", maxHeight: "92vh", overflowY: "auto",
          WebkitOverflowScrolling: "touch", borderRadius: 16,
          paddingBottom: "calc(16px + env(safe-area-inset-bottom))",
          background: T.bg, border: `1px solid ${T.border}`,
          outline: "none",
        }}
      >
        {/* header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
          padding: "16px 16px 0", gap: 10,
        }}>
          <div>
            <div style={{ fontSize: 12, color: T.faint, fontWeight: 700 }}>{headerDate}</div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6, marginTop: 6,
              background: `${st.color}22`, border: `1px solid ${st.color}50`,
              borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700, color: st.color,
            }}>
              <span>{st.icon}</span>
              <span>{st.label}</span>
            </div>
          </div>
          <button
            type="button" onClick={onClose} aria-label="Close"
            style={{
              minWidth: 44, minHeight: 44, background: "none", border: "none",
              color: T.faint, cursor: "pointer", fontSize: 24, lineHeight: 1, flexShrink: 0,
            }}
          >×</button>
        </div>

        {/* title */}
        <div style={{ padding: "8px 16px 0" }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: T.text }}>{entry.label}</h2>
        </div>

        {/* full workout, large type */}
        <div style={{ padding: "12px 16px 4px" }}>
          <WorkoutDetailList detail={detailText} coachNote={entry.coach_note} T={T} fontSize={15} />
        </div>

        {/* logging controls */}
        {canWrite && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "16px", marginTop: 8, borderTop: `1px solid ${T.border}` }}>
            {metricLbl && (
              <div>
                <label style={{ fontSize: 11, color: T.faint, textTransform: "uppercase", letterSpacing: "0.08em" }}>{metricLbl}</label>
                <input
                  value={metric} onChange={(e) => setMetric(e.target.value)}
                  placeholder={metricLbl}
                  style={{
                    display: "block", width: "100%", boxSizing: "border-box", marginTop: 5,
                    background: T.inset, border: `1px solid ${T.border2}`, borderRadius: 8,
                    padding: "10px 12px", color: T.text, fontSize: 14, fontFamily: "inherit",
                  }}
                />
              </div>
            )}

            <div>
              <label style={{ fontSize: 11, color: T.faint, textTransform: "uppercase", letterSpacing: "0.08em" }}>Notes</label>
              <textarea
                value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                placeholder="Notes (optional)"
                style={{
                  display: "block", width: "100%", boxSizing: "border-box", marginTop: 5,
                  background: T.inset, border: `1px solid ${T.border2}`, borderRadius: 8,
                  padding: "10px 12px", color: T.text, fontSize: 14, fontFamily: "inherit", resize: "vertical",
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, color: T.faint, textTransform: "uppercase", letterSpacing: "0.08em" }}>Logged date</label>
              <div style={{ marginTop: 5 }}>
                <DateField value={date} onChange={setDate} T={T} />
              </div>
            </div>

            <button
              type="button" onClick={() => setDone((d) => !d)}
              style={{
                display: "flex", alignItems: "center", gap: 10, background: "none",
                border: `1px solid ${T.border2}`, borderRadius: 8, padding: "10px 12px",
                cursor: "pointer", color: T.text, fontSize: 14, fontFamily: "inherit",
              }}
            >
              <span style={{
                width: 22, height: 22, borderRadius: 11, flexShrink: 0,
                background: done ? st.color : "transparent",
                border: `2px solid ${done ? st.color : T.border2}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#07070e", fontSize: 12, fontWeight: 900,
              }}>{done ? "✓" : ""}</span>
              Done
            </button>

            {error && <p style={{ color: "#f87171", fontSize: 13, margin: 0 }}>{error}</p>}

            <button
              type="button" onClick={handleSave} disabled={saving}
              style={{
                background: st.color, border: "none", color: "#07070e",
                borderRadius: 8, padding: "12px 20px", fontSize: 14, fontWeight: 700,
                cursor: "pointer", opacity: saving ? 0.6 : 1,
              }}
            >{saving ? "Saving…" : "Save"}</button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
