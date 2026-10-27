import { createFoodItemSchema, updateFoodItemSchema } from "@sari/contracts";
import { describe, expect, it } from "vitest";
import { FoodItemModel } from "./model.js";

describe("food units across contracts and storage", () => {
  it.each(["oz", "lb", "fl oz", "tsp", "tbsp", "cup", "pt", "qt", "gal"])(
    "accepts %s without changing the entered quantity",
    async (unit) => {
      const input = { name: "Pantry item", quantity: 1.5, unit };
      const created = createFoodItemSchema.parse(input);
      expect(created).toMatchObject(input);
      expect(
        updateFoodItemSchema.parse({
          expectedRevision: 0,
          changes: { unit },
        }),
      ).toEqual({ expectedRevision: 0, changes: { unit } });
      const model = new FoodItemModel({ ...created, userId: "unit-test-user" });
      await expect(model.validate()).resolves.toBeUndefined();
      expect(model.toObject()).toMatchObject(input);
    },
  );
});
