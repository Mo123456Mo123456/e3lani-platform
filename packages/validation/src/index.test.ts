import { describe, expect, it } from "vitest";
import {
  contributionTextSchema,
  loginSchema,
  registerSchema,
  simControlSchema,
  structuredContributionSchema,
} from "./index";

describe("registerSchema", () => {
  it("accepts a strong password", () => {
    const r = registerSchema.safeParse({
      email: "a@b.co",
      password: "Str0ngPassword",
      displayName: "Test User",
    });
    expect(r.success).toBe(true);
  });
  it("rejects weak passwords", () => {
    expect(
      registerSchema.safeParse({ email: "a@b.co", password: "short", displayName: "X" }).success,
    ).toBe(false);
    expect(
      registerSchema.safeParse({ email: "a@b.co", password: "no-digits-hereAA", displayName: "X" }).success,
    ).toBe(false);
  });
  it("rejects invalid email", () => {
    expect(
      registerSchema.safeParse({ email: "nope", password: "Str0ngPassword", displayName: "X" }).success,
    ).toBe(false);
  });
});

describe("loginSchema", () => {
  it("requires password presence", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
  });
});

describe("contributionTextSchema", () => {
  it("caps text length at 1200", () => {
    expect(contributionTextSchema.safeParse({ text: "x".repeat(1201) }).success).toBe(false);
    expect(contributionTextSchema.safeParse({ text: "شجرة جديدة" }).success).toBe(true);
  });
});

describe("structuredContributionSchema", () => {
  it("fills defaults", () => {
    const r = structuredContributionSchema.parse({ category: "plant", name: "X" });
    expect(r.traits).toEqual({});
    expect(r.sandbox).toBe(true);
    expect(r.risks).toEqual([]);
  });
  it("rejects unknown categories", () => {
    expect(structuredContributionSchema.safeParse({ category: "alien", name: "X" }).success).toBe(false);
  });
});

describe("simControlSchema", () => {
  it("validates actions", () => {
    expect(simControlSchema.safeParse({ action: "pause" }).success).toBe(true);
    expect(simControlSchema.safeParse({ action: "explode" }).success).toBe(false);
  });
});
