ALTER TABLE `users` ADD `countryCode` varchar(2);
ALTER TABLE `ads` ADD `countryCode` varchar(2) NOT NULL DEFAULT 'SA';
ALTER TABLE `ad_revisions` ADD `customCityName` varchar(120);
CREATE INDEX `ads_country_feed_idx` ON `ads` (`adStatus`,`countryCode`,`activatedAt`);

CREATE TABLE `otp_challenges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`phone` varchar(32) NOT NULL,
	`codeHash` varchar(128) NOT NULL,
	`purpose` enum('login','register_advertiser') NOT NULL DEFAULT 'login',
	`attempts` int NOT NULL DEFAULT 0,
	`maxAttempts` int NOT NULL DEFAULT 5,
	`expiresAt` timestamp NOT NULL,
	`consumedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `otp_challenges_id` PRIMARY KEY(`id`)
);
CREATE INDEX `otp_challenges_phone_idx` ON `otp_challenges` (`phone`,`purpose`,`createdAt`);

CREATE TABLE `payment_intents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicId` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`adId` int,
	`provider` varchar(64) NOT NULL,
	`environment` enum('sandbox','production') NOT NULL DEFAULT 'sandbox',
	`amount` int NOT NULL,
	`currency` varchar(3) NOT NULL,
	`status` enum('not_required','pending','processing','paid','failed','cancelled','refunded','partially_refunded') NOT NULL DEFAULT 'pending',
	`externalId` varchar(255),
	`clientSecret` varchar(255),
	`webhookVerified` tinyint NOT NULL DEFAULT 0,
	`metadata` json,
	`paidAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payment_intents_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_intents_publicId_unique` UNIQUE(`publicId`)
);
ALTER TABLE `payment_intents` ADD CONSTRAINT `payment_intents_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `payment_intents` ADD CONSTRAINT `payment_intents_adId_ads_id_fk` FOREIGN KEY (`adId`) REFERENCES `ads`(`id`) ON DELETE no action ON UPDATE no action;
CREATE INDEX `payment_intents_ad_idx` ON `payment_intents` (`adId`,`status`);
