CREATE TABLE `gym_workout_sets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entry_id` integer NOT NULL,
	`is_warmup` integer DEFAULT false NOT NULL,
	`set_index` integer NOT NULL,
	`reps` integer,
	`weight` real,
	`failure` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `gym_workout_entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `gym_workout_entries` DROP COLUMN `weight1`;--> statement-breakpoint
ALTER TABLE `gym_workout_entries` DROP COLUMN `weight2`;--> statement-breakpoint
ALTER TABLE `gym_workout_entries` DROP COLUMN `weight3`;--> statement-breakpoint
ALTER TABLE `gym_workout_entries` DROP COLUMN `weight4`;--> statement-breakpoint
ALTER TABLE `gym_workout_entries` DROP COLUMN `weight5`;--> statement-breakpoint
ALTER TABLE `gym_workout_entries` DROP COLUMN `weight_failure1`;--> statement-breakpoint
ALTER TABLE `gym_workout_entries` DROP COLUMN `weight_failure2`;--> statement-breakpoint
ALTER TABLE `gym_workout_entries` DROP COLUMN `weight_failure3`;--> statement-breakpoint
ALTER TABLE `gym_workout_entries` DROP COLUMN `weight_failure4`;--> statement-breakpoint
ALTER TABLE `gym_workout_entries` DROP COLUMN `weight_failure5`;--> statement-breakpoint
ALTER TABLE `gym_workout_entries` DROP COLUMN `warmup1`;--> statement-breakpoint
ALTER TABLE `gym_workout_entries` DROP COLUMN `warmup2`;--> statement-breakpoint
ALTER TABLE `gym_workout_entries` DROP COLUMN `warmup3`;--> statement-breakpoint
ALTER TABLE `gym_workout_entries` DROP COLUMN `warmup4`;--> statement-breakpoint
ALTER TABLE `gym_workout_entries` DROP COLUMN `warmup5`;