-- Reconcile a partially applied legacy migration.
-- The four CamelCase tables were verified empty before this migration was written.
DROP TABLE IF EXISTS `adContacts`;
--> statement-breakpoint
DROP TABLE IF EXISTS `adEvents`;
--> statement-breakpoint
DROP TABLE IF EXISTS `adMedia`;
--> statement-breakpoint
DROP TABLE IF EXISTS `adRevisions`;
