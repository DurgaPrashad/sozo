CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`hash` text NOT NULL,
	`prefix` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_hash_unique` ON `api_keys` (`hash`);--> statement-breakpoint
CREATE INDEX `keys_owner` ON `api_keys` (`owner_id`);--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`action` text NOT NULL,
	`resource_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_owner_created` ON `audit_events` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `integrations` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`url` text NOT NULL,
	`capabilities` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `integrations_owner` ON `integrations` (`owner_id`);--> statement-breakpoint
CREATE TABLE `notebook` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`source_url` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notes_owner` ON `notebook` (`owner_id`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`color` text DEFAULT 'lime' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `projects_owner` ON `projects` (`owner_id`);--> statement-breakpoint
CREATE TABLE `research_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`project_id` text,
	`question` text NOT NULL,
	`domain` text NOT NULL,
	`status` text NOT NULL,
	`mode` text NOT NULL,
	`sources` text NOT NULL,
	`result` text,
	`progress` text NOT NULL,
	`error` text,
	`created_at` text NOT NULL,
	`completed_at` text,
	`idempotency_key` text
);
--> statement-breakpoint
CREATE INDEX `runs_owner_created` ON `research_runs` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `runs_idempotency` ON `research_runs` (`owner_id`,`idempotency_key`);