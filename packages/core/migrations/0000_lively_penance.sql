CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`system_tag` text,
	`settings` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `character_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`name` text NOT NULL,
	`summary` text,
	`body` text,
	`attrs` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `character_profiles_owner_idx` ON `character_profiles` (`owner_user_id`);--> statement-breakpoint
CREATE TABLE `entities` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`summary` text,
	`body` text,
	`attrs` text,
	`visibility` text DEFAULT 'table' NOT NULL,
	`character_profile_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`character_profile_id`) REFERENCES `character_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `entities_campaign_idx` ON `entities` (`campaign_id`);--> statement-breakpoint
CREATE INDEX `entities_campaign_kind_idx` ON `entities` (`campaign_id`,`kind`);--> statement-breakpoint
CREATE TABLE `entity_links` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`from_type` text NOT NULL,
	`from_id` text NOT NULL,
	`to_entity_id` text NOT NULL,
	`context_snippet` text,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entity_links_edge_idx` ON `entity_links` (`from_type`,`from_id`,`to_entity_id`);--> statement-breakpoint
CREATE INDEX `entity_links_to_idx` ON `entity_links` (`to_entity_id`);--> statement-breakpoint
CREATE INDEX `entity_links_campaign_idx` ON `entity_links` (`campaign_id`);--> statement-breakpoint
CREATE TABLE `journals` (
	`id` text PRIMARY KEY NOT NULL,
	`character_profile_id` text NOT NULL,
	`campaign_id` text,
	`body` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`character_profile_id`) REFERENCES `character_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `journals_character_idx` ON `journals` (`character_profile_id`);--> statement-breakpoint
CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`url` text NOT NULL,
	`kind` text NOT NULL,
	`owner_entity_id` text,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `media_campaign_idx` ON `media` (`campaign_id`);--> statement-breakpoint
CREATE TABLE `memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`character_profile_id` text,
	`joined_at` integer NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`character_profile_id`) REFERENCES `character_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `memberships_campaign_user_idx` ON `memberships` (`campaign_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `memberships_user_idx` ON `memberships` (`user_id`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`display_name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_username_unique` ON `profiles` (`username`);--> statement-breakpoint
CREATE TABLE `recap_events` (
	`id` text PRIMARY KEY NOT NULL,
	`recap_id` text NOT NULL,
	`kind` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`visitor_hash` text,
	FOREIGN KEY (`recap_id`) REFERENCES `recaps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `recap_events_recap_idx` ON `recap_events` (`recap_id`);--> statement-breakpoint
CREATE TABLE `recaps` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`body` text,
	`tone` text DEFAULT 'plain' NOT NULL,
	`share_slug` text NOT NULL,
	`published_at` integer,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recaps_share_slug_unique` ON `recaps` (`share_slug`);--> statement-breakpoint
CREATE INDEX `recaps_session_idx` ON `recaps` (`session_id`);--> statement-breakpoint
CREATE TABLE `reveals` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_id` text NOT NULL,
	`block_ref` text,
	`revealed_to` text NOT NULL,
	`revealed_to_user_id` text,
	`revealed_at` integer NOT NULL,
	FOREIGN KEY (`entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`revealed_to_user_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `reveals_entity_idx` ON `reveals` (`entity_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`number` integer NOT NULL,
	`title` text,
	`played_on` text,
	`body` text,
	`status` text DEFAULT 'planned' NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_campaign_number_idx` ON `sessions` (`campaign_id`,`number`);--> statement-breakpoint
CREATE TABLE `sync_log` (
	`id` text PRIMARY KEY NOT NULL,
	`table_name` text NOT NULL,
	`row_id` text NOT NULL,
	`op` text NOT NULL,
	`updated_at` integer NOT NULL,
	`device_id` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sync_log_row_idx` ON `sync_log` (`table_name`,`row_id`);