import { describe, expect, it } from "vitest";

import { mapUsdaFood, selectUsdaFood } from "./usda.js";

const barcode = "00012345678905";
const food = {
  fdcId: 123,
  dataType: "Branded",
  gtinUpc: "012345678905",
  description: "Oats",
  marketCountry: "United States",
  packageWeight: "500 g",
  servingSize: 30,
  servingSizeUnit: "g",
  publicationDate: "2025-01-01",
};

describe("USDA mapping", () => {
  it("selects a current exact barcode rather than an unrelated first search hit", () => {
    expect(
      selectUsdaFood(
        {
          foods: [
            { ...food, gtinUpc: "96385074" },
            food,
            { ...food, fdcId: 456, publicationDate: "2026-01-01" },
          ],
        },
        barcode,
      ),
    ).toBe("456");
  });
  it("reports a real miss separately from incomplete or ambiguous search results", () => {
    expect(() => selectUsdaFood({ foods: [] }, barcode)).toThrow(
      "Product not found",
    );
    expect(() =>
      selectUsdaFood({ foods: [], totalHits: 300 }, barcode),
    ).toThrow("exact product match");
    expect(() =>
      selectUsdaFood(
        {
          foods: [
            food,
            { ...food, fdcId: 456, description: "Different product" },
          ],
        },
        barcode,
      ),
    ).toThrow("multiple possible");
  });
  it("keeps package contents separate from serving size and nutrition", () => {
    const mapped = mapUsdaFood(food, barcode);
    expect(mapped).toMatchObject({
      name: "Oats",
      packageQuantity: 500,
      packageUnit: "g",
      externalId: "123",
    });
    expect(mapped).not.toHaveProperty("servingSize");
  });
  it("maps the ONZ weight code returned by the live USDA Cheerios record", () => {
    expect(
      mapUsdaFood({ ...food, packageWeight: "18 ONZ" }, barcode),
    ).toMatchObject({ packageQuantity: 18, packageUnit: "oz" });
  });
  it.each([
    ["10 fl oz/296 mL", 10, "fl oz"],
    ["296 mL / 10 fl oz", 10, "fl oz"],
    ["10 fl oz (296 mL)", 10, "fl oz"],
    ["296 mL (10 fl oz)", 10, "fl oz"],
    ["16 oz (454g)", 16, "oz"],
    ["454 g / 16 ONZ", 16, "oz"],
    ["1 kg / 2.2 lb", 2.2, "lb"],
    ["1 fl oz / 30 mL", 1, "fl oz"],
  ])(
    "prefers the printed imperial size in %s",
    (packageWeight, packageQuantity, packageUnit) => {
      expect(mapUsdaFood({ ...food, packageWeight }, barcode)).toMatchObject({
        packageQuantity,
        packageUnit,
      });
    },
  );
  it("keeps metric-only sizes as printed until conversion preferences are supported", () => {
    expect(
      mapUsdaFood({ ...food, packageWeight: "296 mL" }, barcode),
    ).toMatchObject({ packageQuantity: 296, packageUnit: "ml" });
  });
  it.each([
    undefined,
    "6 x 30 g",
    "0 g",
    "3 cups",
    "16 fl. oz",
    "10 fl oz/100 mL",
    "20 fl oz/1 L",
    "10 oz/296 mL",
    "5 oz/6 oz",
    "10 fl oz/0 mL",
    "6 x 10 fl oz/1776 mL",
    "10 fl oz/296 mL/another size",
  ])("does not guess package size from %s", (packageWeight) => {
    expect(mapUsdaFood({ ...food, packageWeight }, barcode)).toMatchObject({
      packageQuantity: null,
      packageUnit: null,
    });
  });
  it("rejects wrong identity, malformed responses, and unusable names", () => {
    expect(() =>
      mapUsdaFood({ ...food, gtinUpc: "96385074" }, barcode),
    ).toThrow("did not match");
    expect(() =>
      mapUsdaFood({ ...food, description: "a".repeat(121) }, barcode),
    ).toThrow("could not be used");
    expect(() => selectUsdaFood({}, barcode)).toThrow("invalid search");
  });
});
