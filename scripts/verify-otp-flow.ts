import { and, eq, isNotNull } from "drizzle-orm";

import { otpChallenges, users } from "../drizzle/schema";
import { getDb, requireDatabase } from "../server/db";
import { requestOtp, verifyOtp } from "../server/otp/service";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`OTP_FLOW_FAILED: ${message}`);
}

async function main() {
  const database = requireDatabase(await getDb());
  const phone = `+9665${Date.now().toString().slice(-8)}`;

  const challenge = await requestOtp({
    phone,
    purpose: "register_advertiser",
  });
  assert(challenge.provider === "sandbox", "CI must use the isolated sandbox provider");
  assert(challenge.sandboxCode === "123456", "sandbox code was not returned outside production");

  const verified = await verifyOtp({
    phone,
    code: challenge.sandboxCode,
    purpose: "register_advertiser",
    countryCode: "SA",
  });
  assert(verified.user.phone === phone, "verified user phone was not persisted");
  assert(verified.user.accountType === "advertiser", "advertiser account type was not persisted");
  assert(verified.user.countryCode === "SA", "account country was not persisted");
  assert(verified.user.status === "active", "verified account is not active");

  const challengeRows = await database
    .select()
    .from(otpChallenges)
    .where(
      and(
        eq(otpChallenges.phone, phone),
        eq(otpChallenges.purpose, "register_advertiser"),
        isNotNull(otpChallenges.consumedAt),
      ),
    );
  assert(challengeRows.length === 1, "verified challenge was not consumed");
  assert(challengeRows[0].attempts === 1, "successful verification attempt was not recorded");

  let reuseError = "";
  try {
    await verifyOtp({
      phone,
      code: challenge.sandboxCode,
      purpose: "register_advertiser",
      countryCode: "SA",
    });
  } catch (error) {
    reuseError = error instanceof Error ? error.message : String(error);
  }
  assert(reuseError === "OTP_EXPIRED_OR_MISSING", "consumed OTP was accepted a second time");

  const userRows = await database
    .select({ id: users.id, openId: users.openId })
    .from(users)
    .where(eq(users.openId, `phone:${phone}`));
  assert(userRows.length === 1, "OTP registration created zero or duplicate users");

  let invalidPhoneError = "";
  try {
    await requestOtp({ phone: "0500000000", purpose: "login" });
  } catch (error) {
    invalidPhoneError = error instanceof Error ? error.message : String(error);
  }
  assert(invalidPhoneError === "OTP_PHONE_INVALID", "non-E.164 phone was accepted");

  console.log(
    JSON.stringify(
      {
        ok: true,
        provider: challenge.provider,
        userId: verified.user.id,
        accountType: verified.user.accountType,
        countryCode: verified.user.countryCode,
        consumed: true,
        reusePrevented: true,
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
