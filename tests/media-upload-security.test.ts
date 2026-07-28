import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createPresignedPut: vi.fn(),
  getOwnedByStorageKey: vi.fn(),
}));

vi.mock("../server/_core/env", () => ({
  ENV: { cookieSecret: "media-ticket-test-secret", forgeApiKey: "" },
}));

vi.mock("../server/db", () => ({
  getPublicMediaPolicy: vi.fn(async () => ({
    allowedImageMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    allowedVideoMimeTypes: ["video/mp4"],
    imageMaxBytes: 5 * 1024 * 1024,
    videoMaxBytes: 50 * 1024 * 1024,
    maxImages: 10,
    maxVideos: 1,
    requirePrimaryImage: true,
  })),
  getOwnedMediaAssetByStorageKey: mocks.getOwnedByStorageKey,
  createMediaAsset: vi.fn(),
}));

vi.mock("../server/storage", () => ({
  storageCreatePresignedPut: mocks.createPresignedPut,
  storageGetSignedUrl: vi.fn(),
  storagePut: vi.fn(),
}));

import { completeMediaUpload, prepareMediaUpload } from "../server/media-service";

const imageInput = {
  fileName: "ad.webp",
  mimeType: "image/webp",
  bytes: 128_000,
  width: 1080,
  height: 1080,
  durationMs: null,
};

describe("media upload ticket security", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    mocks.getOwnedByStorageKey.mockResolvedValue(null);
    mocks.createPresignedPut.mockResolvedValue({
      key: "media/incoming/user-17/file.webp",
      uploadUrl: "https://storage.example.test/upload",
      headers: { "Content-Type": "image/webp" },
    });
  });

  afterEach(() => vi.useRealTimers());

  it("issues a short-lived ticket with the enforced upload metadata", async () => {
    const prepared = await prepareMediaUpload(17, imageInput);

    expect(prepared.uploadUrl).toBe("https://storage.example.test/upload");
    expect(prepared.headers).toEqual({ "Content-Type": "image/webp" });
    expect(prepared.maxBytes).toBe(5 * 1024 * 1024);
    expect(prepared.expiresAt).toBeGreaterThan(Date.now());
    expect(prepared.ticket.split(".")).toHaveLength(2);
  });

  it("rejects a ticket when a different user attempts completion", async () => {
    const prepared = await prepareMediaUpload(17, imageInput);

    await expect(completeMediaUpload(18, prepared.ticket)).rejects.toThrow("MEDIA_TICKET_INVALID");
    expect(mocks.getOwnedByStorageKey).not.toHaveBeenCalled();
  });

  it("rejects a ticket whose signature was changed", async () => {
    const prepared = await prepareMediaUpload(17, imageInput);
    const [payload, signature] = prepared.ticket.split(".");
    const replacement = signature.endsWith("a") ? "b" : "a";
    const tampered = `${payload}.${signature.slice(0, -1)}${replacement}`;

    await expect(completeMediaUpload(17, tampered)).rejects.toThrow("MEDIA_TICKET_INVALID");
    expect(mocks.getOwnedByStorageKey).not.toHaveBeenCalled();
  });

  it("rejects an expired ticket before any storage or database lookup", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-28T12:00:00.000Z"));
    const prepared = await prepareMediaUpload(17, imageInput);
    vi.setSystemTime(new Date("2026-07-28T12:16:00.000Z"));

    await expect(completeMediaUpload(17, prepared.ticket)).rejects.toThrow("MEDIA_TICKET_EXPIRED");
    expect(mocks.getOwnedByStorageKey).not.toHaveBeenCalled();
  });

  it("rejects an oversized image before requesting a presigned URL", async () => {
    await expect(
      prepareMediaUpload(17, { ...imageInput, bytes: 5 * 1024 * 1024 + 1 }),
    ).rejects.toThrow("MEDIA_SIZE_EXCEEDED");
    expect(mocks.createPresignedPut).not.toHaveBeenCalled();
  });
});
