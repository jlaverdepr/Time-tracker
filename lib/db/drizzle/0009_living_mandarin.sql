ALTER TABLE `gym_runs` ADD `duration_seconds` integer;
--> statement-breakpoint
UPDATE `gym_runs` SET `duration_seconds` = `duration_minutes` * 60 WHERE `duration_minutes` IS NOT NULL;