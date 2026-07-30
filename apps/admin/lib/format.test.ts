import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatDateTime, formatPercent, humanizeReason } from "./format.ts";

describe("admin display helpers", () => {
  it("formats ratios as percentages without changing the value", () => {
    assert.match(formatPercent(0.74), /٧٤/);
  });

  it("labels known snapshot reasons and safely falls back", () => {
    assert.equal(humanizeReason("contribution_commit"), "اعتماد مساهمة");
    assert.equal(humanizeReason("manual_checkpoint"), "manual checkpoint");
  });

  it("does not expose an invalid date", () => {
    assert.equal(formatDateTime("not-a-date"), "غير معروف");
  });
});
