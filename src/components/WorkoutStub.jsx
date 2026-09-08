import { formatShortDateWithDay } from "../lib/weekView.js";

// Dimmed placeholder left on a workout's originally planned day when it was
// actually logged somewhere else. A div, not a button — not interactive at
// all; tapping it does nothing.
export default function WorkoutStub({ entry, log, T }) {
  return (
    <div style={{
      opacity: 0.6, cursor: "default",
      background: T.card, border: `1px solid ${T.border}`,
      borderRadius: 10, padding: "10px 12px",
      fontSize: 12, color: T.dim,
    }}>
      {entry.label} → logged {formatShortDateWithDay(log.logged_date)} ✓
    </div>
  );
}
