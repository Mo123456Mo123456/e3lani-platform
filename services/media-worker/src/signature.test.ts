import { describe, expect, it } from "vitest";
import { detectMedia } from "./signature";

describe("media signature detection", () => {
  it("detects supported image signatures", () => {
    expect(detectMedia(Buffer.from([0xff, 0xd8, 0xff, 0x00]))).toBe("jpeg");
    expect(
      detectMedia(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    ).toBe("png");
    expect(detectMedia(Buffer.from("RIFFxxxxWEBP", "ascii"))).toBe("webp");
  });

  it("distinguishes QuickTime from MP4 containers", () => {
    expect(detectMedia(Buffer.from("xxxxftypqt  ", "ascii"))).toBe("mov");
    expect(detectMedia(Buffer.from("xxxxftypisom", "ascii"))).toBe("mp4");
  });

  it("rejects content based on extension-free bytes", () => {
    expect(detectMedia(Buffer.from("<svg></svg>"))).toBeNull();
  });
});
