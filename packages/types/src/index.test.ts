import { describe, expect, it } from "vitest";

import {
  completeProfileSchema,
  createAdSchema,
  mediaHardLimits,
  requestOtpSchema,
} from "./index.js";

describe("shared product contracts", () => {
  it("normalizes Saudi mobile numbers", () => {
    expect(requestOtpSchema.parse({ phone: "050 123 4567" }).phone).toBe("+966501234567");
  });

  it("requires email for commercial accounts", () => {
    const result = completeProfileSchema.safeParse({
      name: "متجر إعلاني",
      cityId: "fbcab840-20ef-4725-a5dc-1557397ae9bc",
      accountType: "STORE",
      acceptedTerms: true,
      acceptedPrivacy: true,
    });
    expect(result.success).toBe(false);
  });

  it("requires a city for city-scoped advertisements", () => {
    const result = createAdSchema.safeParse({
      title: "إعلان صالح",
      categoryId: "fbcab840-20ef-4725-a5dc-1557397ae9bc",
      subcategoryId: "69731b61-8225-4c10-8645-a8b12d98a6ad",
      audienceScope: "CITY",
      mediaIds: ["f7d4a8da-4e7f-4c73-a47c-51dfc8b8390a"],
      contacts: [{ type: "PHONE", value: "+966501234567" }],
    });
    expect(result.success).toBe(false);
  });

  it("keeps required media limits explicit", () => {
    expect(mediaHardLimits.maxImages).toBe(5);
    expect(mediaHardLimits.maxVideoDurationSeconds).toBe(60);
  });
});
