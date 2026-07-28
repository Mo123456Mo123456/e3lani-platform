import { describe, expect, it } from "vitest";

import {
  MEDIA_HARD_LIMITS,
  normalizeMediaPolicy,
  validateMediaMetadata,
} from "../shared/media-policy";

describe("media policy", () => {
  it("uses the required production limits and formats", () => {
    const policy = normalizeMediaPolicy(undefined, undefined);
    expect(policy.imageMaxBytes).toBe(5 * 1024 * 1024);
    expect(policy.videoMaxBytes).toBe(50 * 1024 * 1024);
    expect(policy.allowedImageMimeTypes).toEqual(["image/jpeg", "image/png", "image/webp"]);
    expect(policy.allowedVideoMimeTypes).toEqual(["video/mp4"]);
    expect(policy.maxImages).toBe(10);
    expect(policy.maxVideos).toBe(1);
  });

  it("never lets database configuration exceed hard safety limits", () => {
    const policy = normalizeMediaPolicy(
      {
        imageMaxBytes: 500 * 1024 * 1024,
        videoMaxBytes: 900 * 1024 * 1024,
        allowedImageMimeTypes: ["image/svg+xml", "image/jpeg"],
        allowedVideoMimeTypes: ["video/quicktime", "video/mp4"],
      },
      { maxImages: 99, maxVideos: 9 },
    );
    expect(policy.imageMaxBytes).toBe(MEDIA_HARD_LIMITS.imageMaxBytes);
    expect(policy.videoMaxBytes).toBe(MEDIA_HARD_LIMITS.videoMaxBytes);
    expect(policy.allowedImageMimeTypes).toEqual(["image/jpeg"]);
    expect(policy.allowedVideoMimeTypes).toEqual(["video/mp4"]);
    expect(policy.maxImages).toBe(10);
    expect(policy.maxVideos).toBe(1);
  });

  it("rejects unsupported formats and oversized payloads", () => {
    const policy = normalizeMediaPolicy(undefined, undefined);
    expect(() => validateMediaMetadata({ mimeType: "image/svg+xml", bytes: 100 }, policy)).toThrow(
      "MEDIA_TYPE_NOT_ALLOWED",
    );
    expect(() =>
      validateMediaMetadata(
        { mimeType: "image/jpeg", bytes: MEDIA_HARD_LIMITS.imageMaxBytes + 1 },
        policy,
      ),
    ).toThrow("MEDIA_SIZE_EXCEEDED");
    expect(() =>
      validateMediaMetadata(
        { mimeType: "video/mp4", bytes: MEDIA_HARD_LIMITS.videoMaxBytes + 1 },
        policy,
      ),
    ).toThrow("MEDIA_SIZE_EXCEEDED");
  });

  it("accepts payloads exactly at each configured limit", () => {
    const policy = normalizeMediaPolicy(undefined, undefined);
    expect(
      validateMediaMetadata({ mimeType: "image/webp", bytes: policy.imageMaxBytes }, policy).kind,
    ).toBe("image");
    expect(
      validateMediaMetadata({ mimeType: "video/mp4", bytes: policy.videoMaxBytes }, policy).kind,
    ).toBe("video");
  });
});
