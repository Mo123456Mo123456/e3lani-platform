import { env } from './config/env.js';
import { runMigrations } from './db/migrate.js';
import { closePool, pool } from './db/pool.js';
import { buildServer } from './http/server.js';
import { startAutoBackup } from './modules/backups/service.js';

async function main(): Promise<void> {
  // اتصال قاعدة البيانات شرط للإقلاع — لا تشغيل بلا بيانات حقيقية
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    console.error(
      '[VERO] تعذّر الاتصال بقاعدة البيانات. تحقّق من DATABASE_URL.\n',
      err instanceof Error ? err.message : String(err),
    );
    process.exit(1);
  }

  await runMigrations((m) => console.log(m));

  const app = await buildServer();
  const autoBackup = startAutoBackup();

  await app.listen({ host: env.host, port: env.port });
  console.log(`[VERO] الخادم يعمل على ${env.host}:${env.port}`);
  console.log(`[VERO] توثيق الـAPI: ${env.publicBaseUrl}/docs`);

  const shutdown = async (signal: string) => {
    console.log(`[VERO] إيقاف الخادم (${signal})…`);
    if (autoBackup) clearInterval(autoBackup);
    try {
      await app.close();
      await closePool();
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[VERO] فشل الإقلاع:', err);
  process.exit(1);
});
