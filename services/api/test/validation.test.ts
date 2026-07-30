import { describe, expect, it } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { z } from "zod";
import { parse } from "../src/common";

describe("API validation boundary", () => {
  it("returns typed validated data", () => {
    expect(parse(z.object({ value: z.coerce.number() }), { value: "3" })).toEqual({ value: 3 });
  });

  it("rejects malformed input before domain access", () => {
    expect(() => parse(z.object({ id: z.string().uuid() }), { id: "unsafe" })).toThrow(
      BadRequestException
    );
  });
});
