ALTER TABLE `sessions` ADD `task_id` text;--> statement-breakpoint
CREATE INDEX `sessions_owner_task_idx` ON `sessions` (`user_id`,`task_id`);