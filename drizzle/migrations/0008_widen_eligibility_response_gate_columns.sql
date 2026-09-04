-- Migration 0008: Widen gate_id and gate_reference in application_eligibility_responses.
--
-- Root cause: the original columns were varchar(16), which was wide enough for
-- the seeded BDO gate IDs such as "gate-g1" (7 chars) and references such as
-- "G1" (2 chars). New roles created through the Admin UI receive IDs generated
-- by randomBytes(8).toString("hex") prefixed with "gate-", producing 21-char
-- strings (e.g. "gate-a31d12af9425ee81") that exceeded the column limit and
-- caused a "Data too long" error on the eligibility-response INSERT.
--
-- Because there is no FK constraint on this column (only the application_id FK
-- exists), the ALTER is safe with no cascading changes required.
--
-- This migration has already been applied to the live TiDB cluster directly.
-- It is recorded here for schema history and future migrations.

ALTER TABLE `application_eligibility_responses`
  MODIFY COLUMN `gate_id` varchar(64) NOT NULL;

ALTER TABLE `application_eligibility_responses`
  MODIFY COLUMN `gate_reference` varchar(64) NOT NULL;
