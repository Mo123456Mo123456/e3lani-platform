import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { validateContact } from "./platform.js";

describe("advertisement contact validation", () => {
  it("accepts HTTPS destinations and Saudi-style phone values", () => {
    expect(() => validateContact("STORE", "https://example.sa/shop")).not.toThrow();
    expect(() => validateContact("PHONE", "+966501234567")).not.toThrow();
  });

  it("blocks unsafe external protocols", () => {
    expect(() => validateContact("EXTERNAL", "javascript:alert(1)")).toThrow(
      BadRequestException,
    );
  });
});
