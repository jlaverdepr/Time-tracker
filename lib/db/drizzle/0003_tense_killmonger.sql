ALTER TABLE `gym_workout_entries` ADD `weight_failure1` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `gym_workout_entries` ADD `weight_failure2` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `gym_workout_entries` ADD `weight_failure3` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `gym_workout_entries` ADD `weight_failure4` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `gym_workout_entries` ADD `weight_failure5` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `gym_workout_entries` ADD `warmup1` real;--> statement-breakpoint
ALTER TABLE `gym_workout_entries` ADD `warmup2` real;--> statement-breakpoint
ALTER TABLE `gym_workout_entries` ADD `warmup3` real;--> statement-breakpoint
ALTER TABLE `gym_workout_entries` ADD `warmup4` real;--> statement-breakpoint
ALTER TABLE `gym_workout_entries` ADD `warmup5` real;--> statement-breakpoint
ALTER TABLE `gym_workouts` ADD `title` text;