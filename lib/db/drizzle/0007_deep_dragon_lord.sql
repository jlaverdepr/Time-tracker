CREATE TABLE `todo_active_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer NOT NULL,
	`date` text NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `todo_tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `todo_active_log_task_date_idx` ON `todo_active_log` (`task_id`,`date`);