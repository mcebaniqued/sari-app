import { describe, expect, it } from "vitest";

import {
  apiErrorResponseSchema,
  authSessionSchema,
  barcodeLookupSchema,
  foodItemListSchema,
  foodProductSchema,
  healthResponseSchema,
  notReadyResponseSchema,
} from "./index.js";

const product = {
  id: "012345678901234567890123",
  barcode: "012345678905",
  name: "Oats",
  brand: null,
  packageDescription: "500 g",
  packageQuantity: 500,
  packageUnit: "g",
  provider: "usda",
  externalId: "123",
  marketCountry: "United States",
  sourceUrl: "https://example.com/food/123",
  sourceModifiedAt: null,
  sourcePublishedAt: null,
  checkedAt: "2026-10-20T00:00:00Z",
};

describe("public response contracts", () => {
  it("accepts nullable sessions and normalizes session expiry", () => {
    expect(authSessionSchema.parse(null)).toBeNull();
    const parsed = authSessionSchema.parse({
      user: {
        id: "user-1",
        firstName: "Alex",
        lastName: "Tester",
        email: "alex@example.com",
      },
      session: { expiresAt: "2099-01-01T00:00:00Z" },
    });
    expect(parsed?.session.expiresAt).toEqual(new Date("2099-01-01T00:00:00Z"));
  });

  it("validates product identity and strips server-only provider payloads", () => {
    const result = foodProductSchema.parse({
      ...product,
      providerRaw: { secret: "internal" },
    });
    expect(result.barcode).toBe("00012345678905");
    expect(result).not.toHaveProperty("providerRaw");
    expect(barcodeLookupSchema.parse({ product, stale: true }).stale).toBe(
      true,
    );
    expect(
      foodProductSchema.safeParse({ ...product, packageQuantity: 0 }).success,
    ).toBe(false);
    expect(barcodeLookupSchema.safeParse({ product }).success).toBe(false);
  });

  it("requires complete item responses and bounded list metadata", () => {
    expect(
      foodItemListSchema.parse({ items: [], total: 0, start: 0, limit: 20 })
        .items,
    ).toEqual([]);
    expect(
      foodItemListSchema.safeParse({
        items: [{ name: "Rice" }],
        total: 1,
        start: 0,
        limit: 20,
      }).success,
    ).toBe(false);
    expect(
      foodItemListSchema.safeParse({
        items: [],
        total: -1,
        start: 0,
        limit: 20,
      }).success,
    ).toBe(false);
  });

  it("rejects malformed health and error responses", () => {
    expect(healthResponseSchema.parse({ status: "ok" })).toEqual({
      status: "ok",
    });
    expect(notReadyResponseSchema.parse({ status: "not_ready" })).toEqual({
      status: "not_ready",
    });
    expect(healthResponseSchema.safeParse({ status: "ready" }).success).toBe(
      false,
    );
    expect(
      apiErrorResponseSchema.safeParse({ error: { code: "", message: "" } })
        .success,
    ).toBe(false);
    expect(
      apiErrorResponseSchema.parse({
        error: { code: "NOT_FOUND", message: "Missing item." },
      }).error.code,
    ).toBe("NOT_FOUND");
  });
});
