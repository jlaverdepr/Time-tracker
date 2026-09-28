CREATE TABLE `todo_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer NOT NULL,
	`list_id` integer NOT NULL,
	`date` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`copied_from_date` text,
	`copied_from_entry_id` integer,
	`completed_at` integer,
	`cleared_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `todo_tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`list_id`) REFERENCES `todo_lists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`copied_from_entry_id`) REFERENCES `todo_entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `todo_entries_task_date_idx` ON `todo_entries` (`task_id`,`date`);--> statement-breakpoint
CREATE INDEX `todo_entries_date_idx` ON `todo_entries` (`date`);--> statement-breakpoint
CREATE INDEX `todo_entries_copied_from_idx` ON `todo_entries` (`copied_from_entry_id`);--> statement-breakpoint
ALTER TABLE `todo_lists` ADD `carry_mode` text DEFAULT 'carry' NOT NULL;--> statement-breakpoint
ALTER TABLE `todo_lists` ADD `last_rolled_date` text;--> statement-breakpoint
-- ── Data migration: old task/completion/active-log model → day entries ──
UPDATE `todo_lists` SET `carry_mode` = CASE WHEN `reset_daily` = 1 THEN 'repeat' ELSE 'carry' END;
--> statement-breakpoint
-- 1. Every (task, day) the old active log recorded, done if it had a completion that day.
--    A carry-list entry that was also active the previous day was carried from it.
INSERT INTO `todo_entries` (`task_id`, `list_id`, `date`, `status`, `copied_from_date`, `completed_at`, `cleared_at`)
SELECT a.`task_id`, t.`list_id`, a.`date`,
  CASE WHEN c.`id` IS NOT NULL THEN 'done' ELSE 'pending' END,
  CASE WHEN l.`reset_daily` = 0 AND EXISTS (
    SELECT 1 FROM `todo_active_log` p WHERE p.`task_id` = a.`task_id` AND p.`date` = date(a.`date`, '-1 day')
  ) THEN date(a.`date`, '-1 day') END,
  c.`completed_at`,
  CASE WHEN c.`id` IS NOT NULL THEN t.`cleared_at` END
FROM `todo_active_log` a
JOIN `todo_tasks` t ON t.`id` = a.`task_id`
JOIN `todo_lists` l ON l.`id` = t.`list_id`
LEFT JOIN `todo_task_completions` c ON c.`task_id` = a.`task_id` AND c.`date` = a.`date`;
--> statement-breakpoint
-- 2. Completions recorded on days the active log didn't cover.
INSERT OR IGNORE INTO `todo_entries` (`task_id`, `list_id`, `date`, `status`, `completed_at`, `cleared_at`)
SELECT c.`task_id`, t.`list_id`, c.`date`, 'done', c.`completed_at`, t.`cleared_at`
FROM `todo_task_completions` c
JOIN `todo_tasks` t ON t.`id` = c.`task_id`;
--> statement-breakpoint
-- 3. Tasks with no history yet (scheduled ahead, or created since the log was last rebuilt).
INSERT OR IGNORE INTO `todo_entries` (`task_id`, `list_id`, `date`, `status`)
SELECT t.`id`, t.`list_id`, COALESCE(t.`scheduled_date`, date(t.`created_at`, 'unixepoch', 'localtime')), 'pending'
FROM `todo_tasks` t
WHERE NOT EXISTS (SELECT 1 FROM `todo_entries` e WHERE e.`task_id` = t.`id`);
--> statement-breakpoint
-- 4. Link each carried entry to the entry it came from.
UPDATE `todo_entries` SET `copied_from_entry_id` = (
  SELECT p.`id` FROM `todo_entries` p
  WHERE p.`task_id` = `todo_entries`.`task_id` AND p.`date` = `todo_entries`.`copied_from_date`
) WHERE `copied_from_date` IS NOT NULL;
--> statement-breakpoint
-- 5. The old log was materialized up to its last rebuild; the rollover catches up from there.
UPDATE `todo_lists` SET `last_rolled_date` = (
  SELECT max(a.`date`) FROM `todo_active_log` a
  JOIN `todo_tasks` t ON t.`id` = a.`task_id`
  WHERE t.`list_id` = `todo_lists`.`id` AND a.`date` <= date('now', 'localtime')
);
