import { runMigrations } from './migrate.js';
import { closePool } from './pool.js';

const res = await runMigrations((m) => console.log(m));
console.log(
  `[VERO] الهجرات: طُبّق ${res.applied.length}، تم تخطي ${res.skipped.length} (مطبّقة سابقًا)`,
);
await closePool();
