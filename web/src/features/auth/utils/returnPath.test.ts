import { describe, expect, it } from "vitest";
import { safeReturnPath } from "./returnPath";

describe("login return destinations", () => {
  it.each([
    undefined,
    "https://example.com",
    "//example.com",
    "/\\example.com",
    "/\t/example.com",
    "/login",
    "/register?next=/pantry",
  ])("rejects unsafe or auth destinations: %s", (value) => {
    expect(safeReturnPath(value)).toBe("/pantry");
  });
  it("preserves internal destinations and their query string", () => {
    expect(safeReturnPath("/pantry?search=rice#items")).toBe(
      "/pantry?search=rice#items",
    );
  });
});
