-- Migration 0004: Fix question_options IDs and activate G4/G5 eligibility gates.
--
-- Background:
--   The original seed (Task 24A) generated question_options.id values using the
--   pattern `{questionId}-option-{index+1}` (e.g. "framework-d1-q1-option-1").
--   The applicant runtime, however, saves assessmentResponses.responsePayload
--   using the logical option key defined in frameworkQuestionData.ts ("a", "b",
--   "c", …). The scoring engine does config.options.find(o => o.id === payload)
--   so the two must match. This migration renames each option row to its logical
--   key so the scorer can resolve every ORDINAL/SJT/MULTI/EVIDENCE response.
--
--   G4 and G5 were seeded as "Configuration Required" because the start window
--   and salary band had not been published. Both are now configured and must be
--   Active so that new applications persist and evaluate them correctly.
--
-- This migration is purely additive UPDATE statements — no tables are dropped
-- or recreated, and existing application/response data is preserved.

-- ── Rename question_options IDs to logical keys ───────────────────────────────
-- Pattern: framework-{question}-option-{n} → the nth logical option key.
--
-- D1.Q1  (ORDINAL, options a–d)
UPDATE `question_options` SET `id` = 'a' WHERE `id` = 'framework-d1-q1-option-1';
UPDATE `question_options` SET `id` = 'b' WHERE `id` = 'framework-d1-q1-option-2';
UPDATE `question_options` SET `id` = 'c' WHERE `id` = 'framework-d1-q1-option-3';
UPDATE `question_options` SET `id` = 'd' WHERE `id` = 'framework-d1-q1-option-4';

-- D3.Q1  (MULTI, options a–i)
UPDATE `question_options` SET `id` = 'a' WHERE `id` = 'framework-d3-q1-option-1';
UPDATE `question_options` SET `id` = 'b' WHERE `id` = 'framework-d3-q1-option-2';
UPDATE `question_options` SET `id` = 'c' WHERE `id` = 'framework-d3-q1-option-3';
UPDATE `question_options` SET `id` = 'd' WHERE `id` = 'framework-d3-q1-option-4';
UPDATE `question_options` SET `id` = 'e' WHERE `id` = 'framework-d3-q1-option-5';
UPDATE `question_options` SET `id` = 'f' WHERE `id` = 'framework-d3-q1-option-6';
UPDATE `question_options` SET `id` = 'g' WHERE `id` = 'framework-d3-q1-option-7';
UPDATE `question_options` SET `id` = 'h' WHERE `id` = 'framework-d3-q1-option-8';
UPDATE `question_options` SET `id` = 'i' WHERE `id` = 'framework-d3-q1-option-9';

-- D2.Q3  (ORDINAL, options a–e)
UPDATE `question_options` SET `id` = 'a' WHERE `id` = 'framework-d2-q3-option-1';
UPDATE `question_options` SET `id` = 'b' WHERE `id` = 'framework-d2-q3-option-2';
UPDATE `question_options` SET `id` = 'c' WHERE `id` = 'framework-d2-q3-option-3';
UPDATE `question_options` SET `id` = 'd' WHERE `id` = 'framework-d2-q3-option-4';
UPDATE `question_options` SET `id` = 'e' WHERE `id` = 'framework-d2-q3-option-5';

-- D4.Q1  (MULTI, options a–h)
UPDATE `question_options` SET `id` = 'a' WHERE `id` = 'framework-d4-q1-option-1';
UPDATE `question_options` SET `id` = 'b' WHERE `id` = 'framework-d4-q1-option-2';
UPDATE `question_options` SET `id` = 'c' WHERE `id` = 'framework-d4-q1-option-3';
UPDATE `question_options` SET `id` = 'd' WHERE `id` = 'framework-d4-q1-option-4';
UPDATE `question_options` SET `id` = 'e' WHERE `id` = 'framework-d4-q1-option-5';
UPDATE `question_options` SET `id` = 'f' WHERE `id` = 'framework-d4-q1-option-6';
UPDATE `question_options` SET `id` = 'g' WHERE `id` = 'framework-d4-q1-option-7';
UPDATE `question_options` SET `id` = 'h' WHERE `id` = 'framework-d4-q1-option-8';

