import { parseWorkoutDetail } from "../lib/parseWorkoutDetail.js";

// Renders plan_entries.detail as a lead-in label + one ordered/unordered list
// of movements with a trailing dimmed coaching note, per parseWorkoutDetail.
// Falls back to a plain paragraph for prose (rest days, easy-run descriptions)
// — visually identical to how detail rendered before Step 1.
export default function WorkoutDetailList({ detail, coachNote, T, fontSize = 11.5 }) {
  if (!detail) return null;
  const { leadIn, items, flow } = parseWorkoutDetail(detail, coachNote);

  if (items.length === 0) return null;

  if (items.length === 1 && items[0].type === "note") {
    return (
      <div style={{ fontSize, color: T.body, marginTop: 3, lineHeight: 1.5 }}>
        {items[0].text}
      </div>
    );
  }

  const ListTag = flow ? "ol" : "ul";
  let moveCount = 0;

  return (
    <div style={{ marginTop: 3 }}>
      {leadIn && (
        <div style={{
          fontSize: fontSize - 1, color: T.faint, fontWeight: 700,
          marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.04em",
        }}>{leadIn}</div>
      )}
      <ListTag style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {items.map((item, i) => {
          if (item.type === "movement") {
            moveCount++;
            const marker = flow ? `${moveCount}.` : "·";
            return (
              <li key={i} style={{
                display: "flex", gap: 6, lineHeight: 1.5, fontSize, color: T.body,
                marginTop: i === 0 ? 0 : 2,
              }}>
                <span style={{ flexShrink: 0, color: T.faint }}>{marker}</span>
                <span>{item.text}</span>
              </li>
            );
          }
          return (
            <li key={i} style={{
              fontStyle: "italic", opacity: 0.7, marginTop: 6, fontSize, color: T.body, lineHeight: 1.5,
            }}>{item.text}</li>
          );
        })}
      </ListTag>
      {coachNote && (
        <div style={{
          fontStyle: "italic", opacity: 0.65, marginTop: 6, fontSize, color: T.body, lineHeight: 1.5,
        }}>
          {coachNote}
        </div>
      )}
    </div>
  );
}
