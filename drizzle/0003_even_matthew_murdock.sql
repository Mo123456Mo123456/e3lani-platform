CREATE TABLE `auth_rate_limits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scope` varchar(48) NOT NULL,
	`keyHash` varchar(64) NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`windowStartedAt` timestamp NOT NULL DEFAULT (now()),
	`blockedUntil` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `auth_rate_limits_id` PRIMARY KEY(`id`),
	CONSTRAINT `auth_rate_limits_scope_key_unique` UNIQUE(`scope`,`keyHash`)
);
--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tokenId` varchar(64) NOT NULL,
	`clientType` enum('web','native') NOT NULL,
	`userAgentHash` varchar(64),
	`ipHash` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	`revokedAt` timestamp,
	CONSTRAINT `auth_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `auth_sessions_tokenId_unique` UNIQUE(`tokenId`)
);
--> statement-breakpoint
ALTER TABLE `auth_sessions` ADD CONSTRAINT `auth_sessions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `auth_rate_limits_blocked_idx` ON `auth_rate_limits` (`blockedUntil`);--> statement-breakpoint
CREATE INDEX `auth_sessions_user_active_idx` ON `auth_sessions` (`userId`,`revokedAt`,`expiresAt`);