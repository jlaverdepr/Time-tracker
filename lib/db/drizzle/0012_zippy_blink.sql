DROP TABLE `todo_active_log`;--> statement-breakpoint
DROP TABLE `todo_task_completions`;--> statement-breakpoint
ALTER TABLE `todo_lists` DROP COLUMN `reset_daily`;--> statement-breakpoint
ALTER TABLE `todo_tasks` DROP COLUMN `completed_at`;--> statement-breakpoint
ALTER TABLE `todo_tasks` DROP COLUMN `completed_date`;--> statement-breakpoint
ALTER TABLE `todo_tasks` DROP COLUMN `cleared_at`;--> statement-breakpoint
ALTER TABLE `todo_tasks` DROP COLUMN `scheduled_date`;