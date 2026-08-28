-- Task 24D-1: Applicant runtime persistence tables

CREATE TABLE `applications` (
  `id` varchar(64) NOT NULL,
  `role_id` varchar(64) NOT NULL,
  `assessment_id` varchar(96),
  `full_name` varchar(180) NOT NULL,
  `email` varchar(320) NOT NULL,
  `phone` varchar(64) NOT NULL,
  `city` varchar(160) NOT NULL,
  `recent_role` varchar(180) NOT NULL,
  `recent_employer` varchar(180),
  `total_experience` varchar(64) NOT NULL,
  `relevant_experience` varchar(64) NOT NULL,
  `linkedin_url` varchar(512),
  `eligibility_status` enum('Pending','Eligible','Closed') NOT NULL,
  `application_status` enum('In Progress','Eligibility Closed','Assessment In Progress','Assessment Complete','Submitted','Shortlisted','Hold','Closed') NOT NULL,
  `current_step` varchar(64) NOT NULL,
  `started_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `submitted_at` timestamp,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `applicant_token_hash` varchar(128) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `applications_role_email_idx` (`role_id`, `email`),
  KEY `applications_token_hash_idx` (`applicant_token_hash`),
  CONSTRAINT `applications_role_id_fk` FOREIGN KEY (`role_id`) REFERENCES `recruitment_roles`(`id`) ON DELETE CASCADE
);

CREATE TABLE `application_eligibility_responses` (
  `id` varchar(64) NOT NULL,
  `application_id` varchar(64) NOT NULL,
  `gate_id` varchar(16) NOT NULL,
  `gate_reference` varchar(16) NOT NULL,
  `response_value` text NOT NULL,
  `outcome` varchar(64) NOT NULL,
  `internal_flag` varchar(64),
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `eligibility_responses_app_gate_unique` (`application_id`, `gate_id`),
  KEY `eligibility_responses_app_idx` (`application_id`),
  CONSTRAINT `eligibility_responses_application_id_fk` FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON DELETE CASCADE
);

CREATE TABLE `assessment_attempts` (
  `id` varchar(64) NOT NULL,
  `application_id` varchar(64) NOT NULL,
  `assessment_id` varchar(96) NOT NULL,
  `status` enum('Not Started','In Progress','Complete') NOT NULL,
  `started_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` timestamp,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `attempts_app_assessment_idx` (`application_id`, `assessment_id`),
  CONSTRAINT `attempts_application_id_fk` FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON DELETE CASCADE,
  CONSTRAINT `attempts_assessment_id_fk` FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`) ON DELETE CASCADE
);

CREATE TABLE `assessment_responses` (
  `id` varchar(64) NOT NULL,
  `attempt_id` varchar(64) NOT NULL,
  `question_id` varchar(96) NOT NULL,
  `response_type` varchar(64) NOT NULL,
  `response_payload` text NOT NULL,
  `started_at` timestamp,
  `answered_at` timestamp,
  `elapsed_seconds` int,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `responses_attempt_question_unique` (`attempt_id`, `question_id`),
  KEY `responses_attempt_idx` (`attempt_id`),
  CONSTRAINT `responses_attempt_id_fk` FOREIGN KEY (`attempt_id`) REFERENCES `assessment_attempts`(`id`) ON DELETE CASCADE,
  CONSTRAINT `responses_question_id_fk` FOREIGN KEY (`question_id`) REFERENCES `assessment_questions`(`id`) ON DELETE CASCADE
);
