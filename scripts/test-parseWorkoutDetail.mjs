// Plain assertion script — no test runner in package.json, run with:
//   node scripts/test-parseWorkoutDetail.mjs
import assert from "node:assert/strict";
import { parseWorkoutDetail } from "../src/lib/parseWorkoutDetail.js";

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`ok   - ${name}`);
  } catch (e) {
    console.error(`FAIL - ${name}`);
    console.error(e);
    process.exitCode = 1;
  }
}

check("strength A — 4 movements + 1 trailing note, no leadIn", () => {
  const r = parseWorkoutDetail(
    "Back squat 4×6 · RDL 3×8 · Walking lunges 3×20/leg · Goblet carries. This is your priority session every week from now on — strength is the gap, not fitness."
  );
  assert.equal(r.leadIn, null);
  assert.equal(r.flow, false);
  assert.equal(r.items.length, 5);
  assert.deepEqual(r.items.map((i) => i.type), ["movement", "movement", "movement", "movement", "note"]);
  assert.equal(r.items[3].text, "Goblet carries");
  assert.equal(r.items[4].text, "This is your priority session every week from now on — strength is the gap, not fitness.");
});

check("prose guard — easy run passes through as a single note", () => {
  const r = parseWorkoutDetail("At 6:15–6:30/km, Zone 2, conversational. This is your race pace — own it.");
  assert.equal(r.leadIn, null);
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].type, "note");
  assert.equal(r.items[0].text, "At 6:15–6:30/km, Zone 2, conversational. This is your race pace — own it.");
});

check("station circuit — arrow flow, digit-guarded sentence split, leadIn", () => {
  const r = parseWorkoutDetail(
    "Circuit: 500m row → 500m ski → 30 WB → 20 BBJ → 40m farmers → sled push 12.5m. You lead WB, BBJ and machines. Log your split."
  );
  assert.equal(r.leadIn, "Circuit:");
  assert.equal(r.flow, true);
  assert.equal(r.items.length, 7);
  const movements = r.items.filter((i) => i.type === "movement");
  assert.equal(movements.length, 6);
  assert.equal(movements[5].text, "sled push 12.5m");
  const notes = r.items.filter((i) => i.type === "note");
  assert.equal(notes.length, 1);
  assert.equal(notes[0].text, "You lead WB, BBJ and machines. Log your split.");
});

check("continuous AMRAP — leadIn absorbs duration prefix, two ordered notes", () => {
  const r = parseWorkoutDetail(
    "30:00 @ 7 RPE. Continuous: 400m run · 20 walking lunges · 20 air squats · 10 jumping lunges · 10 jumping air squats. Repeat for 30 min. NOTES: Keep continuously moving even as muscular fatigue builds… Optional."
  );
  assert.equal(r.leadIn, "30:00 @ 7 RPE. Continuous:");
  assert.equal(r.flow, false);
  const movements = r.items.filter((i) => i.type === "movement");
  assert.equal(movements.length, 5);
  const notes = r.items.filter((i) => i.type === "note");
  assert.equal(notes.length, 2);
  assert.equal(notes[0].text, "Repeat for 30 min.");
  assert.equal(notes[1].text, "Keep continuously moving even as muscular fatigue builds… Optional.");
});

check("rest day prose passthrough", () => {
  const r = parseWorkoutDetail("Recovery. Light stretch or walk if you feel like moving.");
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].type, "note");
  assert.equal(r.items[0].text, "Recovery. Light stretch or walk if you feel like moving.");
});

check("null/empty/whitespace input", () => {
  for (const v of [null, undefined, "", "   "]) {
    const r = parseWorkoutDetail(v);
    assert.equal(r.leadIn, null);
    assert.deepEqual(r.items, []);
    assert.equal(r.flow, false);
  }
});

// ── Fixup #1: lead-in colon isn't a fixed keyword list ──────────────────────
// Real string, hyroxdev id f548826a-bc93-4332-a1c8-0fee863069bd (Andrew,
// week 3 Thu). "Same circuit" isn't in any keyword list — the old
// LEAD_LABEL_RE missed it and the whole preamble fell into movement 1.
check("real: 'Same circuit at your pace:' leadIn with no recognized keyword", () => {
  const r = parseWorkoutDetail(
    "Same circuit at your pace: 500m row easy → 30 wall balls (6kg, break as needed) → sled push 4×12.5m light → 500m ski. One station at a time — build competence everywhere."
  );
  assert.equal(r.leadIn, "Same circuit at your pace:");
  assert.equal(r.flow, true);
  const movements = r.items.filter((i) => i.type === "movement").map((i) => i.text);
  assert.deepEqual(movements, [
    "500m row easy",
    "30 wall balls (6kg, break as needed)",
    "sled push 4×12.5m light",
    "500m ski",
  ]);
  const notes = r.items.filter((i) => i.type === "note");
  assert.equal(notes.length, 1);
  assert.equal(notes[0].text, "One station at a time — build competence everywhere.");
});

