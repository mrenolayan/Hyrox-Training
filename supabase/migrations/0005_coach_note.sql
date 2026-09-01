-- Add coach_note column to plan_entries for two-format parseWorkoutDetail dispatch
--
-- When coach_note is set (non-null), plan_entries.detail is parsed as "new format":
-- every segment is a movement, no sentence peeling, first line ending in colon becomes leadIn.
--
-- When coach_note is null/absent, detail is parsed as "legacy format" (commit 97c6aa0):
-- single-winner separator selection, sentence peeling on last segment only.
--
-- This allows data-driven format selection instead of adding parser rules for edge cases.

alter table plan_entries add column coach_note text;

comment on column plan_entries.coach_note is 'Format flag for parseWorkoutDetail: set = new format (all segments are movements), null = legacy format (97c6aa0 frozen behavior)';
