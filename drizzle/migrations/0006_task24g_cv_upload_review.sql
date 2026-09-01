-- Migration 0006: Task 24G — CV upload metadata + manual CV review.
--
-- Two additive tables. CV file bytes are NEVER stored in TiDB — only the
-- storage reference/metadata. The CV review record is intentionally separate
-- from the assessment evaluation tables so the existing scoring engine is
-- never coupled to or affected by CV scoring. The derived Overall Candidate
-- Score is computed at display time: (Assessment Score + CV Score) / 2.

CREATE TABLE `application_cv_files` (
  `id` varchar(64) NOT NULL,
  `application_id` varchar(64) NOT NULL,
  `storage_key` varchar(256) NOT NULL,
  `original_filename` varchar(320) NOT NULL,
  `mime_type` varchar(120) NOT NULL,
  `file_size` int NOT NULL,
  `uploaded_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `cv_files_app_unique` (`application_id`),
  CONSTRAINT `cv_files_app_fk` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE CASCADE
);

CREATE TABLE `application_cv_reviews` (
  `id` varchar(64) NOT NULL,
  `application_id` varchar(64) NOT NULL,
  `score` decimal(5,1) NOT NULL,
  `review_note` text,
  `reviewed_by` varchar(64),
  `reviewed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `cv_reviews_app_unique` (`application_id`),
  CONSTRAINT `cv_reviews_app_fk` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE CASCADE,
  CONSTRAINT `cv_reviews_admin_fk` FOREIGN KEY (`reviewed_by`) REFERENCES `admin_profiles` (`id`) ON DELETE SET NULL
);
