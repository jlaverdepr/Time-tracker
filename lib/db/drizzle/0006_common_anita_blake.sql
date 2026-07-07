CREATE TABLE `todo_task_completions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer NOT NULL,
	`date` text NOT NULL,
	`completed_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `todo_tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `todo_task_completions_task_date_idx` ON `todo_task_completions` (`task_id`,`date`);--> statement-breakpoint
ALTER TABLE `todo_lists` ADD `auto_clear_completed` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `todo_tasks` ADD `cleared_at` integer;--> statement-breakpoint
ALTER TABLE `todo_tasks` ADD `scheduled_date` text;--> statement-breakpoint
ALTER TABLE `todo_tasks` ADD `reminder_time` text;