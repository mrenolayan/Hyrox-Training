// ════════════════════════════════════════════════════════════════════════════
//  parseWorkoutDetail.js — splits a plan_entries.detail blob into a lead-in
//  label plus an ordered list of movement/note items. Pure function, no React,
//  no Supabase. See the algorithm write-up in the Phase 9 spec for the exact
//  step-by-step rules this implements, and the fixup notes below for three
//  corrections made against real hyroxdev data that the spec's fixtures
//  didn't cover.
// ════════════════════════════════════════════════════════════════════════════

const NOTES_LABEL_RE = /\bNOTES:\s*/i;
const SENTENCE_SPLIT_RE = /[.!?]\s+/g;
const BLANK_LINE_RE = /\n\s*\n+/;
// A ";" only counts as a movement separator when every one in the string is
// followed by a digit — real movements start with a count ("500m row",
// "20 burpees", "Back squat 4×6"), but coaches also write ";" as ordinary
// punctuation ("...on the runs; ease off if anything feels off" — real
// hyroxdev data, id 0485b186, which must stay prose, not split).
const BAD_SEMICOLON_RE = /;(?!\s*\d)/;
// How far into the first segment to look for a lead-in's terminating colon.
// "30:00 @ 7 RPE. Continuous:" is ~27 chars: some room past that, not so much
// that a colon deep inside a long first movement gets mistaken for a label.
const LEAD_IN_WINDOW = 40;

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

// A trailing note blob (the sentence peeled off the last movement, or the
// held-aside NOTES: text) can itself be more than one paragraph — real
// example: "...not fitness.  \n\n WOD: 3 Rounds - 20 Burpees, 30 squats,
// 400m run" (hyroxdev id bb1007ab). Blank lines (two-or-more newlines)
// start a new note item; a single newline is just a soft wrap within one
// paragraph and gets folded into a space.
function splitIntoNoteParagraphs(text) {
  if (!text) return [];
  return text
    .split(BLANK_LINE_RE)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function isSemicolonMovementList(body) {
  return body.includes(";") && !BAD_SEMICOLON_RE.test(body);
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

  // 3/4. Prose guard + choose separator. "·" wins if present (existing
  // behavior); ";" (digit-gated) and "\n" sit at the same plain-list tier —
  // real phone-typed workouts use bare newlines with no "·" at all (e.g.
  // "Deadlift 4x10\nDumb bell step up 4x10\nLunges - dumb bell lunges 6x40ft",
  // hyroxdev id b929a07d). "→" stays lowest priority and is the only one
  // that sets flow — unchanged from the original algorithm.
  const hasDot = body.includes("·");
  const hasSemi = isSemicolonMovementList(body);
  const hasNewline = body.includes("\n");
  const hasArrow = body.includes("→");
  if (!hasDot && !hasSemi && !hasNewline && !hasArrow) {
    return { leadIn: null, items: [{ type: "note", text: body }], flow: false };
  }

  let separator;
  let flow = false;
  if (hasDot) separator = "·";
  else if (hasSemi) separator = ";";
  else if (hasNewline) separator = "\n";
  else { separator = "→"; flow = true; }

  // 5. Split into segments.
  const segments = body.split(separator);

  // 6. First segment — optional lead-in label. Any colon within the first
  // ~40 chars ends a lead-in (not just a fixed keyword list — "Same circuit
  // at your pace: 500m row easy" has no recognized keyword immediately
  // before its colon, hyroxdev id f548826a). Take the LAST such colon so a
  // compound prefix like "30:00 @ 7 RPE. Continuous:" — which has an
  // earlier, unrelated colon inside "30:00" — still resolves to the whole
  // prefix, not just "30:".
  let leadIn = null;
  const firstRaw = segments[0];
  const window = firstRaw.slice(0, LEAD_IN_WINDOW);
  const colonIdx = window.lastIndexOf(":");
  let firstMovement;
  if (colonIdx !== -1) {
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

  // 8. Trailing note + the held-aside NOTES: text, each split into
  // paragraphs on blank lines (fixup #2).
  const notes = [...splitIntoNoteParagraphs(tailNote), ...splitIntoNoteParagraphs(notesAside)];

  // 9. Movements precede notes; empties already dropped.
  const items = [
    ...movements.map((text) => ({ type: "movement", text })),
    ...notes.map((text) => ({ type: "note", text })),
  ];

  return { leadIn, items, flow };
}
