import { describe, expect, it } from "vitest";
import { expirationStatus } from "./expirationStatus";

describe("expiration status by local calendar date", () => {
  const reference = new Date(2026, 9, 21, 23, 45);

  it.each([
    [null, "No date", "none"],
    ["2026-10-18", "3 days past date", "past"],
    ["2026-10-20", "1 day past date", "past"],
    ["2026-09-28", "23 days past date", "past"],
    ["2026-10-21", "Today", "soon"],
    ["2026-10-22", "Tomorrow", "soon"],
    ["2026-10-23", "In 2 days", "upcoming"],
    ["2026-10-28", "In 7 days", "upcoming"],
    ["2026-10-29", "In 8 days", "later"],
  ] as const)("maps %s to %s", (date, text, treatment) => {
    expect(expirationStatus(date, reference)).toEqual({ text, treatment });
  });

  it.each([
    ["2027-01-01", new Date(2026, 11, 31, 23, 59), "Tomorrow"],
    ["2028-02-29", new Date(2028, 1, 28, 23, 59), "Tomorrow"],
    ["2028-03-01", new Date(2028, 1, 29, 23, 59), "Tomorrow"],
    ["2026-11-01", new Date(2026, 9, 31, 23, 59), "Tomorrow"],
  ])("crosses calendar boundaries for %s", (date, now, text) => {
    expect(expirationStatus(date, now).text).toBe(text);
  });

  it("uses the viewer's local date even when the UTC date differs", () => {
    const localMidnight = new Date(2026, 9, 21, 0, 15);
    expect(expirationStatus("2026-10-21", localMidnight).text).toBe("Today");
    expect(expirationStatus("2026-10-22", localMidnight).text).toBe("Tomorrow");
  });
});
