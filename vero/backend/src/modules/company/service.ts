import { audit } from '../../core/audit.js';
import type { Ctx } from '../../core/context.js';
import { AppError, notFound } from '../../core/errors.js';
import { isValidTimezone } from '../../core/time.js';
import { one, rows } from '../../db/pool.js';

export interface CompanyRow {
  id: string;
  name: string;
  logo_path: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  default_gps_radius_m: number;
  timezone: string;
  setup_completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CompanyDto {
  id: string;
  name: string;
  logoUrl: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  defaultGpsRadiusM: number;
  timezone: string;
  setupCompletedAt: string | null;
}

export function toCompanyDto(r: CompanyRow): CompanyDto {
  return {
    id: r.id,
    name: r.name,
    logoUrl: r.logo_path ? `/v1/company/logo` : null,
    city: r.city,
    phone: r.phone,
    email: r.email,
    address: r.address,
    defaultGpsRadiusM: r.default_gps_radius_m,
    timezone: r.timezone,
    setupCompletedAt: r.setup_completed_at ? r.setup_completed_at.toISOString() : null,
  };
}

/** الشركة الوحيدة في هذه النسخة. يرمي إذا لم يكتمل الإعداد. */
export async function requireCompany(): Promise<CompanyRow> {
  const row = await one<CompanyRow>('SELECT * FROM companies LIMIT 1');
  if (!row) {
    throw new AppError('SETUP_REQUIRED', 'لم يتم إعداد النظام بعد. افتح معالج الإعداد أولًا.');
  }
  return row;
}

export async function findCompany(): Promise<CompanyRow | null> {
  return one<CompanyRow>('SELECT * FROM companies LIMIT 1');
}

export interface UpdateCompanyInput {
  name?: string;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  defaultGpsRadiusM?: number;
  timezone?: string;
}

export async function updateCompany(ctx: Ctx, input: UpdateCompanyInput): Promise<CompanyRow> {
  const before = await requireCompany();
  if (input.timezone && !isValidTimezone(input.timezone)) {
    throw new AppError('VALIDATION_FAILED', `منطقة زمنية غير معروفة: ${input.timezone}`);
  }
  const after = await one<CompanyRow>(
    `UPDATE companies SET
       name                 = COALESCE($2, name),
       city                 = COALESCE($3, city),
       phone                = COALESCE($4, phone),
       email                = COALESCE($5, email),
       address              = COALESCE($6, address),
       default_gps_radius_m = COALESCE($7, default_gps_radius_m),
       timezone             = COALESCE($8, timezone),
       updated_at           = now()
     WHERE id = $1
     RETURNING *`,
    [
      before.id,
      input.name ?? null,
      input.city ?? null,
      input.phone ?? null,
      input.email ?? null,
      input.address ?? null,
      input.defaultGpsRadiusM ?? null,
      input.timezone ?? null,
    ],
  );
  if (!after) throw notFound('الشركة غير موجودة');
  await audit(ctx, {
    action: 'company.update',
    entity: 'company',
    entityId: before.id,
    before: toCompanyDto(before),
    after: toCompanyDto(after),
  });
  return after;
}

export async function setCompanyLogo(ctx: Ctx, logoPath: string): Promise<CompanyRow> {
  const before = await requireCompany();
  const after = await one<CompanyRow>(
    'UPDATE companies SET logo_path = $2, updated_at = now() WHERE id = $1 RETURNING *',
    [before.id, logoPath],
  );
  if (!after) throw notFound('الشركة غير موجودة');
  await audit(ctx, {
    action: 'company.logo.update',
    entity: 'company',
    entityId: before.id,
    before: { logoPath: before.logo_path },
    after: { logoPath: after.logo_path },
  });
  return after;
}

// ─────────────────────────── الإعدادات ───────────────────────────

export interface SettingRow {
  key: string;
  value: unknown;
  updated_at: Date;
}

export async function listSettings(companyId: string): Promise<Record<string, unknown>> {
  const list = await rows<SettingRow>(
    'SELECT key, value, updated_at FROM settings WHERE company_id = $1 ORDER BY key',
    [companyId],
  );
  return Object.fromEntries(list.map((s) => [s.key, s.value]));
}

export async function setSetting(ctx: Ctx, key: string, value: unknown): Promise<void> {
  const before = await one<SettingRow>(
    'SELECT key, value, updated_at FROM settings WHERE company_id = $1 AND key = $2',
    [ctx.companyId, key],
  );
  await one(
    `INSERT INTO settings (company_id, key, value, updated_at)
     VALUES ($1,$2,$3,now())
     ON CONFLICT (company_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [ctx.companyId, key, JSON.stringify(value)],
  );
  await audit(ctx, {
    action: 'settings.set',
    entity: 'setting',
    entityId: key,
    before: before?.value,
    after: value,
  });
}
