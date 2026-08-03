import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_LAUNCH_POLICY,
  normalizeLaunchPolicy,
} from "../lib/launch-policy";
import { scanAdContent } from "../lib/moderation/ai-scan";

describe("visitor-first launch policy", () => {
  it("opens browsing and publishing without mandatory authentication by default", () => {
    expect(DEFAULT_LAUNCH_POLICY.authenticationRequired).toBe(false);
    expect(DEFAULT_LAUNCH_POLICY.guestPublishingEnabled).toBe(true);
    expect(DEFAULT_LAUNCH_POLICY.phoneVerificationEnabled).toBe(false);
    expect(DEFAULT_LAUNCH_POLICY.emailVerificationEnabled).toBe(false);
    expect(DEFAULT_LAUNCH_POLICY.verificationRequiredForPublishing).toBe(false);
    expect(DEFAULT_LAUNCH_POLICY.instantPublishing).toBe(true);
    expect(DEFAULT_LAUNCH_POLICY.manualPreApproval).toBe(false);
    expect(DEFAULT_LAUNCH_POLICY.globalFreeMode).toBe(true);
    expect(DEFAULT_LAUNCH_POLICY.paymentRequired).toBe(false);
    expect(DEFAULT_LAUNCH_POLICY.paymentsEnabled).toBe(false);
  });

  it("uses configurable server limits with safe bounds", () => {
    expect(DEFAULT_LAUNCH_POLICY.mainAdsDailyLimit).toBe(10);
    expect(DEFAULT_LAUNCH_POLICY.profilePostsDailyLimit).toBe(30);
    expect(normalizeLaunchPolicy({ mainAdsDailyLimit: 0 }).mainAdsDailyLimit).toBe(1);
    expect(normalizeLaunchPolicy({ profilePostsDailyLimit: 99 }).profilePostsDailyLimit).toBe(99);
  });

  it("defaults to post-publish moderation and pauses only severe signals", () => {
    expect(DEFAULT_LAUNCH_POLICY.moderationMode).toBe("post_publish");
    const suspicious = scanAdContent({
      title: "عرض سريع",
      description: "تواصل معنا الآن عبر واتساب لمعرفة التفاصيل والاستفادة من العرض",
    });
    expect(["keep_published", "flag_for_admin"]).toContain(suspicious.autoAction);
    const prohibited = scanAdContent({
      title: "سلاح للبيع",
      description: "بيع سلاح ومخدرات بطريقة مباشرة ومخالفة للنظام",
    });
    expect(prohibited.autoAction).toBe("auto_pause");
  });
});

describe("guest-only launch interface", () => {
  const gate = readFileSync(
    new URL("../components/e3lani/app-state-gate.tsx", import.meta.url).pathname,
    "utf8",
  );
  const welcome = readFileSync(
    new URL("../app/welcome.tsx", import.meta.url).pathname,
    "utf8",
  );
  const profile = readFileSync(
    new URL("../app/(tabs)/profile.tsx", import.meta.url).pathname,
    "utf8",
  );

  it("creates a signed visitor identity and never redirects publishing to login", () => {
    expect(gate).toContain("VisitorIdentity");
    expect(gate).toContain("getVisitorToken");
    expect(gate).toContain("setVisitorToken");
    expect(gate).not.toContain('router.replace("/login"');
  });

  it("keeps registration and sign-in actions hidden during the free launch", () => {
    expect(welcome).not.toContain('pathname: "/login"');
    expect(welcome).not.toContain("إنشاء حساب معلن");
    expect(welcome).not.toContain("تسجيل الدخول");
    expect(profile).not.toContain('router.push("/login"');
    expect(profile).toContain("النشر مجاني ومباشر الآن");
  });
});

describe("guest content migration", () => {
  const migration = readFileSync(
    new URL("../drizzle/0010_guest_profiles_posts_sharing.sql", import.meta.url).pathname,
    "utf8",
  );

  it("keeps main ads and profile posts in separate tables", () => {
    expect(migration).toContain("CREATE TABLE `profile_posts`");
    expect(migration).toContain("ALTER TABLE `ads`");
    expect(migration).toContain("`advertiserProfileId`");
    expect(migration).not.toContain("DROP TABLE");
  });

  it("persists guest ownership, idempotency, rolling events and share variants", () => {
    expect(migration).toContain("`ownerVisitorSessionId`");
    expect(migration).toContain("CREATE TABLE `identity_action_events`");
    expect(migration).toContain("identity_action_idempotency_unique");
    expect(migration).toContain("CREATE TABLE `share_media_variants`");
    expect(migration).toContain("CREATE TABLE `advertiser_profiles`");
  });
});
