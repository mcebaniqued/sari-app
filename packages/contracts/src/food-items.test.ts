import { describe, expect, it } from "vitest";
import { createFoodItemSchema, updateFoodItemSchema } from "./food-items.js";

describe("pantry input contracts", () => {
  it("trims a new name and supplies creation defaults", () => {
    expect(createFoodItemSchema.parse({ name: " Rice " })).toEqual({
      name: "Rice",
      quantity: 1,
      unit: "item",
      expiresOn: null,
    });
  });

  it("preserves omitted PATCH fields while allowing an explicit clear", () => {
    expect(updateFoodItemSchema.parse({ name: " Oats " })).toEqual({
      name: "Oats",
    });
    expect(
      updateFoodItemSchema.parse({
        expiresOn: null,
        productId: null,
        barcode: null,
      }),
    ).toEqual({
      expiresOn: null,
      productId: null,
      barcode: null,
    });
    expect(updateFoodItemSchema.safeParse({}).success).toBe(false);
  });

  it.each([
    { quantity: 0 },
    { quantity: -1 },
    { quantity: 1_000_001 },
    { expiresOn: "2026-02-30" },
    { expiresOn: "2026-02-01T00:00:00Z" },
    { id: "012345678901234567890123" },
    { userId: "another-user" },
    { $set: { name: "Injected" } },
  ])("rejects invalid values and server-owned fields: %j", (invalid) => {
    expect(
      createFoodItemSchema.safeParse({ name: "Rice", ...invalid }).success,
    ).toBe(false);
    expect(updateFoodItemSchema.safeParse(invalid).success).toBe(false);
  });

  it("keeps leap-day dates and canonical barcode identity without converting quantities", () => {
    expect(
      createFoodItemSchema.parse({
        name: "Oats",
        quantity: 0.5,
        unit: "lb",
        expiresOn: "2028-02-29",
        barcode: "012345678905",
      }),
    ).toMatchObject({
      quantity: 0.5,
      unit: "lb",
      expiresOn: "2028-02-29",
      barcode: "00012345678905",
    });
  });
});
