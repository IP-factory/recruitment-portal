-- Migration 0004: Activate G4/G5 eligibility gates with real configuration.
--
-- Background:
--   G4 (start availability) and G5 (compensation band) were originally seeded
--   as status="Configuration Required" with configuration={"configured":false}
--   because the recruitment window and salary band had not been published.
--   Both are now configured and must be Active so that new applications
--   correctly evaluate and persist G4/G5 gate outcomes.
--
--   NOTE on G4/G5 values:
--     latestStartDate "2026-09-01" and bandMin/bandMax 6000000/9600000 (NGN)
--     are the published values for the BDO role. If these change before
--     deployment, update the configuration JSON below before applying.
--     Do NOT apply this migration with placeholder values.
--
-- This migration is two additive UPDATE statements — no tables are dropped,
-- no responses are altered, and no option IDs are changed.
--
-- IMPORTANT: The scoring engine's ORDINAL/SJT option lookup uses the
-- question_options.id exactly as stored. Production responses contain IDs
-- such as "framework-d1-q1-option-1". The scorer is fixed in application
-- code (server/evaluationScoring.ts) to handle unquoted string payloads
-- without requiring any schema migration.

-- ── Activate G4 — start availability ─────────────────────────────────────────

UPDATE `eligibility_gates`
SET
  `status` = 'Active',
  `description` = 'Are you available to start by 1 September 2026 or earlier?',
  `gate_type` = 'availability',
  `configuration` = '{"requiredAnswer":"yes","latestStartDate":"2026-09-01","description":"Candidates must be available to start no later than 1 September 2026."}'
WHERE `reference` = 'G4'
  AND `role_id` = 'role-business-development-officer';

-- ── Activate G5 — compensation band ──────────────────────────────────────────

UPDATE `eligibility_gates`
SET
  `status` = 'Active',
  `description` = 'Is your salary expectation within the range of ₦6,000,000 – ₦9,600,000 gross per annum?',
  `gate_type` = 'compensation',
  `configuration` = '{"requiredAnswer":"yes","bandMin":6000000,"bandMax":9600000,"currency":"NGN","description":"Published gross annual salary band ₦6m – ₦9.6m."}'
WHERE `reference` = 'G5'
  AND `role_id` = 'role-business-development-officer';
