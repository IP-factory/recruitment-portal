-- Migration 0005: Role-specific configurable eligibility gates.
--
-- Background:
--   The previous eligibility architecture hardcoded the seven BDO gates (G1-G7)
--   with a switch/case evaluator that only understood those exact references.
--   The server evaluation is now driven by a generic `configuration` JSON shape
--   that declares `inputType`, `options`, `passRule`, `isBlocking` and any
--   supporting values (dates, compensation range, minimum years, field mapping).
--
--   The same schema serves any future role — each role has its own independent
--   gate set. The BDO gates below are the live configuration as of deployment.
--
--   G3 is derived from the Applicant Information "relevant experience" field
--   and therefore has `inputType: "APPLICATION_FIELD"` — the applicant never
--   sees G3 as a separate question in the eligibility section.
--
--   The `status` column remains the authoritative gating state; rows with
--   `status = 'Inactive'` are skipped by the evaluator. The new `is_blocking`
--   flag in configuration drives PASS/FAIL closeout semantics independently.
--
-- This migration is seven additive UPDATE statements — no tables are dropped,
-- no responses are altered, no option IDs are changed. Existing
-- `application_eligibility_responses` rows remain valid (they store the gate
-- reference which is unchanged).

-- ── G1 — Abuja availability ─────────────────────────────────────────────────

UPDATE `eligibility_gates`
SET
  `name` = 'Abuja availability',
  `description` = 'Which statement best describes your current location and availability to work in Abuja?',
  `gate_type` = 'eligibility',
  `status` = 'Active',
  `configuration` = '{"inputType":"SINGLE_SELECT","label":"Abuja availability","options":[{"value":"abuja","text":"I currently live in Abuja.","outcome":"PASS"},{"value":"relocate","text":"I do not currently live in Abuja, but I am committed to relocating before the required start date.","outcome":"PASS_WITH_FLAG","flag":"Relocation commitment"},{"value":"not-relocate","text":"I do not live in Abuja and I am not currently planning to relocate.","outcome":"FAIL"}],"isBlocking":true,"allowSupplementaryField":true,"supplementaryFieldKey":"plannedRelocationDate","supplementaryFieldLabel":"Planned relocation date","supplementaryFieldVisibleWhen":"relocate"}'
WHERE `reference` = 'G1'
  AND `role_id` = 'role-business-development-officer';

-- ── G2 — Right to work in Nigeria ───────────────────────────────────────────

UPDATE `eligibility_gates`
SET
  `name` = 'Right to work in Nigeria',
  `description` = 'Do you have the legal right to work in Nigeria?',
  `gate_type` = 'eligibility',
  `status` = 'Active',
  `configuration` = '{"inputType":"YES_NO","label":"Right to work in Nigeria","passRule":{"match":"yes"},"isBlocking":true}'
WHERE `reference` = 'G2'
  AND `role_id` = 'role-business-development-officer';

-- ── G3 — Minimum Business Development experience (derived) ──────────────────

UPDATE `eligibility_gates`
SET
  `name` = 'Minimum Business Development experience',
  `description` = 'Minimum 3 years in a Business Development, corporate sales or account management role. Evaluated from the Applicant Information field.',
  `gate_type` = 'eligibility',
  `status` = 'Active',
  `configuration` = '{"inputType":"APPLICATION_FIELD","fieldKey":"relevantExperience","label":"Minimum Business Development experience","minimumYears":3,"experienceBandMinimumYears":{"No direct experience":0,"Less than 1 year":0,"1–2 years":1,"3–5 years":3,"6–8 years":6,"9+ years":9},"isBlocking":true}'
WHERE `reference` = 'G3'
  AND `role_id` = 'role-business-development-officer';

-- ── G4 — Start availability ─────────────────────────────────────────────────

UPDATE `eligibility_gates`
SET
  `name` = 'Start availability',
  `description` = 'Are you available to start by 1 September 2026 or earlier?',
  `gate_type` = 'eligibility',
  `status` = 'Active',
  `configuration` = '{"inputType":"YES_NO","label":"Start availability","latestStartDate":"2026-09-01","deadlineLabel":"1 September 2026","passRule":{"match":"yes"},"isBlocking":true}'
WHERE `reference` = 'G4'
  AND `role_id` = 'role-business-development-officer';

-- ── G5 — Compensation expectation ──────────────────────────────────────────

UPDATE `eligibility_gates`
SET
  `name` = 'Compensation expectation',
  `description` = 'Is your gross annual salary expectation within the range of ₦6,000,000 – ₦9,600,000?',
  `gate_type` = 'eligibility',
  `status` = 'Active',
  `configuration` = '{"inputType":"YES_NO","label":"Compensation expectation","minimumAmount":6000000,"maximumAmount":9600000,"currency":"NGN","period":"gross annual","rangeLabel":"₦6,000,000 – ₦9,600,000 gross per annum","passRule":{"match":"yes"},"isBlocking":true}'
WHERE `reference` = 'G5'
  AND `role_id` = 'role-business-development-officer';

-- ── G6 — Outbound work ─────────────────────────────────────────────────────

UPDATE `eligibility_gates`
SET
  `name` = 'Outbound work',
  `description` = 'Are you willing to work in an outbound Business Development role that may involve client visits, site tours, evening events and occasional weekend events?',
  `gate_type` = 'eligibility',
  `status` = 'Active',
  `configuration` = '{"inputType":"YES_NO","label":"Outbound work","passRule":{"match":"yes"},"isBlocking":true}'
WHERE `reference` = 'G6'
  AND `role_id` = 'role-business-development-officer';

-- ── G7 — Reference and employment verification ─────────────────────────────

UPDATE `eligibility_gates`
SET
  `name` = 'Reference and employment verification',
  `description` = 'Do you consent to reference and employment verification as part of the recruitment process?',
  `gate_type` = 'eligibility',
  `status` = 'Active',
  `configuration` = '{"inputType":"YES_NO","label":"Reference and employment verification","passRule":{"match":"yes"},"isBlocking":true}'
WHERE `reference` = 'G7'
  AND `role_id` = 'role-business-development-officer';
