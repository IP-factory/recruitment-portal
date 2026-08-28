CREATE TABLE `admin_profiles` (
	`id` varchar(64) NOT NULL,
	`auth_user_id` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`full_name` text,
	`role` enum('Admin') NOT NULL,
	`status` enum('Active','Inactive') NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `admin_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_profiles_auth_user_id_unique` UNIQUE(`auth_user_id`)
);
--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`id` varchar(64) NOT NULL,
	`user_id` int NOT NULL,
	`token_hash` varchar(128) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auth_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `auth_sessions_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `password_hash` varchar(255);--> statement-breakpoint
ALTER TABLE `admin_profiles` ADD CONSTRAINT `admin_profiles_auth_user_id_users_id_fk` FOREIGN KEY (`auth_user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auth_sessions` ADD CONSTRAINT `auth_sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `auth_sessions_user_idx` ON `auth_sessions` (`user_id`);