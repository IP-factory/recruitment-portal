-- Migration 0007: CSV Assessment Question Import — question scope metadata.
--
-- Additive only. Two new columns on `assessment_questions` distinguish
-- reusable Question Bank questions (scope = 'QUESTION_BANK') from questions
-- imported for a single role (scope = 'ROLE_ONLY', owner_role_id = <role>).
--
-- The scoring engine never reads `scope` or `owner_role_id`: it resolves
-- questions through `assessment_question_assignments`, so both scopes are
-- indistinguishable once assigned. Every existing row defaults to
-- 'QUESTION_BANK', leaving the live BDO assessment exactly as-is.

ALTER TABLE `assessment_questions`
  ADD COLUMN `scope` enum('QUESTION_BANK','ROLE_ONLY') NOT NULL DEFAULT 'QUESTION_BANK';

ALTER TABLE `assessment_questions`
  ADD COLUMN `owner_role_id` varchar(64) NULL;

ALTER TABLE `assessment_questions`
  ADD CONSTRAINT `assessment_questions_owner_role_fk`
  FOREIGN KEY (`owner_role_id`) REFERENCES `recruitment_roles` (`id`) ON DELETE SET NULL;

CREATE INDEX `assessment_questions_scope_idx` ON `assessment_questions` (`scope`);
