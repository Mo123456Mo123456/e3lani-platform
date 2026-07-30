import { describe, expect, it } from "vitest";
import { completeProfileSchema, contactSchema, createAdSchema } from "./index";

describe("public input contracts", () => {
  it("requires email for a commercial account", () => {
    const result = completeProfileSchema.safeParse({
      name: "متجر الرياض",
      cityId: "19ccdc79-1f6b-4704-839a-eec787b65e54",
      accountType: "STORE",
      acceptedTerms: true
    });
    expect(result.success).toBe(false);
  });

  it("rejects insecure external contact links", () => {
    expect(contactSchema.safeParse({ type: "EXTERNAL", value: "http://example.com" }).success).toBe(
      false
    );
  });

  it("accepts one to five ordered media assets", () => {
    const input = {
      title: "إعلان موثوق",
      categoryId: "2dc18397-79e5-4ff3-b8d6-aa9557192f4c",
      subcategoryId: "c96b79a2-30a8-49cf-a760-c6395dd09541",
      cityId: "19ccdc79-1f6b-4704-839a-eec787b65e54",
      scope: "CITY",
      media: [{ assetId: "d4e5c4d1-1aef-46cf-9a26-18b6b3bccb2e", order: 0 }],
      contact: { type: "WHATSAPP", value: "+966500000000" }
    };
    expect(createAdSchema.safeParse(input).success).toBe(true);
  });
});
