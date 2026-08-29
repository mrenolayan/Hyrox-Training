// ════════════════════════════════════════════════════════════════════════════
//  parseWorkoutDetail.js — splits a plan_entries.detail blob into a lead-in
//  label plus an ordered list of movement/note items. Pure function, no React,
//  no Supabase. See the algorithm write-up in the Phase 9 spec for the exact
//  step-by-step rules this implements.
// ════════════════════════════════════════════════════════════════════════════

const NOTES_LABEL_RE = /\bNOTES:\s*/i;
const LEAD_LABEL_RE = /(Circuit|Continuous|Complete|EMOM|AMRAP):/i;
const SENTENCE_SPLIT_RE = /[.!?]\s+/g;

// First terminator ('. ' / '! ' / '? ') whose preceding character is not a
// digit — guards against splitting inside "12.5m". Returns { head, tail }
// where tail is null when no such terminator exists.
function splitAtSentence(text) {
  SENTENCE_SPLIT_RE.lastIndex = 0;
  let m;
  while ((m = SENTENCE_SPLIT_RE.exec(text))) {
    const prevChar = text[m.index - 1];
    if (prevChar && /\d/.test(prevChar)) continue;
    return { head: text.slice(0, m.index).trim(), tail: text.slice(m.index + m[0].length).trim() };
  }
  return { head: text.trim(), tail: null };
}

export function parseWorkoutDetail(detail) {
  if (!detail || !detail.trim()) return { leadIn: null, items: [], flow: false };

  // 2. Case-insensitively split off NOTES: — held aside for step 8.
  let body = detail;
  let notesAside = null;
  const notesMatch = NOTES_LABEL_RE.exec(detail);
  if (notesMatch) {
    body = detail.slice(0, notesMatch.index);
    notesAside = detail.slice(notesMatch.index + notesMatch[0].length).trim();
  }
  body = body.trim();

  // 3. Prose guard.
  const hasDot = body.includes("·");
  const hasArrow = body.includes("→");
  if (!hasDot && !hasArrow) {
    return { leadIn: null, items: [{ type: "note", text: body }], flow: false };
  }

  // 4. Choose separator.
  const separator = hasDot ? "·" : "→";
  const flow = !hasDot && hasArrow;

  // 5. Split into segments.
  const segments = body.split(separator);

  // 6. First segment — optional lead-in label.
  let leadIn = null;
  const firstRaw = segments[0];
  const labelMatch = LEAD_LABEL_RE.exec(firstRaw);
  let firstMovement;
  if (labelMatch) {
    const colonIdx = labelMatch.index + labelMatch[0].length - 1;
    leadIn = firstRaw.slice(0, colonIdx + 1).trim();
    firstMovement = firstRaw.slice(colonIdx + 1).trim();
  } else {
    firstMovement = firstRaw.trim();
  }

  // 7. Last segment — trailing sentence peeled off as a note.
  const lastRaw = segments[segments.length - 1];
  const { head: lastMovement, tail: tailNote } = splitAtSentence(lastRaw);

  // Middle segments are plain movements.
  const middleMovements = segments.slice(1, -1).map((s) => s.trim());

  const movements = [firstMovement, ...middleMovements, lastMovement].filter(Boolean);

  // 8. Append the held-aside NOTES: text, if any.
  const notes = [tailNote, notesAside].filter(Boolean);

  // 9. Movements precede notes; empties already dropped.
  const items = [
    ...movements.map((text) => ({ type: "movement", text })),
    ...notes.map((text) => ({ type: "note", text })),
  ];

  return { leadIn, items, flow };
}
