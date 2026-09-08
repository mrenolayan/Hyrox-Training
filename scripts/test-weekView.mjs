// Plain assertion script — no test runner in package.json, run with:
//   node scripts/test-weekView.mjs
import assert from "node:assert/strict";
import { toISO, addDays, plannedDateISO, buildWeekView, orderedDayItems } from "../src/lib/weekView.js";

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

check("toISO round-trips local date components", () => {
  assert.equal(toISO(new Date(2026, 7, 26)), "2026-08-26"); // Aug 26 2026
});

check("addDays stays local, crosses month/year boundaries", () => {
  assert.equal(addDays("2026-08-26", 1), "2026-08-27");
  assert.equal(addDays("2026-08-31", 1), "2026-09-01");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2026-08-26", -30), "2026-07-27");
});

check("plannedDateISO matches the plan's own verified week-1 Monday", () => {
  // Andrew/Anaheim's plan starts Monday 2026-06-15 per the Phase 9 spec.
  assert.equal(plannedDateISO("2026-06-15", 1, "Mon"), "2026-06-15");
  assert.equal(plannedDateISO("2026-06-15", 1, "Sun"), "2026-06-21");
  assert.equal(plannedDateISO("2026-06-15", 3, "Mon"), "2026-06-29"); // week 3 = +14 days
});

// A minimal 1-week, 1-entry-per-day plan for the bucketing/ordering tests.
function makeEntries(planStartIso) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return days.map((day_of_week, i) => ({
    id: `entry-${day_of_week}`,
    week_number: 1,
    day_of_week,
    label: `${day_of_week} session`,
    session_type: i === 2 ? "strength" : "run_easy",
  }));
}

check("unlogged entries stay exactly where the plan put them", () => {
  const planStartIso = "2026-06-15"; // Monday
  const entries = makeEntries(planStartIso);
  const days = buildWeekView({ planStartIso, weekNumber: 1, allEntries: entries, logsByEntryId: {} });
  const mon = days.find((d) => d.dayOfWeek === "Mon");
  const wed = days.find((d) => d.dayOfWeek === "Wed");
  assert.equal(mon.planned.length, 1);
  assert.equal(mon.planned[0].entry.id, "entry-Mon");
  assert.equal(mon.movedIn.length, 0);
  assert.equal(mon.movedOutStubs.length, 0);
  assert.equal(wed.planned[0].entry.id, "entry-Wed");
});

check("logging Monday's entry onto Wednesday: stub on Monday, card on Wednesday", () => {
  const planStartIso = "2026-06-15";
  const entries = makeEntries(planStartIso);
  const logsByEntryId = {
    "entry-Mon": { plan_entry_id: "entry-Mon", done: true, logged_date: "2026-06-17", created_at: "2026-06-17T14:00:00+00:00" },
  };
  const days = buildWeekView({ planStartIso, weekNumber: 1, allEntries: entries, logsByEntryId });
  const mon = days.find((d) => d.dayOfWeek === "Mon");
  const wed = days.find((d) => d.dayOfWeek === "Wed");

  assert.equal(mon.planned.length, 0, "Monday's own planned slot is empty — it moved");
  assert.equal(mon.movedOutStubs.length, 1);
  assert.equal(mon.movedOutStubs[0].entry.id, "entry-Mon");
  assert.equal(mon.movedOutStubs[0].log.logged_date, "2026-06-17");

  assert.equal(wed.movedIn.length, 1);
  assert.equal(wed.movedIn[0].entry.id, "entry-Mon");
  assert.equal(wed.planned.length, 1, "Wednesday's own entry is untouched");
  assert.equal(wed.planned[0].entry.id, "entry-Wed");

  // Both simply show — no merging.
  const { items, stubs } = orderedDayItems(wed);
  assert.equal(items.length, 2);
  assert.equal(stubs.length, 0);
});

check("reverting the moved entry back to Monday clears the stub and restores both", () => {
  const planStartIso = "2026-06-15";
  const entries = makeEntries(planStartIso);
  // logged, but logged_date == planned date — stays in place, not "moved".
  const logsByEntryId = {
    "entry-Mon": { plan_entry_id: "entry-Mon", done: true, logged_date: "2026-06-15", created_at: "2026-06-15T14:00:00+00:00" },
  };
  const days = buildWeekView({ planStartIso, weekNumber: 1, allEntries: entries, logsByEntryId });
  const mon = days.find((d) => d.dayOfWeek === "Mon");
  const wed = days.find((d) => d.dayOfWeek === "Wed");

  assert.equal(mon.planned.length, 1);
  assert.equal(mon.movedOutStubs.length, 0);
  assert.equal(wed.movedIn.length, 0);
});

check("ordering: completed items (by created_at) before remaining not-done planned", () => {
  const planStartIso = "2026-06-15";
  const entries = makeEntries(planStartIso);
  const logsByEntryId = {
    // Two workouts land on Wednesday: Monday's (logged later) and Friday's (logged earlier).
    "entry-Mon": { plan_entry_id: "entry-Mon", done: true, logged_date: "2026-06-17", created_at: "2026-06-17T18:00:00+00:00" },
    "entry-Fri": { plan_entry_id: "entry-Fri", done: true, logged_date: "2026-06-17", created_at: "2026-06-17T09:00:00+00:00" },
    // Wednesday's own entry is NOT logged.
  };
  const days = buildWeekView({ planStartIso, weekNumber: 1, allEntries: entries, logsByEntryId });
  const wed = days.find((d) => d.dayOfWeek === "Wed");
  const { items, stubs } = orderedDayItems(wed);

  assert.equal(items.length, 3);
  assert.deepEqual(items.map((i) => i.entry.id), ["entry-Fri", "entry-Mon", "entry-Wed"],
    "Fri (created 09:00) then Mon (created 18:00) — chronological — then unlogged Wed last");
  assert.equal(stubs.length, 0);
});

check("a log dated into the previous week renders in that week's view, not the entry's own week", () => {
  const planStartIso = "2026-06-15"; // week 1 Monday
  const entries = [
    { id: "entry-w2-mon", week_number: 2, day_of_week: "Mon", label: "Week 2 Strength", session_type: "strength" },
  ];
  const logsByEntryId = {
    // Week 2 Monday is 2026-06-22; log it onto 2026-06-19 (week 1 Friday).
    "entry-w2-mon": { plan_entry_id: "entry-w2-mon", done: true, logged_date: "2026-06-19", created_at: "2026-06-19T10:00:00+00:00" },
  };
  const week1 = buildWeekView({ planStartIso, weekNumber: 1, allEntries: entries, logsByEntryId });
  const week2 = buildWeekView({ planStartIso, weekNumber: 2, allEntries: entries, logsByEntryId });

  const week1Fri = week1.find((d) => d.dayOfWeek === "Fri");
  assert.equal(week1Fri.movedIn.length, 1);
  assert.equal(week1Fri.movedIn[0].entry.id, "entry-w2-mon");

  const week2Mon = week2.find((d) => d.dayOfWeek === "Mon");
  assert.equal(week2Mon.movedOutStubs.length, 1, "week 2's own view shows the stub on its planned day");
  assert.equal(week2Mon.planned.length, 0);
});

console.log(`\n${passed} passed`);
if (process.exitCode) process.exit(process.exitCode);
