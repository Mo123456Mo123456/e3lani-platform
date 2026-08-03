import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("production safety hardening", () => {
  it("restricts origins and avoids shared parent-domain cookies", () => {
    const server = read("server/_core/index.ts");
    const cookies = read("server/_core/cookies.ts");
    expect(server).toContain("ORIGIN_NOT_ALLOWED");
    expect(server).toContain("allowedOrigins.has(origin)");
    expect(cookies).toContain('sameSite: "lax"');
    expect(cookies).not.toContain("parts.slice(-2)");
  });

  it("requires schema verification, storage, ffmpeg and Docker production runtime", () => {
    expect(read("render.yaml")).toContain("runtime: docker");
    expect(read("Dockerfile")).toContain("ffmpeg");
    expect(read("Dockerfile")).toContain(".npmrc");
    expect(read("scripts/production-start.mjs")).toContain("verify-production-schema.mjs");
    expect(read("scripts/verify-production-schema.mjs")).toContain("MIGRATION_0010_PARTIAL_STATE");
  });

  it("scopes idempotency and protects admin-held ads", () => {
    const identity = read("server/content-identity.ts");
    const ads = read("server/ads-service.ts");
    expect(identity).toContain("ownerCondition");
    expect(ads).toContain("AD_ADMIN_HOLD");
    expect(ads).toContain("CITY_NOT_FOUND_FOR_COUNTRY");
    expect(ads).toContain('source: "edited_text"');
  });
});
