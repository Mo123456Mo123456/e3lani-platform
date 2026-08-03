ALTER TABLE `cities` ADD `countryId` int;
CREATE INDEX `cities_country_idx` ON `cities` (`countryId`);
ALTER TABLE `cities` ADD CONSTRAINT `cities_countryId_countries_id_fk` FOREIGN KEY (`countryId`) REFERENCES `countries`(`id`) ON DELETE no action ON UPDATE no action;

-- Best-effort backfill: map existing cities to SA when present, else first active country.
UPDATE `cities` c
SET c.`countryId` = (
  SELECT co.`id` FROM `countries` co WHERE co.`code` = 'SA' LIMIT 1
)
WHERE c.`countryId` IS NULL;

UPDATE `cities` c
SET c.`countryId` = (
  SELECT co.`id` FROM `countries` co WHERE co.`isActive` = 1 ORDER BY co.`sortOrder` ASC, co.`id` ASC LIMIT 1
)
WHERE c.`countryId` IS NULL;

CREATE TABLE `coupon_redemptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`couponId` int NOT NULL,
	`userId` int NOT NULL,
	`adId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `coupon_redemptions_id` PRIMARY KEY(`id`)
);
ALTER TABLE `coupon_redemptions` ADD CONSTRAINT `coupon_redemptions_couponId_coupons_id_fk` FOREIGN KEY (`couponId`) REFERENCES `coupons`(`id`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `coupon_redemptions` ADD CONSTRAINT `coupon_redemptions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `coupon_redemptions` ADD CONSTRAINT `coupon_redemptions_adId_ads_id_fk` FOREIGN KEY (`adId`) REFERENCES `ads`(`id`) ON DELETE no action ON UPDATE no action;
CREATE INDEX `coupon_redemptions_user_idx` ON `coupon_redemptions` (`userId`,`couponId`);

CREATE TABLE `pricing_exemptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicId` varchar(32) NOT NULL,
	`subjectType` enum('user','brand') NOT NULL,
	`subjectRef` varchar(64) NOT NULL,
	`reason` varchar(240),
	`startsAt` timestamp,
	`endsAt` timestamp,
	`isActive` tinyint NOT NULL DEFAULT 1,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pricing_exemptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `pricing_exemptions_publicId_unique` UNIQUE(`publicId`)
);
CREATE INDEX `pricing_exemptions_subject_idx` ON `pricing_exemptions` (`subjectType`,`subjectRef`,`isActive`);
ALTER TABLE `pricing_exemptions` ADD CONSTRAINT `pricing_exemptions_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;

CREATE TABLE `visitor_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`anonymousId` varchar(128) NOT NULL,
	`prefsJson` json NOT NULL,
	`savedAdPublicIds` json,
	`mergedUserId` int,
	`mergedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `visitor_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `visitor_sessions_anonymousId_unique` UNIQUE(`anonymousId`)
);
ALTER TABLE `visitor_sessions` ADD CONSTRAINT `visitor_sessions_mergedUserId_users_id_fk` FOREIGN KEY (`mergedUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;

ALTER TABLE `coupons` ADD `name` varchar(160);
ALTER TABLE `coupons` ADD `updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP;
