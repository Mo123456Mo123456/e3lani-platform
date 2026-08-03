import { and, desc, eq, gt, isNull, ne } from "drizzle-orm";

import { otpChallenges, users } from "../../drizzle/schema";
import {
  checkAuthRateLimit,
  clearAuthRateLimit,
  getDb,
  recordAuthFailure,
  requireDatabase,
  upsertUser,
} from "../db";
import {
  generateOtpCode,
  getOtpProvider,
  hashOtpCode,
  hashOtpSubject,
  isOtpSandboxMode,
  SANDBOX_OTP_CODE,
  type OtpPurpose,
} from "./providers";

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const REQUEST_RATE_POLICY = {
  maxAttempts: 3,
  windowMs: 10 * 60 * 1000,
  blockMs: 15 * 60 * 1000,
};
const VERIFY_RATE_POLICY = {
  maxAttempts: 5,
  windowMs: 10 * 60 * 1000,
  blockMs: 30 * 60 * 1000,
};

function normalizePhone(value: string): string {
  const normalized = value.replace(/[\s()-]/g, "").trim();
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw new Error("OTP_PHONE_INVALID");
  }
  return normalized;
}

export async function requestOtp(input: {
  phone: string;
  purpose: OtpPurpose;
}) {
  const phone = normalizePhone(input.phone);
  const subjectHash = hashOtpSubject(phone);
  const rate = await checkAuthRateLimit("otp_request", subjectHash);
  if (!rate.allowed) {
    throw new Error(`OTP_RATE_LIMITED_${rate.retryAfterSeconds}`);
  }

  // Count requests before contacting the provider so repeated provider failures
  // cannot be used to bypass throttling.
  await recordAuthFailure("otp_request", subjectHash, REQUEST_RATE_POLICY);

  const db = requireDatabase(await getDb());
  const code = isOtpSandboxMode() ? SANDBOX_OTP_CODE : generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  const provider = getOtpProvider();
  const now = new Date();

  // Only the newest challenge remains usable.
  await db
    .update(otpChallenges)
    .set({ consumedAt: now })
    .where(
      and(
        eq(otpChallenges.phone, phone),
        eq(otpChallenges.purpose, input.purpose),
        isNull(otpChallenges.consumedAt),
      ),
    );

  const inserted = await db.insert(otpChallenges).values({
    phone,
    codeHash: hashOtpCode(code),
    purpose: input.purpose,
    attempts: 0,
    maxAttempts: MAX_ATTEMPTS,
    expiresAt,
  });
  const challengeId = Number(inserted[0].insertId);

  try {
    await provider.sendOtp({ phone, code, purpose: input.purpose });
  } catch (error) {
    // A code that was not delivered must never remain valid.
    await db
      .update(otpChallenges)
      .set({ consumedAt: new Date() })
      .where(eq(otpChallenges.id, challengeId));
    throw error;
  }

  return {
    challengeId: String(challengeId),
    expiresAt: expiresAt.toISOString(),
    provider: provider.id,
    /** Visible only outside production — never returned in production. */
    sandboxCode: isOtpSandboxMode() ? code : undefined,
  };
}

export async function verifyOtp(input: {
  phone: string;
  code: string;
  purpose: OtpPurpose;
  countryCode?: string;
  accountType?: "viewer" | "advertiser" | "brand";
}) {
  const db = requireDatabase(await getDb());
  const phone = normalizePhone(input.phone);
  const code = input.code.trim();
  const subjectHash = hashOtpSubject(phone);
  const rate = await checkAuthRateLimit("otp_verify", subjectHash);
  if (!rate.allowed) {
    throw new Error(`OTP_RATE_LIMITED_${rate.retryAfterSeconds}`);
  }

  const now = new Date();
  const result = await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(otpChallenges)
      .where(
        and(
          eq(otpChallenges.phone, phone),
          eq(otpChallenges.purpose, input.purpose),
          isNull(otpChallenges.consumedAt),
          gt(otpChallenges.expiresAt, now),
        ),
      )
      .orderBy(desc(otpChallenges.id))
      .limit(1)
      .for("update");

    const challenge = rows[0];
    if (!challenge) return { status: "missing" as const };
    if (challenge.attempts >= challenge.maxAttempts) {
      return { status: "too_many_attempts" as const };
    }

    const ok = challenge.codeHash === hashOtpCode(code);
    if (!ok) {
      await tx
        .update(otpChallenges)
        .set({ attempts: challenge.attempts + 1 })
        .where(eq(otpChallenges.id, challenge.id));
      return { status: "invalid" as const };
    }

    await tx
      .update(otpChallenges)
      .set({ consumedAt: now, attempts: challenge.attempts + 1 })
      .where(eq(otpChallenges.id, challenge.id));

    // Invalidate any older challenge still present because of legacy data.
    await tx
      .update(otpChallenges)
      .set({ consumedAt: now })
      .where(
        and(
          eq(otpChallenges.phone, phone),
          eq(otpChallenges.purpose, input.purpose),
          isNull(otpChallenges.consumedAt),
          ne(otpChallenges.id, challenge.id),
        ),
      );

    return { status: "verified" as const };
  });

  if (result.status !== "verified") {
    await recordAuthFailure("otp_verify", subjectHash, VERIFY_RATE_POLICY);
    if (result.status === "missing") throw new Error("OTP_EXPIRED_OR_MISSING");
    if (result.status === "too_many_attempts") throw new Error("OTP_TOO_MANY_ATTEMPTS");
    throw new Error("OTP_INVALID");
  }

  await clearAuthRateLimit("otp_verify", subjectHash);

  const openId = `phone:${phone}`;
  await upsertUser({
    openId,
    name: input.purpose === "register_advertiser" ? "معلن إعلاني" : "مستخدم إعلاني",
    phone,
    loginMethod: "otp",
    accountType:
      input.purpose === "register_advertiser" ? "advertiser" : (input.accountType ?? "viewer"),
    countryCode: input.countryCode?.toUpperCase() ?? null,
    lastSignedIn: now,
  });

  const userRows = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  const user = userRows[0];
  if (!user) throw new Error("OTP_USER_CREATE_FAILED");
  return { user };
}
