CREATE TABLE `countries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(2) NOT NULL,
	`nameAr` varchar(120) NOT NULL,
	`nameEn` varchar(120) NOT NULL,
	`flagEmoji` varchar(16) NOT NULL,
	`dialCode` varchar(8) NOT NULL,
	`currency` varchar(3) NOT NULL,
	`defaultLocale` varchar(8) NOT NULL DEFAULT 'ar',
	`timezone` varchar(64) NOT NULL DEFAULT 'Asia/Riyadh',
	`paymentProviders` json NOT NULL,
	`isActive` tinyint NOT NULL DEFAULT 1,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `countries_id` PRIMARY KEY(`id`),
	CONSTRAINT `countries_code_unique` UNIQUE(`code`)
);

CREATE TABLE `scoped_pricing_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicId` varchar(32) NOT NULL,
	`name` varchar(160) NOT NULL,
	`scopeType` enum('global','country','category','account_type','user','brand','campaign') NOT NULL,
	`countryId` int,
	`categoryId` int,
	`accountType` varchar(32),
	`adType` varchar(32),
	`basePrice` int NOT NULL,
	`discountPrice` int,
	`currency` varchar(3) NOT NULL DEFAULT 'SAR',
	`taxRate` int NOT NULL DEFAULT 0,
	`startsAt` timestamp,
	`endsAt` timestamp,
	`isActive` tinyint NOT NULL DEFAULT 1,
	`priority` int NOT NULL DEFAULT 0,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scoped_pricing_rules_id` PRIMARY KEY(`id`),
	CONSTRAINT `scoped_pricing_rules_publicId_unique` UNIQUE(`publicId`)
);

CREATE TABLE `coupons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(64) NOT NULL,
	`discountType` enum('percent','fixed') NOT NULL,
	`discountValue` int NOT NULL,
	`countryId` int,
	`usageLimit` int,
	`usageLimitPerUser` int,
	`startsAt` timestamp,
	`expiresAt` timestamp,
	`isActive` tinyint NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `coupons_id` PRIMARY KEY(`id`),
	CONSTRAINT `coupons_code_unique` UNIQUE(`code`)
);

CREATE TABLE `ad_price_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adId` int NOT NULL,
	`basePrice` int NOT NULL,
	`discount` int NOT NULL DEFAULT 0,
	`tax` int NOT NULL DEFAULT 0,
	`finalPrice` int NOT NULL,
	`currency` varchar(3) NOT NULL,
	`pricingRuleId` int,
	`freeReason` varchar(120),
	`offerOrCoupon` varchar(160),
	`paymentStatus` enum('not_required','pending','processing','paid','failed','cancelled','refunded','partially_refunded') NOT NULL DEFAULT 'not_required',
	`snapshotJson` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ad_price_snapshots_id` PRIMARY KEY(`id`)
);

ALTER TABLE `scoped_pricing_rules` ADD CONSTRAINT `scoped_pricing_rules_countryId_countries_id_fk` FOREIGN KEY (`countryId`) REFERENCES `countries`(`id`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `scoped_pricing_rules` ADD CONSTRAINT `scoped_pricing_rules_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `coupons` ADD CONSTRAINT `coupons_countryId_countries_id_fk` FOREIGN KEY (`countryId`) REFERENCES `countries`(`id`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `ad_price_snapshots` ADD CONSTRAINT `ad_price_snapshots_adId_ads_id_fk` FOREIGN KEY (`adId`) REFERENCES `ads`(`id`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `ad_price_snapshots` ADD CONSTRAINT `ad_price_snapshots_pricingRuleId_scoped_pricing_rules_id_fk` FOREIGN KEY (`pricingRuleId`) REFERENCES `scoped_pricing_rules`(`id`) ON DELETE no action ON UPDATE no action;
CREATE INDEX `scoped_pricing_rules_active_idx` ON `scoped_pricing_rules` (`isActive`,`priority`);
CREATE INDEX `ad_price_snapshots_ad_idx` ON `ad_price_snapshots` (`adId`);
