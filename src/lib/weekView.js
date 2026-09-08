// ════════════════════════════════════════════════════════════════════════════
//  weekView.js — buckets one athlete's plan entries into a Mon..Sun week view
//  by "effective date" (a log's logged_date when present, else the entry's
//  planned date), so a workout logged on a different day renders where it
//  was actually done, with a dimmed stub left on its originally planned day.
//
//  Pure functions: no React, no Supabase, no I/O. Every date is a
//  "YYYY-MM-DD" string; the only place a Date object gets built from one is
//  the local (y, m-1, d) components constructor — never `new Date(isoString)`,
//  which is the off-by-one bug class this file exists to avoid (see
//  ARCHITECTURE.md's timezone note and the Phase 9 spec).
// ════════════════════════════════════════════════════════════════════════════

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Date -> "YYYY-MM-DD", using the Date's own local calendar fields.
export function toISO(dt) {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// "YYYY-MM-DD" + n days -> "YYYY-MM-DD", entirely in local calendar fields.
export function addDays(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return toISO(dt);
}

// The calendar date a plan_entries row is scheduled for, per plans.start_iso.
// plan_days has no date column — only day_of_week — so this is derived.
export function plannedDateISO(planStartIso, weekNumber, dayOfWeek) {
  const offset = (weekNumber - 1) * 7 + DAY_ORDER.indexOf(dayOfWeek);
  return addDays(planStartIso, offset);
}

// "YYYY-MM-DD" -> "Wed 8/26". The only place this file needs a weekday name,
// which requires an actual Date — built from local components, as above.
export function formatShortDateWithDay(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const dayAbbrev = dt.toLocaleDateString("en-US", { weekday: "short" });
  return `${dayAbbrev} ${m}/${d}`;
}

// "YYYY-MM-DD" -> "Aug 26" (no weekday — caller already knows it).
export function formatShortDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function cmpCreatedAt(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

// entries: plan_entries rows for ONE athlete, each pre-flattened with the
// week_number/day_of_week of their own plan_day attached (plan_entries
// itself carries no date/week info — it belongs to plan_days/plan_weeks).
// logsByEntryId: { [plan_entry_id]: logRow }, at most one row per entry
// (logs has a unique (athlete_id, plan_entry_id) constraint — see below).
export function buildWeekView({ planStartIso, weekNumber, allEntries, logsByEntryId }) {
  const weekStartISO = addDays(planStartIso, (weekNumber - 1) * 7);
  const days = DAY_ORDER.map((dayOfWeek, i) => ({
    dateISO: addDays(weekStartISO, i),
    dayOfWeek,
    planned: [],
    movedIn: [],
    movedOutStubs: [],
  }));
  const byDate = Object.fromEntries(days.map((d) => [d.dateISO, d]));

  for (const entry of allEntries ?? []) {
    const log = logsByEntryId?.[entry.id] ?? null;
    const plannedISO = plannedDateISO(planStartIso, entry.week_number, entry.day_of_week);
    const effectiveISO = log?.logged_date || plannedISO;

    if (effectiveISO === plannedISO) {
      // Unlogged, or logged in place — stays exactly where the plan put it.
      byDate[plannedISO]?.planned.push({ entry, log });
    } else {
      // Moved: a dimmed stub stays on the planned day, the real card moves
      // to the effective day. Each only renders if that day is in this week.
      byDate[plannedISO]?.movedOutStubs.push({ entry, log });
      byDate[effectiveISO]?.movedIn.push({ entry, log });
    }
  }

  return days;
}

// Final render order for one day bucket: completed items (planned-here and
// moved-in alike) sorted by when they were logged, then remaining not-done
// planned items, then moved-out stubs last, dimmed. If a moved-in workout
// lands on a day that already has one, both just show — no merging.
export function orderedDayItems(day) {
  const candidates = [...day.planned, ...day.movedIn];
  const completed = candidates.filter((c) => c.log).sort((a, b) => cmpCreatedAt(a.log.created_at, b.log.created_at));
  const remaining = candidates.filter((c) => !c.log);
  return { items: [...completed, ...remaining], stubs: day.movedOutStubs };
}
