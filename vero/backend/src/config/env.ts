import { randomBytes } from 'node:crypto';

function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') {
    throw new Error(
      `[VERO] متغير البيئة المطلوب غير موجود: ${name}. راجع ملف .env.example`,
    );
  }
  return v;
}

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`[VERO] قيمة غير رقمية للمتغير ${name}`);
  return n;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return raw === '1' || raw.toLowerCase() === 'true';
}

const isTest = process.env.NODE_ENV === 'test';

/**
 * أسرار التشغيل إلزامية في الإنتاج. في بيئة الاختبار فقط يُسمح بتوليد مفتاح مؤقت
 * حتى لا تتعطل الاختبارات، ولا يُستخدم هذا المسار أبدًا في الإنتاج.
 */
function secret(name: string, minLength = 32): string {
  const raw = process.env[name];
  if (!raw) {
    if (isTest) return randomBytes(48).toString('hex');
    throw new Error(
      `[VERO] السر ${name} غير معرّف. ولّده بأمر: openssl rand -hex 32`,
    );
  }
  if (raw.length < minLength) {
    throw new Error(`[VERO] السر ${name} قصير جدًا (الحد الأدنى ${minLength} حرفًا)`);
  }
  return raw;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest,

  host: process.env.HOST ?? '0.0.0.0',
  port: num('PORT', 4000),

  databaseUrl: req(
    'DATABASE_URL',
    isTest ? 'postgres://postgres:postgres@127.0.0.1:5432/vero_test' : undefined,
  ),
  dbPoolMax: num('DB_POOL_MAX', 10),

  jwtSecret: secret('JWT_SECRET'),
  qrSigningKey: secret('QR_SIGNING_KEY'),

  accessTokenTtlSec: num('ACCESS_TOKEN_TTL_SEC', 60 * 60 * 8),
  refreshTokenTtlSec: num('REFRESH_TOKEN_TTL_SEC', 60 * 60 * 24 * 30),

  storageDir: process.env.STORAGE_DIR ?? './storage',
  backupDir: process.env.BACKUP_DIR ?? './storage/backups',

  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? 'http://localhost:4000',
  adminOrigin: process.env.ADMIN_ORIGIN ?? 'http://localhost:3000',
  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  rateLimitMax: num('RATE_LIMIT_MAX', 300),
  rateLimitWindowMs: num('RATE_LIMIT_WINDOW_MS', 60_000),
  authRateLimitMax: num('AUTH_RATE_LIMIT_MAX', 10),

  // كشف التلاعب
  maxGpsAccuracyM: num('MAX_GPS_ACCURACY_M', 100),
  maxPlausibleSpeedMps: num('MAX_PLAUSIBLE_SPEED_MPS', 45), // ~162 كم/س
  maxRouteDeviationM: num('MAX_ROUTE_DEVIATION_M', 500),
  maxScanClockSkewSec: num('MAX_SCAN_CLOCK_SKEW_SEC', 60 * 60 * 24 * 7),

  autoBackupCron: process.env.AUTO_BACKUP_ENABLED === '1',
  autoBackupIntervalHours: num('AUTO_BACKUP_INTERVAL_HOURS', 24),

  version: process.env.VERO_VERSION ?? '1.0.0',
} as const;

export type Env = typeof env;
