// ════════════════════════════════════════════════════════════════════════════
//  parseWorkoutDetail.js — splits a plan_entries.detail blob into a lead-in
//  label plus an ordered list of movement/note items. Pure function, no React,
//  no Supabase.
//
//  Every recognized separator (·, digit-gated ;, and any run of newlines)
//  splits in ONE combined pass — mixing them in the same string (five real
//  hyroxdev rows do, e.g. "·" for the main list then "\n\n" for an appended
//  WOD block) used to glue whatever came after the first-picked separator
//  into one segment. "→" is the exception: it keeps its own exclusive
//  behavior and is the only separator that sets flow: true.
//
//  Each resulting segment is classified independently by content — not by
//  position. There is no more "last segment is the note slot": a coaching
//  line can be followed by another movement (a WOD appended after a
//  sentence, a rest note wedged mid-list), and items preserve that source
//  order.
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
// where tail is null when no such terminator exists. Used to peel prose
// that's glued onto a movement within one segment, e.g. "500m ski. One
// station at a time…" — head is still run through classify(), same as any
// other piece of text, so a false split (a location tag like "Gym." ahead
// of a real movement) just yields two short movement items rather than
// mislabeling the second half as a note.
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

// Held-aside NOTES: text can itself be more than one paragraph. Blank lines
// (two-or-more newlines) start a new note item; a single newline is a soft
// wrap within one paragraph and folds to a space. (Segment-level splitting
// no longer needs this — every newline is already a hard segment boundary —
// but the NOTES: marker is an explicit "this is a note" signal from the
// coach, so its content stays note-only rather than being reclassified.)
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

// A note if it ends in a terminal '.', '!', or '?' (a finished sentence —
// covers "This is your priority session…not fitness."), OR if it has no
// digit and reads as 5+ words of prose (covers "Keep the last set heavy",
// which trails off with no terminal punctuation). Otherwise a movement —
// including anything with a digit in it regardless of length or phrasing
// ("WOD: 3 Rounds - 20 Burpees, 30 squats, 400m run" has commas and a colon
// but is clearly a workout, not a coaching note).
//
// Used on splitAtSentence's tail — genuinely peeled prose that continued
// past a real sentence break, e.g. "Race is 10 days out now, not 6 — a
// little more room to groove wall balls..." (real hyroxdev tail, contains
// digits but is clearly a coaching note, not a rep count). The terminator
// check is meaningful here because a tail's own ending really did end a
// sentence.
export function classify(text) {
  if (/[.!?]$/.test(text)) return "note";
  if (!/\d/.test(text)) {
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    if (wordCount >= 5) return "note";
  }
  return "movement";
}

// Used on splitAtSentence's head. A head from a genuine split never itself
// ends in '.'/'!'/'?' — that character IS the split point, excluded by
// construction — so the terminator rule never fires here anyway. It matters
// for the OTHER case this is used in: when splitAtSentence found no split
// point at all (tail === null) and "head" is the whole segment, trailing
// punctuation included. There, a terminal period is just the sentence
// ending because this happened to be the last thing in the detail string —
// "Dead bug 3×10/side." and "Calf raises 3×15." are movements, not notes,
// even though (like every other sentence in English) they end in a period.
// Real regression this fixes: applying classify()'s terminator rule to
// heads misclassified 71 of 380 real hyroxdev rows' final "·"-list item as
// a note, purely because the whole detail string ends with a period.
export function classifyHead(text) {
  if (!/\d/.test(text)) {
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    if (wordCount >= 5) return "note";
  }
  return "movement";
}

function classifySegment(text) {
  const items = [];
  const { head, tail } = splitAtSentence(text);
  if (head) items.push({ type: classifyHead(head), text: head });
  if (tail) items.push({ type: classify(tail), text: tail });
  return items;
}

export function parseWorkoutDetail(detail) {
  if (!detail || !detail.trim()) return { leadIn: null, items: [], flow: false };

  // Case-insensitively split off NOTES: — held aside, appended at the end
  // (it's already positioned last in the source text by construction).
  let body = detail;
  let notesAside = null;
  const notesMatch = NOTES_LABEL_RE.exec(detail);
  if (notesMatch) {
    body = detail.slice(0, notesMatch.index);
    notesAside = detail.slice(notesMatch.index + notesMatch[0].length).trim();
  }
  body = body.trim();

  // Prose guard: nothing recognized as a separator at all.
  const hasDot = body.includes("·");
  const hasSemi = isSemicolonMovementList(body);
  const hasNewline = body.includes("\n");
  const hasArrow = body.includes("→");
  if (!hasDot && !hasSemi && !hasNewline && !hasArrow) {
    return { leadIn: null, items: [{ type: "note", text: body }], flow: false };
  }

  // "·"/";"(digit-gated)/"\n" all split in one combined pass — never pick a
  // single winner, so a string that mixes them (e.g. "·" for the main list,
  // "\n\n" for an appended WOD) doesn't glue the back half onto one segment.
  // "→" only comes into play when none of those three are present, and is
  // the only case that sets flow: true.
  let segments;
  let flow = false;
  if (hasDot || hasSemi || hasNewline) {
    const parts = ["·"];
    if (hasSemi) parts.push(";");
    parts.push("\\n+");
    segments = body.split(new RegExp(parts.join("|")));
  } else {
    segments = body.split("→");
    flow = true;
  }

  // First segment — optional lead-in label. Any colon within the first
  // ~40 chars ends a lead-in (not a fixed keyword list — "Same circuit at
  // your pace: 500m row easy" has no recognized keyword immediately before
  // its colon, hyroxdev id f548826a). Take the LAST such colon so a
  // compound prefix like "30:00 @ 7 RPE. Continuous:" — which has an
  // earlier, unrelated colon inside "30:00" — still resolves to the whole
  // prefix, not just "30:".
  let leadIn = null;
  if (segments.length) {
    const firstRaw = segments[0];
    const window = firstRaw.slice(0, LEAD_IN_WINDOW);
    const colonIdx = window.lastIndexOf(":");
    if (colonIdx !== -1) {
      leadIn = firstRaw.slice(0, colonIdx + 1).trim();
      segments[0] = firstRaw.slice(colonIdx + 1);
    }
  }

  // Classify every segment independently, in source order.
  const items = [];
  for (const seg of segments) {
    const trimmed = seg.trim();
    if (!trimmed) continue;
    items.push(...classifySegment(trimmed));
  }

  // NOTES: text is always note(s), appended last.
  for (const para of splitIntoNoteParagraphs(notesAside)) {
    items.push({ type: "note", text: para });
  }

  return { leadIn, items, flow };
}
