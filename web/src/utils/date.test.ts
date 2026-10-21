import { describe, expect, it } from "vitest";
import { formatDate } from "./date";

describe("UI dates", () => {
  it("formats dates and timestamps consistently without local timezone shifts", () => {
    expect(formatDate("2028-02-29")).toBe("Feb 29, 2028");
    expect(formatDate("2026-10-01T00:00:00Z")).toBe("Oct 01, 2026");
    expect(formatDate("2026-01-01T00:00:00+08:00")).toBe("Dec 31, 2025");
  });
  it("leaves missing or invalid dates blank", () => {
    expect(formatDate("")).toBe("");
    expect(formatDate("not a date")).toBe("");
  });
});
