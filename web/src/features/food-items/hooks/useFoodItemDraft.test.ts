import { describe, expect, it } from "vitest";
import { normalizedFoodItemEdit } from "./useFoodItemDraft";

describe("normalized food item edits", () => {
  it("normalizes text, quantity, and an empty date", () => {
    expect(
      normalizedFoodItemEdit(
        {
          name: " Milk ",
          quantity: "00.500",
          unit: "l",
          expiresOn: "",
        },
        { productId: null, barcode: null },
      ),
    ).toEqual({
      name: "Milk",
      quantity: 0.5,
      unit: "l",
      expiresOn: null,
      productId: null,
      barcode: null,
    });
  });

  it("includes meaningful product-link changes", () => {
    const values = {
      name: "Milk",
      quantity: "1",
      unit: "l",
      expiresOn: "2026-11-01",
    };
    const linked = normalizedFoodItemEdit(values, {
      productId: "012345678901234567890123",
      barcode: "00012345678905",
    });
    const unlinked = normalizedFoodItemEdit(values, {
      productId: null,
      barcode: null,
    });

    expect(unlinked).not.toEqual(linked);
  });
});
