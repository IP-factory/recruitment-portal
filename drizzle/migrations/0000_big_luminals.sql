CREATE TABLE `assessment_cross_checks` (
	`id` varchar(96) NOT NULL,
	`source_question_id` varchar(96) NOT NULL,
	`comparison_question_id` varchar(96) NOT NULL,
	`rule_type` enum('Integrity flag','Manual review') NOT NULL,
	`rule_configuration` text NOT NULL,
	`description` text NOT NULL,
	`default_outcome` varchar(64) NOT NULL,
	`status` enum('Active','Inactive') NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `assessment_cross_checks_id` PRIMARY KEY(`id`),
	CONSTRAINT `assessment_cross_checks_pair_unique` UNIQUE(`source_question_id`,`comparison_question_id`)
);
--> statement-breakpoint
CREATE TABLE `assessment_dimensions` (
	`id` varchar(64) NOT NULL,
	`role_id` varchar(64) NOT NULL,
	`reference` varchar(16) NOT NULL,
	`name` varchar(180) NOT NULL,
	`weight` int NOT NULL,
	`minimum_floor` int,
	`display_order` int NOT NULL,
	`status` enum('Active','Inactive') NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `assessment_dimensions_id` PRIMARY KEY(`id`),
	CONSTRAINT `assessment_dimensions_role_reference_unique` UNIQUE(`role_id`,`reference`)
);
--> statement-breakpoint
CREATE TABLE `assessment_question_assignments` (
	`id` varchar(120) NOT NULL,
	`assessment_id` varchar(96) NOT NULL,
	`question_id` varchar(96) NOT NULL,
	`display_order` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `assessment_question_assignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `assessment_question_assignments_unique` UNIQUE(`assessment_id`,`question_id`),
	CONSTRAINT `assessment_question_assignments_order_unique` UNIQUE(`assessment_id`,`display_order`)
);
--> statement-breakpoint
CREATE TABLE `assessment_questions` (
	`id` varchar(96) NOT NULL,
	`reference` varchar(24) NOT NULL,
	`dimension_id` varchar(64),
	`question_type` enum('GATE','ORDINAL','MULTI','NUMERIC','SJT','OPEN','EVIDENCE') NOT NULL,
	`prompt` text NOT NULL,
	`help_text` text NOT NULL,
	`q_weight` int,
	`max_score` int,
	`required` tinyint NOT NULL DEFAULT 1,
	`status` enum('Active','Inactive','Draft') NOT NULL,
	`time_limit_sec` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `assessment_questions_id` PRIMARY KEY(`id`),
	CONSTRAINT `assessment_questions_reference_unique` UNIQUE(`reference`)
);
--> statement-breakpoint
CREATE TABLE `assessments` (
	`id` varchar(96) NOT NULL,
	`slug` varchar(140) NOT NULL,
	`role_id` varchar(64) NOT NULL,
	`name` varchar(180) NOT NULL,
	`description` text NOT NULL,
	`status` enum('Draft','Active','Inactive','Archived') NOT NULL,
	`version` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `assessments_id` PRIMARY KEY(`id`),
	CONSTRAINT `assessments_slug_version_unique` UNIQUE(`slug`,`version`)
);
--> statement-breakpoint
CREATE TABLE `dimension_floor_rules` (
	`id` varchar(96) NOT NULL,
	`screening_configuration_id` varchar(96) NOT NULL,
	`dimension_id` varchar(64) NOT NULL,
	`minimum_floor` int NOT NULL,
	`maximum_applied_band` enum('A','B','C','D') NOT NULL,
	`description` text NOT NULL,
	CONSTRAINT `dimension_floor_rules_id` PRIMARY KEY(`id`),
	CONSTRAINT `dimension_floor_config_dimension_unique` UNIQUE(`screening_configuration_id`,`dimension_id`)
);
--> statement-breakpoint
CREATE TABLE `eligibility_gates` (
	`id` varchar(64) NOT NULL,
	`role_id` varchar(64) NOT NULL,
	`reference` varchar(16) NOT NULL,
	`name` varchar(180) NOT NULL,
	`description` text NOT NULL,
	`gate_type` varchar(64) NOT NULL,
	`status` enum('Active','Configuration Required','Inactive') NOT NULL,
	`display_order` int NOT NULL,
	`configuration` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `eligibility_gates_id` PRIMARY KEY(`id`),
	CONSTRAINT `eligibility_gates_role_reference_unique` UNIQUE(`role_id`,`reference`)
);
--> statement-breakpoint
CREATE TABLE `numeric_question_configs` (
	`id` varchar(96) NOT NULL,
	`question_id` varchar(96) NOT NULL,
	`mode` enum('calendarYearExperience','twoValueDerived') NOT NULL,
	`input_definitions` text NOT NULL,
	`derived_calculation_type` varchar(96) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `numeric_question_configs_id` PRIMARY KEY(`id`),
	CONSTRAINT `numeric_question_configs_question_id_unique` UNIQUE(`question_id`)
);
--> statement-breakpoint
CREATE TABLE `numeric_scoring_bands` (
	`id` varchar(96) NOT NULL,
	`question_id` varchar(96) NOT NULL,
	`lower_bound` decimal(12,3),
	`upper_bound` decimal(12,3),
	`raw_score` int NOT NULL,
	`display_order` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `numeric_scoring_bands_id` PRIMARY KEY(`id`),
	CONSTRAINT `numeric_bands_question_order_unique` UNIQUE(`question_id`,`display_order`)
);
--> statement-breakpoint
CREATE TABLE `open_question_configs` (
	`id` varchar(96) NOT NULL,
	`question_id` varchar(96) NOT NULL,
	`minimum_words` int,
	`maximum_words` int,
	`time_limit_sec` int,
	`paste_allowed` tinyint NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `open_question_configs_id` PRIMARY KEY(`id`),
	CONSTRAINT `open_question_configs_question_id_unique` UNIQUE(`question_id`)
);
--> statement-breakpoint
CREATE TABLE `open_rubric_anchors` (
	`id` varchar(96) NOT NULL,
	`question_id` varchar(96) NOT NULL,
	`score_min` int NOT NULL,
	`score_max` int NOT NULL,
	`anchor_text` text NOT NULL,
	`display_order` int NOT NULL,
	CONSTRAINT `open_rubric_anchors_id` PRIMARY KEY(`id`),
	CONSTRAINT `open_rubric_anchors_question_order_unique` UNIQUE(`question_id`,`display_order`)
);
--> statement-breakpoint
CREATE TABLE `question_evidence_links` (
	`id` varchar(96) NOT NULL,
	`evidence_question_id` varchar(96) NOT NULL,
	`claimed_question_id` varchar(96) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `question_evidence_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `question_evidence_links_pair_unique` UNIQUE(`evidence_question_id`,`claimed_question_id`)
);
--> statement-breakpoint
CREATE TABLE `question_options` (
	`id` varchar(96) NOT NULL,
	`question_id` varchar(96) NOT NULL,
	`option_text` text NOT NULL,
	`display_order` int NOT NULL,
	`raw_score` int,
	`is_decoy` tinyint NOT NULL DEFAULT 0,
	`outcome_type` varchar(64),
	`related_gate_id` varchar(64),
	`internal_explanation` text,
	`verification_multiplier` decimal(3,2),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `question_options_id` PRIMARY KEY(`id`),
	CONSTRAINT `question_options_question_order_unique` UNIQUE(`question_id`,`display_order`)
);
--> statement-breakpoint
CREATE TABLE `question_type_configs` (
	`id` varchar(96) NOT NULL,
	`question_id` varchar(96) NOT NULL,
	`config_type` varchar(64) NOT NULL,
	`configuration` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `question_type_configs_id` PRIMARY KEY(`id`),
	CONSTRAINT `question_type_configs_question_id_unique` UNIQUE(`question_id`)
);
--> statement-breakpoint
CREATE TABLE `recruitment_roles` (
	`id` varchar(64) NOT NULL,
	`slug` varchar(120) NOT NULL,
	`title` varchar(180) NOT NULL,
	`department` varchar(160) NOT NULL,
	`location` varchar(160) NOT NULL,
	`employment_type` varchar(80) NOT NULL,
	`short_description` text NOT NULL,
	`full_description` text NOT NULL,
	`status` enum('Draft','Open','Closed','Archived') NOT NULL,
	`opening_date` varchar(32),
	`closing_date` varchar(32),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `recruitment_roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `recruitment_roles_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `screening_bands` (
	`id` varchar(96) NOT NULL,
	`screening_configuration_id` varchar(96) NOT NULL,
	`band` enum('A','B','C','D') NOT NULL,
	`minimum_score` decimal(6,3) NOT NULL,
	`maximum_score` decimal(6,3),
	`label` varchar(160) NOT NULL,
	`display_order` int NOT NULL,
	CONSTRAINT `screening_bands_id` PRIMARY KEY(`id`),
	CONSTRAINT `screening_bands_config_band_unique` UNIQUE(`screening_configuration_id`,`band`)
);
--> statement-breakpoint
CREATE TABLE `screening_bonus_criteria` (
	`id` varchar(96) NOT NULL,
	`screening_configuration_id` varchar(96) NOT NULL,
	`code` varchar(80) NOT NULL,
	`label` varchar(220) NOT NULL,
	`points` int NOT NULL,
	`display_order` int NOT NULL,
	CONSTRAINT `screening_bonus_criteria_id` PRIMARY KEY(`id`),
	CONSTRAINT `screening_bonus_config_code_unique` UNIQUE(`screening_configuration_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `screening_configurations` (
	`id` varchar(96) NOT NULL,
	`role_id` varchar(64) NOT NULL,
	`assessment_id` varchar(96),
	`verification_values` text NOT NULL,
	`integrity_penalty` int NOT NULL,
	`bonus_cap` int NOT NULL,
	`manual_review_rules` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `screening_configurations_id` PRIMARY KEY(`id`),
	CONSTRAINT `screening_configurations_role_assessment_unique` UNIQUE(`role_id`,`assessment_id`)
);
--> statement-breakpoint
CREATE TABLE `screening_verification_multipliers` (
	`id` varchar(96) NOT NULL,
	`screening_configuration_id` varchar(96) NOT NULL,
	`code` varchar(64) NOT NULL,
	`label` varchar(140) NOT NULL,
	`multiplier` decimal(3,2) NOT NULL,
	`display_order` int NOT NULL,
	CONSTRAINT `screening_verification_multipliers_id` PRIMARY KEY(`id`),
	CONSTRAINT `screening_verification_config_code_unique` UNIQUE(`screening_configuration_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
ALTER TABLE `assessment_cross_checks` ADD CONSTRAINT `assessment_cross_checks_source_question_id_assessment_questions_id_fk` FOREIGN KEY (`source_question_id`) REFERENCES `assessment_questions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assessment_cross_checks` ADD CONSTRAINT `assessment_cross_checks_comparison_question_id_assessment_questions_id_fk` FOREIGN KEY (`comparison_question_id`) REFERENCES `assessment_questions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assessment_dimensions` ADD CONSTRAINT `assessment_dimensions_role_id_recruitment_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `recruitment_roles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assessment_question_assignments` ADD CONSTRAINT `assessment_question_assignments_assessment_id_assessments_id_fk` FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assessment_question_assignments` ADD CONSTRAINT `assessment_question_assignments_question_id_assessment_questions_id_fk` FOREIGN KEY (`question_id`) REFERENCES `assessment_questions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assessment_questions` ADD CONSTRAINT `assessment_questions_dimension_id_assessment_dimensions_id_fk` FOREIGN KEY (`dimension_id`) REFERENCES `assessment_dimensions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assessments` ADD CONSTRAINT `assessments_role_id_recruitment_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `recruitment_roles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dimension_floor_rules` ADD CONSTRAINT `dimension_floor_rules_screening_configuration_id_screening_configurations_id_fk` FOREIGN KEY (`screening_configuration_id`) REFERENCES `screening_configurations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dimension_floor_rules` ADD CONSTRAINT `dimension_floor_rules_dimension_id_assessment_dimensions_id_fk` FOREIGN KEY (`dimension_id`) REFERENCES `assessment_dimensions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `eligibility_gates` ADD CONSTRAINT `eligibility_gates_role_id_recruitment_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `recruitment_roles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `numeric_question_configs` ADD CONSTRAINT `numeric_question_configs_question_id_assessment_questions_id_fk` FOREIGN KEY (`question_id`) REFERENCES `assessment_questions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `numeric_scoring_bands` ADD CONSTRAINT `numeric_scoring_bands_question_id_assessment_questions_id_fk` FOREIGN KEY (`question_id`) REFERENCES `assessment_questions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `open_question_configs` ADD CONSTRAINT `open_question_configs_question_id_assessment_questions_id_fk` FOREIGN KEY (`question_id`) REFERENCES `assessment_questions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `open_rubric_anchors` ADD CONSTRAINT `open_rubric_anchors_question_id_assessment_questions_id_fk` FOREIGN KEY (`question_id`) REFERENCES `assessment_questions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `question_evidence_links` ADD CONSTRAINT `question_evidence_links_evidence_question_id_assessment_questions_id_fk` FOREIGN KEY (`evidence_question_id`) REFERENCES `assessment_questions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `question_evidence_links` ADD CONSTRAINT `question_evidence_links_claimed_question_id_assessment_questions_id_fk` FOREIGN KEY (`claimed_question_id`) REFERENCES `assessment_questions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `question_options` ADD CONSTRAINT `question_options_question_id_assessment_questions_id_fk` FOREIGN KEY (`question_id`) REFERENCES `assessment_questions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `question_options` ADD CONSTRAINT `question_options_related_gate_id_eligibility_gates_id_fk` FOREIGN KEY (`related_gate_id`) REFERENCES `eligibility_gates`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `question_type_configs` ADD CONSTRAINT `question_type_configs_question_id_assessment_questions_id_fk` FOREIGN KEY (`question_id`) REFERENCES `assessment_questions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `screening_bands` ADD CONSTRAINT `screening_bands_screening_configuration_id_screening_configurations_id_fk` FOREIGN KEY (`screening_configuration_id`) REFERENCES `screening_configurations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `screening_bonus_criteria` ADD CONSTRAINT `screening_bonus_criteria_screening_configuration_id_screening_configurations_id_fk` FOREIGN KEY (`screening_configuration_id`) REFERENCES `screening_configurations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `screening_configurations` ADD CONSTRAINT `screening_configurations_role_id_recruitment_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `recruitment_roles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `screening_configurations` ADD CONSTRAINT `screening_configurations_assessment_id_assessments_id_fk` FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `screening_verification_multipliers` ADD CONSTRAINT `screening_verification_multipliers_screening_configuration_id_screening_configurations_id_fk` FOREIGN KEY (`screening_configuration_id`) REFERENCES `screening_configurations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `assessment_dimensions_role_order_idx` ON `assessment_dimensions` (`role_id`,`display_order`);--> statement-breakpoint
CREATE INDEX `assessment_questions_type_idx` ON `assessment_questions` (`question_type`);--> statement-breakpoint
CREATE INDEX `assessment_questions_dimension_idx` ON `assessment_questions` (`dimension_id`);--> statement-breakpoint
CREATE INDEX `assessments_role_idx` ON `assessments` (`role_id`);--> statement-breakpoint
CREATE INDEX `eligibility_gates_role_order_idx` ON `eligibility_gates` (`role_id`,`display_order`);--> statement-breakpoint
CREATE INDEX `question_options_question_idx` ON `question_options` (`question_id`);