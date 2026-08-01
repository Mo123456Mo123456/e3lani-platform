ALTER TABLE `scoped_pricing_rules` ADD `scopeRef` varchar(64);
CREATE INDEX `scoped_pricing_rules_scope_idx` ON `scoped_pricing_rules` (`scopeType`,`scopeRef`,`isActive`);
