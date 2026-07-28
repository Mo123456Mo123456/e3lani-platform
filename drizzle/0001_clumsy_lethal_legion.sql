CREATE TABLE `adContacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`revisionId` int NOT NULL,
	`type` enum('store','product','whatsapp','phone') NOT NULL,
	`value` text NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	CONSTRAINT `adContacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `adEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adId` int NOT NULL,
	`userId` int,
	`anonymousId` varchar(128),
	`type` enum('impression','view','save','share','store_click','product_click','whatsapp_click','phone_click','report') NOT NULL,
	`dedupeKey` varchar(180) NOT NULL,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `adEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `adEvents_dedupeKey_unique` UNIQUE(`dedupeKey`)
);
--> statement-breakpoint
CREATE TABLE `adMedia` (
	`id` int AUTO_INCREMENT NOT NULL,
	`revisionId` int NOT NULL,
	`mediaAssetId` int NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`altTextAr` varchar(220),
	`altTextEn` varchar(220),
	CONSTRAINT `adMedia_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `adRevisions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adId` int NOT NULL,
	`version` int NOT NULL,
	`title` varchar(140) NOT NULL,
	`description` text NOT NULL,
	`audienceScope` enum('city','region','kingdom') NOT NULL DEFAULT 'city',
	`reviewStatus` enum('draft','queued','in_review','approved','changes_requested','rejected') NOT NULL DEFAULT 'draft',
	`reviewReason` text,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `adRevisions_id` PRIMARY KEY(`id`),
	CONSTRAINT `ad_revision_version_idx` UNIQUE(`adId`,`version`)
);
--> statement-breakpoint
CREATE TABLE `ads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicId` varchar(32) NOT NULL,
	`ownerId` int NOT NULL,
	`businessProfileId` int,
	`categoryId` int NOT NULL,
	`cityId` int NOT NULL,
	`status` enum('draft','awaiting_payment','pending_review','changes_requested','active','paused','rejected','expired','removed') NOT NULL DEFAULT 'draft',
	`paymentStatus` enum('unpaid','pending','paid','failed','refunded') NOT NULL DEFAULT 'unpaid',
	`mediaStatus` enum('empty','uploading','processing','ready','failed') NOT NULL DEFAULT 'empty',
	`moderationStatus` enum('not_submitted','queued','in_review','approved','changes_requested','rejected') NOT NULL DEFAULT 'not_submitted',
	`currentRevisionId` int,
	`pendingRevisionId` int,
	`activatedAt` timestamp,
	`expiresAt` timestamp,
	`lastRepublishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deletedAt` timestamp,
	CONSTRAINT `ads_id` PRIMARY KEY(`id`),
	CONSTRAINT `ads_publicId_unique` UNIQUE(`publicId`)
);
--> statement-breakpoint
CREATE TABLE `auditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorId` int,
	`actorRole` varchar(40) NOT NULL,
	`action` varchar(120) NOT NULL,
	`targetType` varchar(80) NOT NULL,
	`targetId` varchar(80) NOT NULL,
	`reason` text NOT NULL,
	`beforeValue` json,
	`afterValue` json,
	`ipAddress` varchar(64),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `businessProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`slug` varchar(100) NOT NULL,
	`displayName` varchar(160) NOT NULL,
	`legalName` varchar(200),
	`bio` text,
	`logoUrl` text,
	`coverUrl` text,
	`websiteUrl` text,
	`verificationStatus` enum('unverified','pending','verified','rejected') NOT NULL DEFAULT 'unverified',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `businessProfiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `businessProfiles_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`parentId` int,
	`slug` varchar(80) NOT NULL,
	`nameAr` varchar(120) NOT NULL,
	`nameEn` varchar(120) NOT NULL,
	`icon` varchar(80),
	`reviewPolicy` enum('standard','strict') NOT NULL DEFAULT 'standard',
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `cities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(64) NOT NULL,
	`nameAr` varchar(120) NOT NULL,
	`nameEn` varchar(120) NOT NULL,
	`region` varchar(120) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	CONSTRAINT `cities_id` PRIMARY KEY(`id`),
	CONSTRAINT `cities_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `favorites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`adId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `favorites_id` PRIMARY KEY(`id`),
	CONSTRAINT `favorites_unique_idx` UNIQUE(`userId`,`adId`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicId` varchar(40) NOT NULL,
	`invoiceNumber` varchar(60) NOT NULL,
	`orderId` int NOT NULL,
	`ownerId` int NOT NULL,
	`totalHalalas` int NOT NULL,
	`vatHalalas` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'SAR',
	`issuedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `invoices_publicId_unique` UNIQUE(`publicId`),
	CONSTRAINT `invoices_invoiceNumber_unique` UNIQUE(`invoiceNumber`)
);
--> statement-breakpoint
CREATE TABLE `mediaAssets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`mediaType` enum('image','video') NOT NULL,
	`storageKey` varchar(500) NOT NULL,
	`originalUrl` text NOT NULL,
	`mimeType` varchar(120) NOT NULL,
	`bytes` int NOT NULL,
	`width` int,
	`height` int,
	`durationMs` int,
	`status` enum('uploading','processing','ready','failed') NOT NULL DEFAULT 'ready',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mediaAssets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` varchar(80) NOT NULL,
	`title` varchar(180) NOT NULL,
	`body` text NOT NULL,
	`entityType` varchar(60),
	`entityId` varchar(80),
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicId` varchar(40) NOT NULL,
	`ownerId` int NOT NULL,
	`adId` int NOT NULL,
	`kind` enum('publication','extension','republish','promotion') NOT NULL DEFAULT 'publication',
	`status` enum('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
	`channel` enum('web','apple_iap','google_play') NOT NULL,
	`idempotencyKey` varchar(160) NOT NULL,
	`subtotalHalalas` int NOT NULL,
	`vatHalalas` int NOT NULL,
	`totalHalalas` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'SAR',
	`pricingSnapshot` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`paidAt` timestamp,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_publicId_unique` UNIQUE(`publicId`),
	CONSTRAINT `orders_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`provider` varchar(100) NOT NULL,
	`providerReference` varchar(200),
	`status` enum('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
	`receipt` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`confirmedAt` timestamp,
	CONSTRAINT `payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pricingVersions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`version` int NOT NULL,
	`basePriceHalalas` int NOT NULL DEFAULT 5900,
	`vatBasisPoints` int NOT NULL DEFAULT 1500,
	`currency` varchar(3) NOT NULL DEFAULT 'SAR',
	`rules` json NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pricingVersions_id` PRIMARY KEY(`id`),
	CONSTRAINT `pricingVersions_version_unique` UNIQUE(`version`)
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`phone` varchar(32),
	`displayName` varchar(140),
	`bio` text,
	`cityId` int,
	`accountType` enum('viewer','advertiser','brand') NOT NULL DEFAULT 'viewer',
	`preferredLanguage` enum('ar','en') NOT NULL DEFAULT 'ar',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `profiles_userId_unique` UNIQUE(`userId`),
	CONSTRAINT `profiles_user_idx` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicId` varchar(40) NOT NULL,
	`reporterId` int NOT NULL,
	`adId` int NOT NULL,
	`reason` varchar(160) NOT NULL,
	`details` text,
	`status` enum('open','resolved','dismissed') NOT NULL DEFAULT 'open',
	`resolution` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`resolvedAt` timestamp,
	CONSTRAINT `reports_id` PRIMARY KEY(`id`),
	CONSTRAINT `reports_publicId_unique` UNIQUE(`publicId`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','reviewer','support','finance','admin','owner') NOT NULL DEFAULT 'user';--> statement-breakpoint
CREATE INDEX `events_ad_type_idx` ON `adEvents` (`adId`,`type`);--> statement-breakpoint
CREATE INDEX `ads_feed_idx` ON `ads` (`status`,`cityId`,`categoryId`);--> statement-breakpoint
CREATE INDEX `ads_owner_idx` ON `ads` (`ownerId`);--> statement-breakpoint
CREATE INDEX `audit_target_idx` ON `auditLogs` (`targetType`,`targetId`);--> statement-breakpoint
CREATE INDEX `business_owner_idx` ON `businessProfiles` (`ownerId`);--> statement-breakpoint
CREATE INDEX `orders_owner_idx` ON `orders` (`ownerId`);--> statement-breakpoint
CREATE INDEX `orders_ad_idx` ON `orders` (`adId`);