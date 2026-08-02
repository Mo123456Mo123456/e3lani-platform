-- Signed guest ownership. Existing account-owned rows remain unchanged.
ALTER TABLE `visitor_sessions`
  ADD `status` enum('active','suspended','merged') NOT NULL DEFAULT 'active',
  ADD `tokenVersion` int NOT NULL DEFAULT 1,
  ADD `lastSeenAt` timestamp NOT NULL DEFAULT (now());

CREATE TABLE `advertiser_profiles` (
  `id` int AUTO_INCREMENT NOT NULL,
  `publicId` varchar(32) NOT NULL,
  `userId` int,
  `visitorSessionId` int,
  `username` varchar(64) NOT NULL,
  `displayName` varchar(120) NOT NULL,
  `avatarUrl` varchar(1024),
  `coverUrl` varchar(1024),
  `bio` varchar(280),
  `isVerified` tinyint NOT NULL DEFAULT 0,
  `tiktokUrl` varchar(1024),
  `snapchatUrl` varchar(1024),
  `instagramUrl` varchar(1024),
  `whatsappUrl` varchar(1024),
  `websiteUrl` varchar(1024),
  `storeUrl` varchar(1024),
  `status` enum('active','suspended') NOT NULL DEFAULT 'active',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `advertiser_profiles_id` PRIMARY KEY(`id`),
  CONSTRAINT `advertiser_profiles_publicId_unique` UNIQUE(`publicId`),
  CONSTRAINT `advertiser_profiles_username_unique` UNIQUE(`username`),
  CONSTRAINT `advertiser_profiles_user_unique` UNIQUE(`userId`),
  CONSTRAINT `advertiser_profiles_visitor_unique` UNIQUE(`visitorSessionId`),
  CONSTRAINT `advertiser_profiles_owner_check` CHECK (
    (`userId` IS NOT NULL AND `visitorSessionId` IS NULL) OR
    (`userId` IS NULL AND `visitorSessionId` IS NOT NULL)
  )
);
ALTER TABLE `advertiser_profiles`
  ADD CONSTRAINT `advertiser_profiles_userId_users_id_fk`
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `advertiser_profiles`
  ADD CONSTRAINT `advertiser_profiles_visitorId_visitor_sessions_id_fk`
  FOREIGN KEY (`visitorSessionId`) REFERENCES `visitor_sessions`(`id`) ON DELETE no action ON UPDATE no action;

ALTER TABLE `media_assets`
  MODIFY `ownerId` int NULL,
  ADD `ownerVisitorSessionId` int;
ALTER TABLE `media_assets`
  ADD CONSTRAINT `media_assets_ownerVisitor_visitor_sessions_id_fk`
  FOREIGN KEY (`ownerVisitorSessionId`) REFERENCES `visitor_sessions`(`id`) ON DELETE no action ON UPDATE no action;
CREATE INDEX `media_assets_visitor_owner_idx` ON `media_assets` (`ownerVisitorSessionId`,`createdAt`);

ALTER TABLE `ads`
  MODIFY `ownerId` int NULL,
  ADD `ownerVisitorSessionId` int,
  ADD `advertiserProfileId` int;
