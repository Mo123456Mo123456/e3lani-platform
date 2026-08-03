import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { createWatermarkedShareVideo } from "../server/video-processing";

const hasFfmpeg = existsSync("/usr/bin/ffmpeg") && existsSync("/usr/bin/ffprobe");

describe("video share watermark", () => {
  it.skipIf(!hasFfmpeg)(
    "creates a separate 9:16 MP4 without modifying the original",
    async () => {
      const directory = mkdtempSync(join(tmpdir(), "e3lani-watermark-test-"));
      const sourcePath = join(directory, "source.mp4");
      const outputPath = join(directory, "share.mp4");
      try {
        execFileSync("ffmpeg", [
          "-hide_banner",
          "-loglevel",
          "error",
          "-y",
          "-f",
          "lavfi",
          "-i",
          "color=c=blue:s=180x320:r=15:d=0.5",
          "-c:v",
          "libx264",
          "-pix_fmt",
          "yuv420p",
          sourcePath,
        ]);
        const source = readFileSync(sourcePath);
        const sourceHash = createHash("sha256").update(source).digest("hex");
        const shared = await createWatermarkedShareVideo(
          source,
          "إعلاني | E3lani\n@test_advertiser",
        );
        writeFileSync(outputPath, shared);
        expect(createHash("sha256").update(readFileSync(sourcePath)).digest("hex")).toBe(sourceHash);
        expect(createHash("sha256").update(shared).digest("hex")).not.toBe(sourceHash);
        const dimensions = execFileSync("ffprobe", [
          "-v",
          "error",
          "-select_streams",
          "v:0",
          "-show_entries",
          "stream=width,height",
          "-of",
          "csv=s=x:p=0",
          outputPath,
        ], { encoding: "utf8" }).trim();
        expect(dimensions).toBe("1080x1920");
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    },
    30_000,
  );
});

