process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgres://postgres:postgres@127.0.0.1:5432/vero_test';
process.env.JWT_SECRET ??= 'test-jwt-secret-0123456789abcdef0123456789abcdef';
process.env.QR_SIGNING_KEY ??= 'test-qr-signing-key-0123456789abcdef0123456789';
process.env.STORAGE_DIR ??= './.test-storage';
process.env.BACKUP_DIR ??= './.test-storage/backups';
process.env.PUBLIC_BASE_URL ??= 'http://localhost:4000';

const { runMigrations } = await import('../src/db/migrate.js');
await runMigrations();