ALTER TABLE `ads`
  ADD CONSTRAINT `ads_ownerVisitor_visitor_sessions_id_fk`
  FOREIGN KEY (`ownerVisitorSessionId`) REFERENCES `visitor_sessions`(`id`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `ads`
  ADD CONSTRAINT `ads_advertiserProfile_advertiser_profiles_id_fk`
  FOREIGN KEY (`advertiserProfileId`) REFERENCES `advertiser_profiles`(`id`) ON DELETE no action ON UPDATE no action;
CREATE INDEX `ads_visitor_owner_idx` ON `ads` (`ownerVisitorSessionId`,`adStatus`);
CREATE INDEX `ads_advertiser_profile_idx` ON `ads` (`advertiserProfileId`,`adStatus`);

ALTER TABLE `ad_revisions`
  MODIFY `createdBy` int NULL,
  ADD `createdByVisitorSessionId` int;
ALTER TABLE `ad_revisions`
  ADD CONSTRAINT `ad_revisions_createdByVisitor_visitor_sessions_id_fk`
  FOREIGN KEY (`createdByVisitorSessionId`) REFERENCES `visitor_sessions`(`id`) ON DELETE no action ON UPDATE no action;

CREATE TABLE `profile_posts` (
  `id` int AUTO_INCREMENT NOT NULL,
  `publicId` varchar(32) NOT NULL,
  `advertiserProfileId` int NOT NULL,
  `ownerId` int,
  `ownerVisitorSessionId` int,
  `title` varchar(160) NOT NULL,
  `description` text NOT NULL,
  `postStatus` enum('active','paused','removed') NOT NULL DEFAULT 'active',
  `moderationStatus` enum('not_submitted','queued','approved','rejected') NOT NULL DEFAULT 'approved',
  `views` int NOT NULL DEFAULT 0,
  `shares` int NOT NULL DEFAULT 0,
  `deletedAt` timestamp,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `profile_posts_id` PRIMARY KEY(`id`),
  CONSTRAINT `profile_posts_publicId_unique` UNIQUE(`publicId`),
  CONSTRAINT `profile_posts_owner_check` CHECK (
    (`ownerId` IS NOT NULL AND `ownerVisitorSessionId` IS NULL) OR
    (`ownerId` IS NULL AND `ownerVisitorSessionId` IS NOT NULL)
  )
);
ALTER TABLE `profile_posts`
  ADD CONSTRAINT `profile_posts_profile_advertiser_profiles_id_fk`
  FOREIGN KEY (`advertiserProfileId`) REFERENCES `advertiser_profiles`(`id`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `profile_posts`
  ADD CONSTRAINT `profile_posts_owner_users_id_fk`
  FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `profile_posts`
  ADD CONSTRAINT `profile_posts_ownerVisitor_visitor_sessions_id_fk`
  FOREIGN KEY (`ownerVisitorSessionId`) REFERENCES `visitor_sessions`(`id`) ON DELETE no action ON UPDATE no action;
CREATE INDEX `profile_posts_profile_feed_idx` ON `profile_posts` (`advertiserProfileId`,`postStatus`,`createdAt`);
CREATE INDEX `profile_posts_user_owner_idx` ON `profile_posts` (`ownerId`,`createdAt`);
CREATE INDEX `profile_posts_visitor_owner_idx` ON `profile_posts` (`ownerVisitorSessionId`,`createdAt`);

CREATE TABLE `profile_post_media` (
  `id` int AUTO_INCREMENT NOT NULL,
  `profilePostId` int NOT NULL,
  `mediaAssetId` int NOT NULL,
  `sortOrder` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `profile_post_media_id` PRIMARY KEY(`id`),
  CONSTRAINT `profile_post_media_order_unique` UNIQUE(`profilePostId`,`sortOrder`),
  CONSTRAINT `profile_post_media_asset_unique` UNIQUE(`profilePostId`,`mediaAssetId`)
);
ALTER TABLE `profile_post_media`
  ADD CONSTRAINT `profile_post_media_post_profile_posts_id_fk`
  FOREIGN KEY (`profilePostId`) REFERENCES `profile_posts`(`id`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `profile_post_media`
  ADD CONSTRAINT `profile_post_media_asset_media_assets_id_fk`
  FOREIGN KEY (`mediaAssetId`) REFERENCES `media_assets`(`id`) ON DELETE no action ON UPDATE no action;

CREATE TABLE `identity_action_events` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int,
  `visitorSessionId` int,
  `actionType` enum('main_ad','profile_post','report') NOT NULL,
  `contentPublicId` varchar(32),
  `idempotencyKey` varchar(96) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `identity_action_events_id` PRIMARY KEY(`id`),
  CONSTRAINT `identity_action_idempotency_unique` UNIQUE(`idempotencyKey`),
  CONSTRAINT `identity_action_owner_check` CHECK (
    (`userId` IS NOT NULL AND `visitorSessionId` IS NULL) OR
    (`userId` IS NULL AND `visitorSessionId` IS NOT NULL)
  )
);
ALTER TABLE `identity_action_events`
  ADD CONSTRAINT `identity_action_user_users_id_fk`
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `identity_action_events`
  ADD CONSTRAINT `identity_action_visitor_visitor_sessions_id_fk`
  FOREIGN KEY (`visitorSessionId`) REFERENCES `visitor_sessions`(`id`) ON DELETE no action ON UPDATE no action;
CREATE INDEX `identity_action_user_window_idx` ON `identity_action_events` (`userId`,`actionType`,`createdAt`);
CREATE INDEX `identity_action_visitor_window_idx` ON `identity_action_events` (`visitorSessionId`,`actionType`,`createdAt`);

CREATE TABLE `profile_follows` (
  `id` int AUTO_INCREMENT NOT NULL,
  `advertiserProfileId` int NOT NULL,
  `userId` int,
  `visitorSessionId` int,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `profile_follows_id` PRIMARY KEY(`id`),
  CONSTRAINT `profile_follow_user_unique` UNIQUE(`advertiserProfileId`,`userId`),
  CONSTRAINT `profile_follow_visitor_unique` UNIQUE(`advertiserProfileId`,`visitorSessionId`)
);
ALTER TABLE `profile_follows`
  ADD CONSTRAINT `profile_follows_profile_advertiser_profiles_id_fk`
  FOREIGN KEY (`advertiserProfileId`) REFERENCES `advertiser_profiles`(`id`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `profile_follows`
  ADD CONSTRAINT `profile_follows_user_users_id_fk`
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `profile_follows`
  ADD CONSTRAINT `profile_follows_visitor_visitor_sessions_id_fk`
  FOREIGN KEY (`visitorSessionId`) REFERENCES `visitor_sessions`(`id`) ON DELETE no action ON UPDATE no action;

CREATE TABLE `share_media_variants` (
  `id` int AUTO_INCREMENT NOT NULL,
  `publicId` varchar(32) NOT NULL,
  `adId` int NOT NULL,
  `sourceMediaAssetId` int NOT NULL,
  `requestedByUserId` int,
  `requestedByVisitorSessionId` int,
  `status` enum('processing','ready','failed') NOT NULL DEFAULT 'processing',
  `watermarkText` varchar(160) NOT NULL,
  `storageKey` varchar(768),
  `url` varchar(1024),
  `mimeType` varchar(120),
  `bytes` int,
  `failureReason` varchar(240),
  `idempotencyKey` varchar(96) NOT NULL,
  `expiresAt` timestamp,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `share_media_variants_id` PRIMARY KEY(`id`),
  CONSTRAINT `share_media_variants_publicId_unique` UNIQUE(`publicId`),
  CONSTRAINT `share_media_variants_idempotency_unique` UNIQUE(`idempotencyKey`)
);
ALTER TABLE `share_media_variants`
  ADD CONSTRAINT `share_variants_ad_ads_id_fk`
  FOREIGN KEY (`adId`) REFERENCES `ads`(`id`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `share_media_variants`
  ADD CONSTRAINT `share_variants_source_media_assets_id_fk`
  FOREIGN KEY (`sourceMediaAssetId`) REFERENCES `media_assets`(`id`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `share_media_variants`
  ADD CONSTRAINT `share_variants_user_users_id_fk`
  FOREIGN KEY (`requestedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `share_media_variants`
  ADD CONSTRAINT `share_variants_visitor_visitor_sessions_id_fk`
  FOREIGN KEY (`requestedByVisitorSessionId`) REFERENCES `visitor_sessions`(`id`) ON DELETE no action ON UPDATE no action;
CREATE INDEX `share_media_variants_expiry_idx` ON `share_media_variants` (`status`,`expiresAt`);

ALTER TABLE `favorites`
  MODIFY `userId` int NULL,
  ADD `visitorSessionId` int;
ALTER TABLE `favorites`
  ADD CONSTRAINT `favorites_visitor_visitor_sessions_id_fk`
  FOREIGN KEY (`visitorSessionId`) REFERENCES `visitor_sessions`(`id`) ON DELETE no action ON UPDATE no action;
CREATE UNIQUE INDEX `favorite_visitor_ad_uq` ON `favorites` (`visitorSessionId`,`adId`);

ALTER TABLE `reports`
  MODIFY `adId` int NULL,
  MODIFY `reason` enum('spam','fraud','prohibited','misleading','copyright','impersonation','sexual','weapons','drugs','other') NOT NULL,
  ADD `reporterVisitorSessionId` int,
  ADD `profilePostId` int;
ALTER TABLE `reports`
  ADD CONSTRAINT `reports_visitor_visitor_sessions_id_fk`
  FOREIGN KEY (`reporterVisitorSessionId`) REFERENCES `visitor_sessions`(`id`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `reports`
  ADD CONSTRAINT `reports_post_profile_posts_id_fk`
  FOREIGN KEY (`profilePostId`) REFERENCES `profile_posts`(`id`) ON DELETE no action ON UPDATE no action;

ALTER TABLE `moderation_cases`
  MODIFY `adId` int NULL,
  MODIFY `revisionId` int NULL,
  ADD `profilePostId` int;
ALTER TABLE `moderation_cases`
  ADD CONSTRAINT `moderation_cases_post_profile_posts_id_fk`
  FOREIGN KEY (`profilePostId`) REFERENCES `profile_posts`(`id`) ON DELETE no action ON UPDATE no action;

ALTER TABLE `audit_logs`
  ADD `actorVisitorSessionId` int;
ALTER TABLE `audit_logs`
  ADD CONSTRAINT `audit_logs_actorVisitor_visitor_sessions_id_fk`
  FOREIGN KEY (`actorVisitorSessionId`) REFERENCES `visitor_sessions`(`id`) ON DELETE no action ON UPDATE no action;

ALTER TABLE `report_actions`
  MODIFY `action` enum(
    'assign','dismiss','remove_ad','remove_post','suspend_user','suspend_visitor',
    'restore_ad','restore_post','resolve'
  ) NOT NULL;

