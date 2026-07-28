import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ENV } from "../server/_core/env";
import {
  isS3MultipartConfigured,
  presignUploadPart,
} from "../server/s3-multipart";

const original = {
  endpoint: ENV.s3Endpoint,
  region: ENV.s3Region,
  bucket: ENV.s3Bucket,
  accessKeyId: ENV.s3AccessKeyId,
  secretAccessKey: ENV.s3SecretAccessKey,
  sessionToken: ENV.s3SessionToken,
  forcePathStyle: ENV.s3ForcePathStyle,
};

beforeEach(() => {
  ENV.s3Endpoint = "https://storage.example.com";
  ENV.s3Region = "auto";
  ENV.s3Bucket = "e3lani-media";
  ENV.s3AccessKeyId = "test-access-key";
  ENV.s3SecretAccessKey = "test-secret-key";
  ENV.s3SessionToken = "";
  ENV.s3ForcePathStyle = true;
});

afterEach(() => {
  ENV.s3Endpoint = original.endpoint;
  ENV.s3Region = original.region;
  ENV.s3Bucket = original.bucket;
  ENV.s3AccessKeyId = original.accessKeyId;
  ENV.s3SecretAccessKey = original.secretAccessKey;
  ENV.s3SessionToken = original.sessionToken;
  ENV.s3ForcePathStyle = original.forcePathStyle;
});

describe("S3 multipart signing", () => {
  it("reports configuration only when all required values are present", () => {
    expect(isS3MultipartConfigured()).toBe(true);
    ENV.s3Bucket = "";
    expect(isS3MultipartConfigured()).toBe(false);
  });

  it("creates deterministic part URLs scoped to the bucket, upload, and part", () => {
    const now = new Date("2026-07-28T12:34:56.000Z");
    const first = presignUploadPart({
      key: "media/resumable/7/a/video.mp4",
      uploadId: "upload+id/one",
      partNumber: 1,
      expiresSeconds: 900,
      now,
    });
    const repeated = presignUploadPart({
      key: "media/resumable/7/a/video.mp4",
      uploadId: "upload+id/one",
      partNumber: 1,
      expiresSeconds: 900,
      now,
    });
    const secondPart = presignUploadPart({
      key: "media/resumable/7/a/video.mp4",
      uploadId: "upload+id/one",
      partNumber: 2,
      expiresSeconds: 900,
      now,
    });

    expect(first).toBe(repeated);
    expect(secondPart).not.toBe(first);

    const url = new URL(first);
    expect(url.pathname).toBe("/e3lani-media/media/resumable/7/a/video.mp4");
    expect(url.searchParams.get("partNumber")).toBe("1");
    expect(url.searchParams.get("uploadId")).toBe("upload+id/one");
    expect(url.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(url.searchParams.get("X-Amz-Date")).toBe("20260728T123456Z");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("900");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("includes temporary credential tokens without exposing the secret key", () => {
    ENV.s3SessionToken = "temporary-session-token";
    const url = presignUploadPart({
      key: "video.mp4",
      uploadId: "upload-id",
      partNumber: 1,
      now: new Date("2026-07-28T12:34:56.000Z"),
    });

    expect(url).toContain("X-Amz-Security-Token=temporary-session-token");
    expect(url).not.toContain(ENV.s3SecretAccessKey);
  });
});
