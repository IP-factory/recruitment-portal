-- Retain role relationships, applications, CVs and scores for historical review.
ALTER TABLE `recruitment_roles` ADD COLUMN `deleted_at` timestamp NULL DEFAULT NULL;
