import { audit } from '../../core/audit.js';
import type { Ctx } from '../../core/context.js';
import { hashPassword } from '../../core/crypto.js';
import { AppError } from '../../core/errors.js';
import { isValidTimezone } from '../../core/time.js';
import { withTransaction } from '../../db/pool.js';
import type { CompanyRow } from '../company/service.js';
import { findCompany, toCompanyDto } from '../company/service.js';

export interface SetupInput {
  company: {
    name: string;
    city?: string;
    phone?: string;
    email?: string;
    address?: string;
    defaultGpsRadiusM: number;
    timezone?: string;
  };
  admin: {
    fullName: string;
    username: string;
    email?: string;
    password: string;
  };
}

export interface SetupStatus {
  setupCompleted: boolean;
  companyName: string | null;
}

export async function getSetupStatus(): Promise<SetupStatus> {
  const company = await findCompany();
  return {
    setupCompleted: Boolean(company?.setup_completed_at),
    companyName: company?.name ?? null,
  };
}

/**
 * معالج الإعداد الأول. يعمل مرة واحدة فقط لكل نسخة:
 * فهرس `companies_singleton` يمنع إنشاء شركة ثانية على مستوى قاعدة البيانات،
 * والتحقق هنا يعطي رسالة واضحة بدل خطأ قاعدة بيانات خام.
 */
export async function runSetup(
  input: SetupInput,
  meta: { ip?: string; userAgent?: string },
): Promise<{ company: CompanyRow; adminId: string }> {
  const existing = await findCompany();
  if (existing?.setup_completed_at) {
    throw new AppError(
      'SETUP_ALREADY_COMPLETED',
      'تم إعداد النظام مسبقًا. لتغيير البيانات استخدم إعدادات هوية الشركة.',
    );
  }

  const timezone = input.company.timezone ?? 'Asia/Riyadh';
  if (!isValidTimezone(timezone)) {
    throw new AppError('VALIDATION_FAILED', `منطقة زمنية غير معروفة: ${timezone}`);
  }
  if (input.admin.password.length < 8) {
    throw new AppError('VALIDATION_FAILED', 'كلمة مرور المدير يجب ألا تقل عن 8 أحرف');
  }

  const { hash, salt } = await hashPassword(input.admin.password);

  const result = await withTransaction(async (tx) => {
    const company = await tx.one<CompanyRow>(
      `INSERT INTO companies
         (name, city, phone, email, address, default_gps_radius_m, timezone, setup_completed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7, now())
       RETURNING *`,
      [
        input.company.name,
        input.company.city ?? null,
        input.company.phone ?? null,
        input.company.email ?? null,
        input.company.address ?? null,
        input.company.defaultGpsRadiusM,
        timezone,
      ],
    );
    if (!company) throw new AppError('INTERNAL', 'تعذّر إنشاء الشركة');

    const admin = await tx.one<{ id: string }>(
      `INSERT INTO users (company_id, full_name, username, email, password_hash, password_salt, role)
       VALUES ($1,$2,$3,$4,$5,$6,'ADMIN')
       RETURNING id`,
      [
        company.id,
        input.admin.fullName,
        input.admin.username,
        input.admin.email ?? null,
        hash,
        salt,
      ],
    );
    if (!admin) throw new AppError('INTERNAL', 'تعذّر إنشاء حساب المدير');

    return { company, adminId: admin.id };
  });

  const ctx: Ctx = {
    companyId: result.company.id,
    actor: {
      kind: 'user',
      id: result.adminId,
      companyId: result.company.id,
      role: 'ADMIN',
      fullName: input.admin.fullName,
      username: input.admin.username,
    },
    meta,
  };
  await audit(ctx, {
    action: 'setup.complete',
    entity: 'company',
    entityId: result.company.id,
    after: { company: toCompanyDto(result.company), adminUsername: input.admin.username },
  });

  return result;
}
