// Plain assertion script — no test runner in package.json, run with:
//   node scripts/test-parseWorkoutDetail.mjs
import assert from "node:assert/strict";
import { classify, classifyHead, parseWorkoutDetail } from "../src/lib/parseWorkoutDetail.js";

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

// ── Superseded by the per-segment classifier below ──────────────────────────
// These two used to assert that a WOD block appended after "·"-separated
// movements collapsed into a note (or two). That was itself a bug: a WOD
// block is a workout, not a coaching note. Newlines are now a hard segment
// boundary same as "·" (never one picked separator — see classifier fixture
// below), and each resulting segment is classified by content, so the WOD
// line now correctly comes back as a movement, in source order after the
// note that precedes it.

// ── classify() — the 4 rules given directly, as fragments ───────────────────
check("classify: short digit-free phrase is a movement (word count under 5)", () => {
  assert.equal(classify("Goblet carries"), "movement");
});
check("classify: digit-free 5+-word phrase with no terminal punctuation is a note", () => {
  assert.equal(classify("Keep the last set heavy"), "note");
});
check("classify: digits win even with punctuation/word count that reads note-ish", () => {
  assert.equal(classify("WOD: 3 Rounds - 20 Burpees, 30 squats, 400m run"), "movement");
});
check("classify: terminal period makes it a note", () => {
  assert.equal(classify("This is your priority session every week from now on — strength is the gap, not fitness."), "note");
});
check("classify: bare trailing period on a digit-bearing tail is still a note", () => {
  // classify() is used on splitAtSentence's tail — genuinely peeled prose.
  // A real hyroxdev tail contains digits and is still clearly a note:
  // "Race is 10 days out now, not 6 — a little more room to groove wall
  // balls under mild fatigue before the taper gets strict." (id omitted,
  // Walker DC). The terminator rule must win here even though a digit is
  // present, unlike classifyHead below.
  assert.equal(classify("Race is 10 days out now, not 6 — still enough runway to matter."), "note");
});
check("classifyHead: whole-segment head keeps its own trailing period without becoming a note", () => {
  // classifyHead is used on splitAtSentence's head — including the "no
  // split found" case, where head is the WHOLE segment, trailing period
  // included, because it happened to be the last thing in the detail
  // string. "Calf raises 3×15." (hyroxdev id 573b430e) and "Dead bug
  // 3×10/side." (also real hyroxdev data) are movements, not notes, even
  // though every sentence in English ends in punctuation. This is the fix
  // for a regression that misclassified 71 of 380 real rows' final
  // "·"-list item.
  assert.equal(classifyHead("Calf raises 3×15."), "movement");
  assert.equal(classifyHead("Dead bug 3×10/side."), "movement");
  assert.equal(classifyHead("Hollow hold 3×25s."), "movement");
});

// ── Fixup #2 (per-segment classification) — the five real rows that mix "·"
// and newline (grepped: every row in hyroxdev where detail includes both),
// which previously glued whatever came after the first-picked separator
// into one segment/note. All five ids: 3a92b770, bb1007ab, c805ff97,
// a37aeb53, 573b430e.
check("real 3a92b770: prefix line before an AMRAP splits into its own movement", () => {
  const r = parseWorkoutDetail(
    "3x10 Strict Press, rest then…\nAMRAP 16:00: 200m run · 12 air squats · 10 walking lunges · 8 burpees. Steady rounds. NOTES: Easy intro conditioning — smooth and controlled, not a sprint. Optional."
  );
  assert.equal(r.leadIn, null);
  assert.deepEqual(r.items.map((i) => [i.type, i.text]), [
    ["movement", "3x10 Strict Press, rest then…"],
    ["movement", "AMRAP 16:00: 200m run"],
    ["movement", "12 air squats"],
    ["movement", "10 walking lunges"],
    ["movement", "8 burpees"],
    ["note", "Steady rounds."],
    ["note", "Easy intro conditioning — smooth and controlled, not a sprint. Optional."],
  ]);
});

check("real bb1007ab: WOD after a blank line is a movement, not a note, in source order", () => {
  const r = parseWorkoutDetail(
    "Back squat 4×6 · RDL 3×8 · Walking lunges 3×20/leg · Goblet carries. This is your priority session every week from now on — strength is the gap, not fitness.  \n\n WOD: 3 Rounds - 20 Burpees, 30 squats, 400m run"
  );
  assert.equal(r.leadIn, null);
  assert.deepEqual(r.items.map((i) => [i.type, i.text]), [
    ["movement", "Back squat 4×6"],
    ["movement", "RDL 3×8"],
    ["movement", "Walking lunges 3×20/leg"],
    ["movement", "Goblet carries"],
    ["note", "This is your priority session every week from now on — strength is the gap, not fitness."],
    ["movement", "WOD: 3 Rounds - 20 Burpees, 30 squats, 400m run"],
  ]);
});

check("real c805ff97: single-newline WOD is also its own movement, not folded into the note", () => {
  const r = parseWorkoutDetail(
    "Back squat 4×6 · RDL 3×8 · Walking lunges 3×20/leg · Farmers carry 3×100m (your station — own the grip). Keep loads honest, not maximal yet.\nWOD: 3 Rounds - 20 Burpees, 30 squats, 400m run"
  );
  const tail = r.items.slice(-2).map((i) => [i.type, i.text]);
  assert.deepEqual(tail, [
    ["note", "Keep loads honest, not maximal yet."],
    ["movement", "WOD: 3 Rounds - 20 Burpees, 30 squats, 400m run"],
  ]);
});

check("real a37aeb53: prefix line before an AMRAP, mid-string note, trailing note — all correctly typed", () => {
  const r = parseWorkoutDetail(
    "AMRAP 16:00: 200m run · 10 air squats · 8 burpees. Log your rounds. Moderate intensity on this one. Should go hard but not die\n\nPost workout run immediately after. \n\n"
  );
  assert.equal(r.leadIn, "AMRAP 16:00:");
  assert.deepEqual(r.items.map((i) => [i.type, i.text]), [
    ["movement", "200m run"],
    ["movement", "10 air squats"],
    ["movement", "8 burpees"],
    ["note", "Log your rounds. Moderate intensity on this one. Should go hard but not die"],
    ["note", "Post workout run immediately after."],
  ]);
});

check("real 573b430e: the last remaining pre-existing bug is now fixed — nothing rides along unclassified", () => {
  const r = parseWorkoutDetail(
    "Gym. Back squat 4×6 · RDL 3×8 · Walking lunges 3×20/leg · Kettlebell carry 3×100m · Calf raises 3×15.\n\nDid this instead: 3x100 jump ropes, 3x500 skierg, 3x30 dumbbell thrust to shoulder press"
  );
  assert.equal(r.leadIn, null);
  assert.equal(r.items.filter((i) => i.type === "note").length, 0);
  assert.deepEqual(r.items.map((i) => i.text), [
    "Gym",
    "Back squat 4×6",
    "RDL 3×8",
    "Walking lunges 3×20/leg",
    "Kettlebell carry 3×100m",
    "Calf raises 3×15.",
    "Did this instead: 3x100 jump ropes, 3x500 skierg, 3x30 dumbbell thrust to shoulder press",
  ]);
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
