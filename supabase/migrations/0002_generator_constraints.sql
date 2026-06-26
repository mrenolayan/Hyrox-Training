-- ════════════════════════════════════════════════════════════════════════════
--  0002_generator_constraints.sql
--
--  Adds unique constraints so the plan generator can upsert without wiping
--  and re-inserting rows (which would destroy coach's manual edits to entries).
--
--  Safe to run on the dev project — both constraints are additive and enforce
--  what should already be true (can't have two "Week 1" rows for the same plan).
--
--  Run in Supabase SQL editor BEFORE testing the generator.
-- ════════════════════════════════════════════════════════════════════════════

alter table plan_weeks
  add constraint plan_weeks_plan_id_week_number_key unique (plan_id, week_number);

alter table plan_days
  add constraint plan_days_plan_week_id_day_of_week_key unique (plan_week_id, day_of_week);
