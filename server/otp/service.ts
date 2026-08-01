import { and, desc, eq, gt, isNull } from "drizzle-orm";

import { otpChallenges, users } from "../../drizzle/schema";
import { getDb, requireDatabase, upsertUser } from "../db";
import {
  generateOtpCode,
  getOtpProvider,
  hashOtpCode,
  isOtpSandboxMode,
  SANDBOX_OTP_CODE,
  type OtpPurpose,
} from "./providers";

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export async function requestOtp(input: {
  phone: string;
  purpose: OtpPurpose;
}) {
  const phone = input.phone.trim();
  if (phone.length < 8) throw new Error("OTP_PHONE_INVALID");

  const db = requireDatabase(await getDb());
  const code = isOtpSandboxMode() ? SANDBOX_OTP_CODE : generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  const provider = getOtpProvider();

  const inserted = await db.insert(otpChallenges).values({
    phone,
    codeHash: hashOtpCode(code),
    purpose: input.purpose,
    attempts: 0,
    maxAttempts: MAX_ATTEMPTS,
    expiresAt,
  });

  await provider.sendOtp({ phone, code, purpose: input.purpose });

  return {
    challengeId: String(inserted[0].insertId),
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
  const phone = input.phone.trim();
  const now = new Date();

  const rows = await db
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
    .limit(1);

  const challenge = rows[0];
  if (!challenge) throw new Error("OTP_EXPIRED_OR_MISSING");
  if (challenge.attempts >= challenge.maxAttempts) throw new Error("OTP_TOO_MANY_ATTEMPTS");

  const ok = challenge.codeHash === hashOtpCode(input.code.trim());
  if (!ok) {
    await db
      .update(otpChallenges)
      .set({ attempts: challenge.attempts + 1 })
      .where(eq(otpChallenges.id, challenge.id));
    throw new Error("OTP_INVALID");
  }

  await db
    .update(otpChallenges)
    .set({ consumedAt: now, attempts: challenge.attempts + 1 })
    .where(eq(otpChallenges.id, challenge.id));

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
