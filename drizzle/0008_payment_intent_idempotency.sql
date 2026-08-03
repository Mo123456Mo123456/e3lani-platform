ALTER TABLE `payment_intents` ADD `idempotencyKey` varchar(160);
UPDATE `payment_intents`
SET `idempotencyKey` = CONCAT('legacy:', `publicId`)
WHERE `idempotencyKey` IS NULL;
ALTER TABLE `payment_intents` MODIFY `idempotencyKey` varchar(160) NOT NULL;
CREATE UNIQUE INDEX `payment_intents_idempotency_unique` ON `payment_intents` (`idempotencyKey`);
CREATE UNIQUE INDEX `payment_intents_externalId_unique` ON `payment_intents` (`externalId`);
