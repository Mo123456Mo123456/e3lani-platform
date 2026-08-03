import { and, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { randomBytes } from "crypto";

import { couponRedemptions, coupons, countries, pricingExemptions } from "../drizzle/schema";
import { writeAuditLog } from "./audit-service";
import { getDb, requireDatabase } from "./db";

export async function listCoupons(includeInactive = false) {
  const db = requireDatabase(await getDb());
  const query = db
    .select({
      id: coupons.id,
      code: coupons.code,
      name: coupons.name,
      discountType: coupons.discountType,
      discountValue: coupons.discountValue,
      countryCode: countries.code,
      usageLimit: coupons.usageLimit,
      usageLimitPerUser: coupons.usageLimitPerUser,
      startsAt: coupons.startsAt,
      expiresAt: coupons.expiresAt,
      isActive: coupons.isActive,
      createdAt: coupons.createdAt,
    })
    .from(coupons)
    .leftJoin(countries, eq(coupons.countryId, countries.id));

  const rows = await (includeInactive
    ? query.orderBy(desc(coupons.id)).limit(200)
    : query.where(eq(coupons.isActive, 1)).orderBy(desc(coupons.id)).limit(200));

  return rows.map((row) => ({
    ...row,
    isActive: row.isActive === 1,
    startsAt: row.startsAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function upsertCoupon(input: {
  actorId: number;
  code: string;
  name?: string | null;
  discountType: "percent" | "fixed";
  discountValue: number;
  countryCode?: string | null;
  usageLimit?: number | null;
  usageLimitPerUser?: number | null;
  startsAt?: string | null;
  expiresAt?: string | null;
  isActive?: boolean;
}) {
  const db = requireDatabase(await getDb());
  const code = input.code.trim().toUpperCase().slice(0, 64);
  if (!code) throw new Error("COUPON_CODE_REQUIRED");
  if (input.discountType === "percent" && (input.discountValue < 1 || input.discountValue > 100)) {
    throw new Error("COUPON_PERCENT_INVALID");
  }

  let countryId: number | null = null;
  if (input.countryCode) {
    const rows = await db
      .select({ id: countries.id })
      .from(countries)
      .where(eq(countries.code, input.countryCode.toUpperCase()))
      .limit(1);
    countryId = rows[0]?.id ?? null;
  }

  const existing = await db.select().from(coupons).where(eq(coupons.code, code)).limit(1);
  const values = {
    name: input.name?.trim() || null,
    discountType: input.discountType,
    discountValue: input.discountValue,
    countryId,
    usageLimit: input.usageLimit ?? null,
    usageLimitPerUser: input.usageLimitPerUser ?? null,
    startsAt: input.startsAt ? new Date(input.startsAt) : null,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    isActive: input.isActive === false ? 0 : 1,
  };

  if (existing[0]) {
    await db.update(coupons).set(values).where(eq(coupons.id, existing[0].id));
    await writeAuditLog({
      actorId: input.actorId,
      actorRole: "admin",
      action: "coupon.update",
      entityType: "coupon",
      entityId: code,
      beforeState: existing[0],
      afterState: values,
    }).catch(() => undefined);
  } else {
    await db.insert(coupons).values({ code, ...values });
    await writeAuditLog({
      actorId: input.actorId,
      actorRole: "admin",
      action: "coupon.create",
      entityType: "coupon",
      entityId: code,
      afterState: values,
    }).catch(() => undefined);
  }
  return { ok: true as const, code };
}

export async function deactivateCoupon(actorId: number, code: string) {
  const db = requireDatabase(await getDb());
  const normalized = code.trim().toUpperCase();
  const rows = await db.select().from(coupons).where(eq(coupons.code, normalized)).limit(1);
  if (!rows[0]) throw new Error("COUPON_NOT_FOUND");
  await db.update(coupons).set({ isActive: 0 }).where(eq(coupons.id, rows[0].id));
  await writeAuditLog({
    actorId,
    actorRole: "admin",
    action: "coupon.deactivate",
    entityType: "coupon",
    entityId: normalized,
  }).catch(() => undefined);
  return { ok: true as const };
}

export async function resolveActiveCoupon(input: {
  code?: string | null;
  countryCode?: string | null;
  userId?: number | null;
}) {
  if (!input.code?.trim()) return null;
  const db = requireDatabase(await getDb());
  const now = new Date();
  const code = input.code.trim().toUpperCase();
  const rows = await db
    .select({
      id: coupons.id,
      code: coupons.code,
      name: coupons.name,
      discountType: coupons.discountType,
      discountValue: coupons.discountValue,
      countryId: coupons.countryId,
      countryCode: countries.code,
      usageLimit: coupons.usageLimit,
      usageLimitPerUser: coupons.usageLimitPerUser,
    })
    .from(coupons)
    .leftJoin(countries, eq(coupons.countryId, countries.id))
    .where(
      and(
        eq(coupons.code, code),
        eq(coupons.isActive, 1),
        or(isNull(coupons.startsAt), lte(coupons.startsAt, now)),
        or(isNull(coupons.expiresAt), gte(coupons.expiresAt, now)),
      ),
    )
    .limit(1);
  const coupon = rows[0];
  if (!coupon) return null;
  if (coupon.countryCode && input.countryCode && coupon.countryCode !== input.countryCode.toUpperCase()) {
    return null;
  }
  if (coupon.usageLimit != null) {
    const total = await db
      .select({ count: sql<number>`count(*)` })
      .from(couponRedemptions)
      .where(eq(couponRedemptions.couponId, coupon.id));
    if (Number(total[0]?.count ?? 0) >= coupon.usageLimit) return null;
  }
  if (coupon.usageLimitPerUser != null && input.userId) {
    const perUser = await db
      .select({ count: sql<number>`count(*)` })
      .from(couponRedemptions)
      .where(and(eq(couponRedemptions.couponId, coupon.id), eq(couponRedemptions.userId, input.userId)));
    if (Number(perUser[0]?.count ?? 0) >= coupon.usageLimitPerUser) return null;
  }
  return {
    id: coupon.id,
    code: coupon.code,
    name: coupon.name,
    discountType: coupon.discountType as "percent" | "fixed",
    discountValue: coupon.discountValue,
  };
}

export async function recordCouponRedemption(input: {
  couponId: number;
  userId: number;
  adId?: number | null;
}) {
  const db = requireDatabase(await getDb());
  await db.insert(couponRedemptions).values({
    couponId: input.couponId,
    userId: input.userId,
    adId: input.adId ?? null,
  });
  return { ok: true as const };
}

export async function userHasActiveExemption(userId: number, brandId?: number | null) {
  const db = requireDatabase(await getDb());
  const now = new Date();
  const refs = [`${userId}`];
  if (brandId) refs.push(`${brandId}`);
  const rows = await db
    .select({ id: pricingExemptions.id })
    .from(pricingExemptions)
    .where(
      and(
        eq(pricingExemptions.isActive, 1),
        or(
          and(eq(pricingExemptions.subjectType, "user"), eq(pricingExemptions.subjectRef, `${userId}`)),
          brandId
            ? and(eq(pricingExemptions.subjectType, "brand"), eq(pricingExemptions.subjectRef, `${brandId}`))
            : sql`false`,
        ),
        or(isNull(pricingExemptions.startsAt), lte(pricingExemptions.startsAt, now)),
        or(isNull(pricingExemptions.endsAt), gte(pricingExemptions.endsAt, now)),
      ),
    )
    .limit(1);
  return Boolean(rows[0]);
}

export async function upsertExemption(input: {
  actorId: number;
  publicId?: string;
  subjectType: "user" | "brand";
  subjectRef: string;
  reason?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive?: boolean;
}) {
  const db = requireDatabase(await getDb());
  const publicId = input.publicId ?? `ex_${randomBytes(6).toString("hex")}`;
  const existing = await db
    .select()
    .from(pricingExemptions)
    .where(eq(pricingExemptions.publicId, publicId))
    .limit(1);
  const values = {
    subjectType: input.subjectType,
    subjectRef: input.subjectRef.trim(),
    reason: input.reason ?? null,
    startsAt: input.startsAt ? new Date(input.startsAt) : null,
    endsAt: input.endsAt ? new Date(input.endsAt) : null,
    isActive: input.isActive === false ? 0 : 1,
    createdBy: input.actorId,
  };
  if (existing[0]) {
    await db.update(pricingExemptions).set(values).where(eq(pricingExemptions.id, existing[0].id));
  } else {
    await db.insert(pricingExemptions).values({ publicId, ...values });
  }
  await writeAuditLog({
    actorId: input.actorId,
    actorRole: "admin",
    action: existing[0] ? "exemption.update" : "exemption.create",
    entityType: "pricing_exemption",
    entityId: publicId,
    afterState: values,
  }).catch(() => undefined);
  return { ok: true as const, publicId };
}

export async function listExemptions() {
  const db = requireDatabase(await getDb());
  const rows = await db.select().from(pricingExemptions).orderBy(desc(pricingExemptions.id)).limit(200);
  return rows.map((row) => ({
    publicId: row.publicId,
    subjectType: row.subjectType,
    subjectRef: row.subjectRef,
    reason: row.reason,
    isActive: row.isActive === 1,
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
  }));
}
