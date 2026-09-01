// ════════════════════════════════════════════════════════════════════════════
//  parseWorkoutDetail.js — splits plan_entries.detail into a lead-in label
//  plus an ordered list of movement/note items.
//
//  Two formats, selected by whether the row has a coach_note (nullable
//  plan_entries column):
//   - coach_note set  -> "new" format. Every segment in detail is a
//     movement — no sentence classification, no abbreviation/paren guards.
//     Coaching commentary belongs in coach_note; this module doesn't read
//     its text, only whether it's present. The caller renders it separately.
//   - coach_note null/absent -> "legacy" format: the frozen pre-migration
//     algorithm (commit 97c6aa0) — split into segments, only the LAST
//     segment gets one trailing sentence peeled off as a note. Do not
//     extend this path; new capability goes in the new format instead.
//
//  Both formats share the prose guard (no recognized separator -> one
//  prose paragraph, unchanged either way) and the combined ·/;/\n
//  separator split (never a single picked winner, so a body that mixes
//  them — five real hyroxdev rows do — doesn't glue the back half onto one
//  segment). "→" is the exception: only used when none of those three are
//  present, and the only one that sets flow: true.
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
// How far into the first segment to look for a legacy lead-in's terminating
// colon. "30:00 @ 7 RPE. Continuous:" is ~27 chars: some room past that,
// not so much that a colon deep inside a long first movement gets mistaken
// for a label.
const LEAD_IN_WINDOW = 40;

function isSemicolonMovementList(body) {
  return body.includes(";") && !BAD_SEMICOLON_RE.test(body);
}

function hasAnySeparator(text) {
  return text.includes("·") || isSemicolonMovementList(text) || text.includes("\n") || text.includes("→");
}

// Splits `text` on whichever separator(s) apply, per the shared rule above.
// Always returns at least one segment — callers that already confirmed
// hasAnySeparator() on a larger enclosing string may still call this on a
// substring (e.g. new format's text after the lead-in line is removed)
// that itself has no further separator; that's a valid one-segment result,
// not a prose case.
function splitSegments(text) {
  const hasDot = text.includes("·");
  const hasSemi = isSemicolonMovementList(text);
  const hasNewline = text.includes("\n");
  const hasArrow = text.includes("→");
  if (hasDot || hasSemi || hasNewline) {
    const parts = ["·"];
    if (hasSemi) parts.push(";");
    parts.push("\\n+");
    return { segments: text.split(new RegExp(parts.join("|"))), flow: false };
  }
  if (hasArrow) return { segments: text.split("→"), flow: true };
  return { segments: [text], flow: false };
}

// ── legacy format (coach_note null) — frozen, do not extend ────────────────

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
// held-aside NOTES: text) can itself be more than one paragraph. Blank
// lines (two-or-more newlines) start a new note item; a single newline is
// just a soft wrap within one paragraph and gets folded into a space.
function splitIntoNoteParagraphs(text) {
  if (!text) return [];
  return text
    .split(BLANK_LINE_RE)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function parseLegacy(detail) {
  let body = detail;
  let notesAside = null;
  const notesMatch = NOTES_LABEL_RE.exec(detail);
  if (notesMatch) {
    body = detail.slice(0, notesMatch.index);
    notesAside = detail.slice(notesMatch.index + notesMatch[0].length).trim();
  }
  body = body.trim();

  if (!hasAnySeparator(body)) {
    return { leadIn: null, items: [{ type: "note", text: body }], flow: false };
  }

  // Legacy format uses true 97c6aa0 single-winner separator selection:
  // · wins if present, else digit-gated ;, else \n, else → (sets flow).
  const hasDot = body.includes("·");
  const hasSemi = isSemicolonMovementList(body);
  const hasNewline = body.includes("\n");
  const hasArrow = body.includes("→");

  let separator;
  let flow = false;
  if (hasDot) separator = "·";
  else if (hasSemi) separator = ";";
  else if (hasNewline) separator = "\n";
  else {
    separator = "→";
    flow = true;
  }

  const segments = body.split(separator);

  // Original colon-window lead-in: any colon within the first ~40 chars of
  // segment 0 ends a lead-in. Take the LAST such colon so a compound prefix
  // like "30:00 @ 7 RPE. Continuous:" — which has an earlier, unrelated
  // colon inside "30:00" — still resolves to the whole prefix, not "30:".
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

  const lastRaw = segments[segments.length - 1];
  const { head: lastMovement, tail: tailNote } = splitAtSentence(lastRaw);
  const middleMovements = segments.slice(1, -1).map((s) => s.trim());
  const movements = [firstMovement, ...middleMovements, lastMovement].filter(Boolean);
  const notes = [...splitIntoNoteParagraphs(tailNote), ...splitIntoNoteParagraphs(notesAside)];

  const items = [
    ...movements.map((text) => ({ type: "movement", text })),
    ...notes.map((text) => ({ type: "note", text })),
  ];
  return { leadIn, items, flow };
}

// ── new format (coach_note set) ─────────────────────────────────────────────

function parseNewFormat(detail) {
  const body = detail.trim();

  if (!hasAnySeparator(body)) {
    return { leadIn: null, items: [{ type: "note", text: body }], flow: false };
  }

  // Session label, the only inference left in this path: if the first line
  // of the text ends in a colon, it's the lead-in — typed deliberately by
  // whoever wrote the detail, not inferred from content.
  const nlIdx = body.indexOf("\n");
  const firstLine = (nlIdx === -1 ? body : body.slice(0, nlIdx)).trim();
  let leadIn = null;
  let rest = body;
  if (firstLine.endsWith(":")) {
    leadIn = firstLine;
    rest = nlIdx === -1 ? "" : body.slice(nlIdx + 1);
  }

  const { segments, flow } = splitSegments(rest);
  const items = segments
    .map((s) => s.trim())
    .filter(Boolean)
    .map((text) => ({ type: "movement", text }));

  return { leadIn, items, flow };
}

// ── entry point ──────────────────────────────────────────────────────────────

export function parseWorkoutDetail(detail, coachNote) {
  if (!detail || !detail.trim()) return { leadIn: null, items: [], flow: false };
  return coachNote != null ? parseNewFormat(detail) : parseLegacy(detail);
}
