import { describe, expect, it } from "vitest";

import {
  DEFAULT_FEED_ACCESS_MODE,
  initialAdStatusForMode,
  requiresPaymentForPublishing,
  resolveFeedAccessMode,
} from "../shared/feed-access";
import { validateSaudiWhatsapp } from "../shared/contact-validation";
import {
  DEFAULT_PUBLIC_USER_ROLE,
  stripRoleFromPublicProfile,
} from "../shared/user-role-policy";

describe("free launch feed policy", () => {
  it("defaults invalid and missing values to LAUNCH_FREE", () => {
    expect(DEFAULT_FEED_ACCESS_MODE).toBe("LAUNCH_FREE");
    expect(resolveFeedAccessMode(undefined)).toBe("LAUNCH_FREE");
    expect(resolveFeedAccessMode("unknown")).toBe("LAUNCH_FREE");
    expect(resolveFeedAccessMode(" launch_free ")).toBe("LAUNCH_FREE");
  });

  it("sends free and profile-only publishing directly to review", () => {
    expect(initialAdStatusForMode("LAUNCH_FREE")).toBe("pending_review");
    expect(initialAdStatusForMode("ONLY_PROFILE")).toBe("pending_review");
    expect(requiresPaymentForPublishing("LAUNCH_FREE")).toBe(false);
  });

  it("requires payment only in ONLY_PAID", () => {
    expect(initialAdStatusForMode("ONLY_PAID")).toBe("awaiting_payment");
    expect(requiresPaymentForPublishing("ONLY_PAID")).toBe(true);
  });
});

describe("public user role policy", () => {
  it("keeps the public default role as user", () => {
    expect(DEFAULT_PUBLIC_USER_ROLE).toBe("user");
  });

  it("removes administrative role input from public profile data", () => {
    const safe = stripRoleFromPublicProfile({
      name: "Public user",
      role: "owner",
      accountType: "brand",
    });

    expect(safe).toEqual({ name: "Public user", accountType: "brand" });
    expect("role" in safe).toBe(false);
  });
});

describe("Saudi WhatsApp validation", () => {
  it("rejects +966 without a subscriber number", () => {
    expect(validateSaudiWhatsapp("+966")).toEqual({
      valid: false,
      normalized: null,
      reason: "invalid",
    });
  });

  it("normalizes valid local and international mobile numbers", () => {
    expect(validateSaudiWhatsapp("050 123 4567")).toEqual({
      valid: true,
      normalized: "+966501234567",
    });
    expect(validateSaudiWhatsapp("00966-55-123-4567")).toEqual({
      valid: true,
      normalized: "+966551234567",
    });
  });

  it("rejects incomplete or non-mobile Saudi numbers", () => {
    expect(validateSaudiWhatsapp("+96650").valid).toBe(false);
    expect(validateSaudiWhatsapp("+966112345678").valid).toBe(false);
  });
});
