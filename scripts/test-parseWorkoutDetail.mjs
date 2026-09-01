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

// ── legacy format (coach_note null/omitted) — frozen algorithm ─────────────

check("legacy: strength A — 4 movements + 1 trailing note, no leadIn", () => {
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

check("legacy: prose guard — easy run passes through as a single note", () => {
  const r = parseWorkoutDetail("At 6:15–6:30/km, Zone 2, conversational. This is your race pace — own it.");
  assert.equal(r.leadIn, null);
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].type, "note");
  assert.equal(r.items[0].text, "At 6:15–6:30/km, Zone 2, conversational. This is your race pace — own it.");
});

check("legacy: station circuit — arrow flow, digit-guarded sentence split, colon-window leadIn", () => {
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

check("legacy: continuous AMRAP — leadIn absorbs duration prefix, two ordered notes", () => {
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

check("legacy: 'Same circuit at your pace:' leadIn with no recognized keyword", () => {
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

check("legacy: rest day prose passthrough", () => {
  const r = parseWorkoutDetail("Recovery. Light stretch or walk if you feel like moving.");
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].type, "note");
  assert.equal(r.items[0].text, "Recovery. Light stretch or walk if you feel like moving.");
});

check("legacy: coaching sentence + blank-line-separated WOD block are one run-on note (frozen behavior)", () => {
  // This is the exact case Commit A "fixed" by making the WOD line a
  // movement. That fix is reverted for legacy — coach_note is now how a
  // WOD block gets typed as real movements instead.
  const r = parseWorkoutDetail(
    "Back squat 4×6 · RDL 3×8 · Walking lunges 3×20/leg · Goblet carries. This is your priority session every week from now on — strength is the gap, not fitness.  \n\n WOD: 3 Rounds - 20 Burpees, 30 squats, 400m run"
  );
  const notes = r.items.filter((i) => i.type === "note").map((i) => i.text);
  assert.deepEqual(notes, [
    "This is your priority session every week from now on — strength is the gap, not fitness.",
    "WOD: 3 Rounds - 20 Burpees, 30 squats, 400m run",
  ]);
});

check("legacy: bare-newline movement list (no · or → at all) — combined-separator fix kept from Commit A", () => {
  const r = parseWorkoutDetail("Deadlift 4x10\nDumb bell step up 4x10\nLunges - dumb bell lunges 6x40ft");
  assert.equal(r.leadIn, null);
  assert.equal(r.flow, false);
  const movements = r.items.filter((i) => i.type === "movement").map((i) => i.text);
  assert.deepEqual(movements, ["Deadlift 4x10", "Dumb bell step up 4x10", "Lunges - dumb bell lunges 6x40ft"]);
  assert.equal(r.items.filter((i) => i.type === "note").length, 0);
});

check("legacy: prose semicolon ('...runs; ease off...') is NOT a separator", () => {
  const r = parseWorkoutDetail(
    "3×(500m @ race pace + 15 wall balls), full recovery between rounds. Last dedicated wall-ball-under-fatigue rep before taper gets strict — 7 days out, still enough runway to matter. Watch the ankle on the runs; ease off if anything feels off. ~25 min."
  );
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].type, "note");
});

check("legacy: digit-gated semicolon list splits correctly (synthetic)", () => {
  const r = parseWorkoutDetail("20 burpees; 30 squats; 400m run");
  assert.equal(r.leadIn, null);
  assert.equal(r.flow, false);
  const movements = r.items.filter((i) => i.type === "movement").map((i) => i.text);
  assert.deepEqual(movements, ["20 burpees", "30 squats", "400m run"]);
});

check("legacy: null/empty/whitespace input", () => {
  for (const v of [null, undefined, "", "   "]) {
    const r = parseWorkoutDetail(v);
    assert.equal(r.leadIn, null);
    assert.deepEqual(r.items, []);
    assert.equal(r.flow, false);
  }
});

// ── new format (coach_note set) ─────────────────────────────────────────────

check("new: every segment is a movement, no classification at all", () => {
  const r = parseWorkoutDetail(
    "Back squat 4×6 · RDL 3×8 · Walking lunges 3×20/leg · Goblet carries. This is your priority session every week from now on — strength is the gap, not fitness.",
    "Priority lift — don't skip for a run."
  );
  assert.equal(r.leadIn, null);
  assert.equal(r.flow, false);
  // Under legacy this exact string produces 4 movements + 1 note. Under
  // new format there is no note slot at all — the sentence after "Goblet
  // carries." is just one more movement segment, verbatim.
  assert.deepEqual(r.items.map((i) => i.type), ["movement", "movement", "movement", "movement"]);
  assert.equal(
    r.items[3].text,
    "Goblet carries. This is your priority session every week from now on — strength is the gap, not fitness."
  );
});

check("new: session label — first line ending in a colon is the leadIn, nothing else is inferred", () => {
  const r = parseWorkoutDetail("Circuit:\n500m row\n30 wall balls\nsled push 12.5m", "Log every split.");
  assert.equal(r.leadIn, "Circuit:");
  assert.equal(r.flow, false);
  assert.deepEqual(r.items.map((i) => i.text), ["500m row", "30 wall balls", "sled push 12.5m"]);
  assert.ok(r.items.every((i) => i.type === "movement"));
});

check("new: a colon mid-line (not ending the first line) is NOT a leadIn — 'I control it by typing the colon'", () => {
  const r = parseWorkoutDetail("Circuit: 500m row\n30 wall balls", "note");
  assert.equal(r.leadIn, null);
  assert.deepEqual(r.items.map((i) => i.text), ["Circuit: 500m row", "30 wall balls"]);
});

check("new: combined ·/;/\\n separators, same as legacy", () => {
  const r = parseWorkoutDetail("500m row · 20 burpees; 30 squats\nfinal set", "note");
  assert.deepEqual(r.items.map((i) => i.text), ["500m row", "20 burpees", "30 squats", "final set"]);
  assert.ok(r.items.every((i) => i.type === "movement"));
});

check("new: → still sets flow and orders the sequence", () => {
  const r = parseWorkoutDetail("Circuit:\n500m row → 500m ski → sled push 12.5m", "note");
  assert.equal(r.leadIn, "Circuit:");
  assert.equal(r.flow, true);
  assert.deepEqual(r.items.map((i) => i.text), ["500m row", "500m ski", "sled push 12.5m"]);
});

check("new: no separator at all is still plain prose passthrough, unchanged", () => {
  const r = parseWorkoutDetail("Recovery. Light stretch or walk if you feel like moving.", "Scheduled off day.");
  assert.equal(r.leadIn, null);
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].type, "note");
  assert.equal(r.items[0].text, "Recovery. Light stretch or walk if you feel like moving.");
});

check("new: coach_note as an empty string still counts as 'present' (new format)", () => {
  const r = parseWorkoutDetail("500m row · 20 burpees", "");
  assert.ok(r.items.every((i) => i.type === "movement"));
});

console.log(`\n${passed} passed`);
if (process.exitCode) process.exit(process.exitCode);