-- D3.Q3  (ORDINAL, options a–e)
UPDATE `question_options` SET `id` = 'a' WHERE `id` = 'framework-d3-q3-option-1';
UPDATE `question_options` SET `id` = 'b' WHERE `id` = 'framework-d3-q3-option-2';
UPDATE `question_options` SET `id` = 'c' WHERE `id` = 'framework-d3-q3-option-3';
UPDATE `question_options` SET `id` = 'd' WHERE `id` = 'framework-d3-q3-option-4';
UPDATE `question_options` SET `id` = 'e' WHERE `id` = 'framework-d3-q3-option-5';

-- D5.Q1  (SJT, options a–d)
UPDATE `question_options` SET `id` = 'a' WHERE `id` = 'framework-d5-q1-option-1';
UPDATE `question_options` SET `id` = 'b' WHERE `id` = 'framework-d5-q1-option-2';
UPDATE `question_options` SET `id` = 'c' WHERE `id` = 'framework-d5-q1-option-3';
UPDATE `question_options` SET `id` = 'd' WHERE `id` = 'framework-d5-q1-option-4';

-- D2.Q1E  (EVIDENCE, options a–c)
UPDATE `question_options` SET `id` = 'a' WHERE `id` = 'framework-d2-q1e-option-1';
UPDATE `question_options` SET `id` = 'b' WHERE `id` = 'framework-d2-q1e-option-2';
UPDATE `question_options` SET `id` = 'c' WHERE `id` = 'framework-d2-q1e-option-3';

-- D7.Q1  (SJT, options a–d)
UPDATE `question_options` SET `id` = 'a' WHERE `id` = 'framework-d7-q1-option-1';
UPDATE `question_options` SET `id` = 'b' WHERE `id` = 'framework-d7-q1-option-2';
UPDATE `question_options` SET `id` = 'c' WHERE `id` = 'framework-d7-q1-option-3';
UPDATE `question_options` SET `id` = 'd' WHERE `id` = 'framework-d7-q1-option-4';

-- D8.Q1  (MULTI, options a–g)
UPDATE `question_options` SET `id` = 'a' WHERE `id` = 'framework-d8-q1-option-1';
UPDATE `question_options` SET `id` = 'b' WHERE `id` = 'framework-d8-q1-option-2';
UPDATE `question_options` SET `id` = 'c' WHERE `id` = 'framework-d8-q1-option-3';
UPDATE `question_options` SET `id` = 'd' WHERE `id` = 'framework-d8-q1-option-4';
UPDATE `question_options` SET `id` = 'e' WHERE `id` = 'framework-d8-q1-option-5';
UPDATE `question_options` SET `id` = 'f' WHERE `id` = 'framework-d8-q1-option-6';
UPDATE `question_options` SET `id` = 'g' WHERE `id` = 'framework-d8-q1-option-7';

-- D2.Q3 cross-check option IDs are already patched above (a–e).
-- D1.Q1 close-outcome option d is patched above.

-- ── Activate G4 and G5 eligibility gates ────────────────────────────────────

UPDATE `eligibility_gates`
SET
  `status` = 'Active',
  `description` = 'Are you available to start by 1 September 2026 or earlier?',
  `gate_type` = 'availability',
  `configuration` = '{"requiredAnswer":"yes","latestStartDate":"2026-09-01","description":"Candidates must be available to start no later than 1 September 2026."}'
WHERE `reference` = 'G4'
  AND `role_id` = 'role-business-development-officer';

UPDATE `eligibility_gates`
SET
  `status` = 'Active',
  `description` = 'Is your salary expectation within the range of \u20a66,000,000 \u2013 \u20a69,600,000 gross per annum?',
  `gate_type` = 'compensation',
  `configuration` = '{"requiredAnswer":"yes","bandMin":6000000,"bandMax":9600000,"currency":"NGN","description":"Published gross annual salary band \u20a66m \u2013 \u20a69.6m."}'
WHERE `reference` = 'G5'
  AND `role_id` = 'role-business-development-officer';
