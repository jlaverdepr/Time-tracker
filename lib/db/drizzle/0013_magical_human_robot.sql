CREATE TABLE `todo_subtask_checks` (
	`subtask_id` integer NOT NULL,
	`entry_id` integer NOT NULL,
	`completed_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`subtask_id`, `entry_id`),
	FOREIGN KEY (`subtask_id`) REFERENCES `todo_subtasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entry_id`) REFERENCES `todo_entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `todo_subtask_checks_entry_idx` ON `todo_subtask_checks` (`entry_id`);--> statement-breakpoint
CREATE TABLE `todo_subtasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer NOT NULL,
	`text` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `todo_tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `todo_subtasks_task_idx` ON `todo_subtasks` (`task_id`);