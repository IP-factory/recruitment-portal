-- Task 24D-2: Scoring, review and Admin evaluation persistence
-- Creates tables for OPEN rubric review, integrity flags, bonus reviews,
-- evaluation records, dimension scores, and shortlist persistence.

CREATE TABLE `open_response_reviews` (
  `id` varchar(64) NOT NULL,
  `application_id` varchar(64) NOT NULL,
  `attempt_id` varchar(64) NOT NULL,
  `response_id` varchar(64) NOT NULL,
  `question_id` varchar(96) NOT NULL,
  `admin_profile_id` varchar(64),
  `raw_score` int NOT NULL,
  `review_note` text,
  `reviewed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `open_reviews_response_question_unique` (`response_id`, `question_id`),
  KEY `open_reviews_app_idx` (`application_id`),
  CONSTRAINT `open_reviews_app_fk` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE CASCADE,
  CONSTRAINT `open_reviews_attempt_fk` FOREIGN KEY (`attempt_id`) REFERENCES `assessment_attempts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `open_reviews_response_fk` FOREIGN KEY (`response_id`) REFERENCES `assessment_responses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `open_reviews_question_fk` FOREIGN KEY (`question_id`) REFERENCES `assessment_questions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `open_reviews_admin_fk` FOREIGN KEY (`admin_profile_id`) REFERENCES `admin_profiles` (`id`) ON DELETE SET NULL
);

CREATE TABLE `application_integrity_flags` (
  `id` varchar(64) NOT NULL,
  `application_id` varchar(64) NOT NULL,
  `source_question_id` varchar(96) NOT NULL,
  `comparison_question_id` varchar(96),
  `rule_id` varchar(96),
  `description` text NOT NULL,
  `source` varchar(96) NOT NULL,
  `status` enum('Clear','Flagged','Confirmed','Dismissed') NOT NULL,
  `confirmed_by` varchar(64),
  `reviewed_at` timestamp NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `integrity_flags_app_idx` (`application_id`),
  CONSTRAINT `integrity_flags_app_fk` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE CASCADE,
  CONSTRAINT `integrity_flags_admin_fk` FOREIGN KEY (`confirmed_by`) REFERENCES `admin_profiles` (`id`) ON DELETE SET NULL
);

CREATE TABLE `application_bonus_reviews` (
  `id` varchar(64) NOT NULL,
  `application_id` varchar(64) NOT NULL,
  `bonus_type` varchar(80) NOT NULL,
  `points` int NOT NULL,
  `confirmed` tinyint NOT NULL DEFAULT 0,
  `admin_profile_id` varchar(64),
  `note` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `bonus_reviews_app_type_unique` (`application_id`, `bonus_type`),
  KEY `bonus_reviews_app_idx` (`application_id`),
  CONSTRAINT `bonus_reviews_app_fk` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE CASCADE,
  CONSTRAINT `bonus_reviews_admin_fk` FOREIGN KEY (`admin_profile_id`) REFERENCES `admin_profiles` (`id`) ON DELETE SET NULL
);

CREATE TABLE `application_evaluations` (
  `id` varchar(64) NOT NULL,
  `application_id` varchar(64) NOT NULL,
  `attempt_id` varchar(64) NOT NULL,
  `base_assessment_score` decimal(6,3),
  `verification_multiplier` decimal(3,2),
  `integrity_penalty` int,
  `bonus` int,
  `final_screening_score` decimal(6,3),
  `raw_band` enum('A','B','C','D'),
  `applied_band` enum('A','B','C','D'),
  `floor_missed` varchar(120),
  `manual_review_required` tinyint NOT NULL DEFAULT 0,
  `evaluation_status` enum('Pending Assessment','Pending OPEN Review','Scored','Manual Review Required') NOT NULL,
  `calculated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `evaluations_app_unique` (`application_id`),
  CONSTRAINT `evaluations_app_fk` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE CASCADE,
  CONSTRAINT `evaluations_attempt_fk` FOREIGN KEY (`attempt_id`) REFERENCES `assessment_attempts` (`id`) ON DELETE CASCADE
);

CREATE TABLE `application_dimension_scores` (
  `id` varchar(64) NOT NULL,
  `application_id` varchar(64) NOT NULL,
  `dimension_id` varchar(64) NOT NULL,
  `dimension_reference` varchar(16) NOT NULL,
  `normalized_score` decimal(6,3) NOT NULL,
  `weight` int NOT NULL,
  `weighted_contribution` decimal(6,3) NOT NULL,
  `floor` int,
  `floor_status` varchar(32),
  `calculated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `dimension_scores_app_dim_unique` (`application_id`, `dimension_id`),
  KEY `dimension_scores_app_idx` (`application_id`),
  CONSTRAINT `dimension_scores_app_fk` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE CASCADE
);

CREATE TABLE `application_shortlist` (
  `id` varchar(64) NOT NULL,
  `application_id` varchar(64) NOT NULL,
  `shortlisted` tinyint NOT NULL DEFAULT 1,
  `updated_by` varchar(64),
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `shortlist_app_unique` (`application_id`),
  CONSTRAINT `shortlist_app_fk` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE CASCADE,
  CONSTRAINT `shortlist_admin_fk` FOREIGN KEY (`updated_by`) REFERENCES `admin_profiles` (`id`) ON DELETE SET NULL
);
