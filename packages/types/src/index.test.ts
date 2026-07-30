import { describe, expect, it } from "vitest";

import {
  contactSchema,
  createPostSchema,
  mediaUploadSchema,
  registerSchema,
} from "./index.js";

describe("shared contracts", () => {
  it("requires a business email", () => {
    expect(
      registerSchema.safeParse({
        name: "متجر الرياض",
        phone: "0500000000",
        cityId: "clz0000000000000000000000",
        accountType: "STORE",
        acceptedTerms: true,
        acceptedPrivacy: true,
      }).success,
    ).toBe(false);
  });

  it("only accepts https outbound links", () => {
    expect(contactSchema.safeParse({ type: "STORE_URL", value: "http://example.com" }).success).toBe(
      false,
    );
    expect(
      contactSchema.safeParse({ type: "STORE_URL", value: "https://example.com" }).success,
    ).toBe(true);
  });

  it("requires media for a post", () => {
    expect(
      createPostSchema.safeParse({
        title: "إعلان حقيقي",
        categoryId: "clz0000000000000000000000",
        cityId: "clz0000000000000000000000",
        mediaIds: [],
        contact: { type: "PHONE", value: "0500000000" },
      }).success,
    ).toBe(false);
  });

  it("enforces image limits", () => {
    expect(
      mediaUploadSchema.safeParse({
        fileName: "large.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 11 * 1024 * 1024,
        kind: "IMAGE",
        purpose: "POST",
      }).success,
    ).toBe(false);
  });
});
