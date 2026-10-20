import { z } from "zod";

// Volume units outside the metric system use US customary measures.
export const foodUnitSchema = z.enum([
  "item",
  "g",
  "kg",
  "ml",
  "l",
  "oz",
  "lb",
  "fl oz",
  "tsp",
  "tbsp",
  "cup",
  "pt",
  "qt",
  "gal",
]);

const foodItemFields = {
  name: z.string().trim().min(1, "Enter a food name.").max(120),
  quantity: z
    .number()
    .positive("Quantity must be greater than zero.")
    .max(1_000_000),
  unit: foodUnitSchema,
  // A package date is a calendar date, not a timestamp in a timezone.
  expiresOn: z.iso.date().nullable(),
};

export const createFoodItemSchema = z.strictObject({
  ...foodItemFields,
  quantity: foodItemFields.quantity.default(1),
  unit: foodUnitSchema.default("item"),
  expiresOn: foodItemFields.expiresOn.default(null),
});

// PATCH has no creation defaults: omitted fields retain their stored values.
export const updateFoodItemSchema = z
  .strictObject(foodItemFields)
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Provide at least one field to update.",
  );

export const foodItemIdSchema = z.string().regex(/^[a-f0-9]{24}$/);

export const foodItemSchema = z.strictObject({
  ...foodItemFields,
  id: foodItemIdSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const foodItemListSchema = z.strictObject({
  items: z.array(foodItemSchema),
  total: z.number().int().nonnegative(),
  start: z.number().int().nonnegative(),
  limit: z.number().int().min(1).max(100),
});

export type CreateFoodItem = z.infer<typeof createFoodItemSchema>;
export type UpdateFoodItem = z.infer<typeof updateFoodItemSchema>;
export type FoodItem = z.infer<typeof foodItemSchema>;
