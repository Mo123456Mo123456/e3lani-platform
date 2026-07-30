-- E3lani legacy CamelCase table definitions
-- Recovery source: git HEAD:drizzle/0001_clumsy_lethal_legion.sql
-- Pre-deletion verification: all four tables had zero rows and no incoming or outgoing foreign keys.
-- This file contains definitions only and is intentionally not part of the active migration chain.

CREATE TABLE `adContacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`revisionId` int NOT NULL,
	`type` enum('store','product','whatsapp','phone') NOT NULL,
	`value` text NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	CONSTRAINT `adContacts_id` PRIMARY KEY(`id`)
);

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

CREATE TABLE `adMedia` (
	`id` int AUTO_INCREMENT NOT NULL,
	`revisionId` int NOT NULL,
	`mediaAssetId` int NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`altTextAr` varchar(220),
	`altTextEn` varchar(220),
	CONSTRAINT `adMedia_id` PRIMARY KEY(`id`)
);

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
