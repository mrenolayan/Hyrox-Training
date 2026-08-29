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

console.log(`\n${passed} passed`);
if (process.exitCode) process.exit(process.exitCode);
