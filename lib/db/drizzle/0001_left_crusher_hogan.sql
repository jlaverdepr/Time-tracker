ALTER TABLE `todo_tasks` ADD `project_id` integer REFERENCES projects(id);--> statement-breakpoint
ALTER TABLE `todo_tasks` ADD `subproject_id` integer REFERENCES subprojects(id);