// ── Fixup #2: trailing note paragraphs ───────────────────────────────────────
// Real string, hyroxdev id bb1007ab-ff49-4c7e-b528-e94e86b87e0a (Andrew,
// week 3 Mon) — verbatim, including the double space and blank line before
// "WOD:". Previously the coaching sentence and the WOD block collapsed into
// one run-on note.
check("real: coaching sentence + blank-line-separated WOD block are two notes", () => {
  const r = parseWorkoutDetail(
    "Back squat 4×6 · RDL 3×8 · Walking lunges 3×20/leg · Goblet carries. This is your priority session every week from now on — strength is the gap, not fitness.  \n\n WOD: 3 Rounds - 20 Burpees, 30 squats, 400m run"
  );
  assert.equal(r.leadIn, null);
  const movements = r.items.filter((i) => i.type === "movement").map((i) => i.text);
  assert.deepEqual(movements, ["Back squat 4×6", "RDL 3×8", "Walking lunges 3×20/leg", "Goblet carries"]);
  const notes = r.items.filter((i) => i.type === "note").map((i) => i.text);
  assert.deepEqual(notes, [
    "This is your priority session every week from now on — strength is the gap, not fitness.",
    "WOD: 3 Rounds - 20 Burpees, 30 squats, 400m run",
  ]);
});

// A single newline (no blank line) is a soft wrap within one paragraph, not
// a paragraph break — folds to a space, stays one note. Real string,
// hyroxdev id c805ff97-6db1-407a-b606-60c51e5161d6 (Hung, week 3 Mon).
check("real: single-newline WOD tail stays one note (no blank line)", () => {
  const r = parseWorkoutDetail(
    "Back squat 4×6 · RDL 3×8 · Walking lunges 3×20/leg · Farmers carry 3×100m (your station — own the grip). Keep loads honest, not maximal yet.\nWOD: 3 Rounds - 20 Burpees, 30 squats, 400m run"
  );
  const notes = r.items.filter((i) => i.type === "note").map((i) => i.text);
  assert.deepEqual(notes, ["Keep loads honest, not maximal yet. WOD: 3 Rounds - 20 Burpees, 30 squats, 400m run"]);
});

// ── Fixup #3: "·"/";"/"\n" all count as plain-list separators ──────────────
// Real string, hyroxdev id b929a07d-b167-444a-913a-8abee0a60537 (Hung, week 1
// Wed) — no "·" or "→" anywhere, just bare newlines. Under the old rule this
// hit the prose guard and rendered as one paragraph instead of a 3-item list.
check("real: bare-newline movement list (no · or → at all)", () => {
  const r = parseWorkoutDetail("Deadlift 4x10\nDumb bell step up 4x10\nLunges - dumb bell lunges 6x40ft");
  assert.equal(r.leadIn, null);
  assert.equal(r.flow, false);
  const movements = r.items.filter((i) => i.type === "movement").map((i) => i.text);
  assert.deepEqual(movements, ["Deadlift 4x10", "Dumb bell step up 4x10", "Lunges - dumb bell lunges 6x40ft"]);
  assert.equal(r.items.filter((i) => i.type === "note").length, 0);
});

// Real negative case that motivated gating ";" on digit-follows, hyroxdev id
// 0485b186-e85b-43cc-8182-67462df8943c (Samantha/Walker DC, week 12 Mon) —
// a real coaching sentence using ";" as ordinary punctuation. A blanket
// ";"-as-separator would wrongly split this into two "movements".
check("real: prose semicolon ('...runs; ease off...') is NOT a separator", () => {
  const r = parseWorkoutDetail(
    "3×(500m @ race pace + 15 wall balls), full recovery between rounds. Last dedicated wall-ball-under-fatigue rep before taper gets strict — 7 days out, still enough runway to matter. Watch the ankle on the runs; ease off if anything feels off. ~25 min."
  );
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].type, "note");
  assert.equal(
    r.items[0].text,
    "3×(500m @ race pace + 15 wall balls), full recovery between rounds. Last dedicated wall-ball-under-fatigue rep before taper gets strict — 7 days out, still enough runway to matter. Watch the ankle on the runs; ease off if anything feels off. ~25 min."
  );
});

// Synthetic (no matching real row found yet) — every ";" here IS followed by
// a digit, the pattern a phone-typed exercise list actually produces.
check("synthetic: digit-gated semicolon list splits correctly", () => {
  const r = parseWorkoutDetail("20 burpees; 30 squats; 400m run");
  assert.equal(r.leadIn, null);
  assert.equal(r.flow, false);
  const movements = r.items.filter((i) => i.type === "movement").map((i) => i.text);
  assert.deepEqual(movements, ["20 burpees", "30 squats", "400m run"]);
  assert.equal(r.items.filter((i) => i.type === "note").length, 0);
});

console.log(`\n${passed} passed`);
if (process.exitCode) process.exit(process.exitCode);
