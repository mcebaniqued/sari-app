import { describe, expect, it } from "vitest";
import { formatDate, formatLocalTimestamp, formatTimestamp } from "./date";

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
  it("formats timestamps with their time in the documented UTC zone", () => {
    expect(formatTimestamp("2026-10-19T17:45:00Z")).toBe(
      "Oct 19, 2026, 5:45 PM UTC",
    );
    expect(formatTimestamp("not a date")).toBe("");
  });
  it("formats local timestamps without changing date-only formatting", () => {
    const value = "2026-10-19T17:45:00Z";
    const expected = new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
      month: "short",
      timeZoneName: "short",
      year: "numeric",
    }).format(new Date(value));

    expect(formatLocalTimestamp(value)).toBe(expected);
    expect(formatLocalTimestamp("not a date")).toBe("");
    expect(formatDate("2028-02-29")).toBe("Feb 29, 2028");
  });
});
