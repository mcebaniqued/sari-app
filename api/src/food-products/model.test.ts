import { describe, expect, it } from "vitest";
import { FoodProductModel } from "./model.js";

describe("product storage metadata", () => {
  it("makes provider identity unique and raw payload server-only", () => {
    expect(FoodProductModel.schema.indexes()).toContainEqual([
      { provider: 1, externalId: 1 },
      { unique: true },
    ]);
    expect(FoodProductModel.schema.path("providerRaw").options.select).toBe(
      false,
    );
  });
});
