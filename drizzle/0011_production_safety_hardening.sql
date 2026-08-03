ALTER TABLE `ads`
  ADD `adminHold` tinyint NOT NULL DEFAULT 0,
  ADD `adminHoldReason` varchar(500);

ALTER TABLE `identity_action_events`
  DROP INDEX `identity_action_idempotency_unique`,
  ADD CONSTRAINT `identity_action_user_idempotency_unique` UNIQUE (`userId`,`actionType`,`idempotencyKey`),
  ADD CONSTRAINT `identity_action_visitor_idempotency_unique` UNIQUE (`visitorSessionId`,`actionType`,`idempotencyKey`);

CREATE TABLE `profile_post_events` (
  `id` int AUTO_INCREMENT NOT NULL,
  `profilePostId` int NOT NULL,
  `eventType` enum('view','share') NOT NULL,
  `dedupeKey` varchar(180) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `profile_post_events_id` PRIMARY KEY(`id`),
  CONSTRAINT `profile_post_events_dedupe_unique` UNIQUE(`dedupeKey`)
);
ALTER TABLE `profile_post_events`
  ADD CONSTRAINT `profile_post_events_post_fk`
  FOREIGN KEY (`profilePostId`) REFERENCES `profile_posts`(`id`) ON DELETE no action ON UPDATE no action;
CREATE INDEX `profile_post_events_rollup_idx` ON `profile_post_events` (`profilePostId`,`eventType`,`createdAt`);
