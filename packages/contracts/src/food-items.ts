import { z } from "zod";
import { barcodeSchema } from "./barcodes.js";

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
  productId: z
    .string()
    .regex(/^[a-f0-9]{24}$/)
    .nullable()
    .optional(),
  barcode: barcodeSchema.nullable().optional(),
};

export const foodItemRevisionContractHeader = "Sari-Revision-Contract";
export const foodItemRevisionContractVersion = "1";
export const foodItemRevisionSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);

export const createFoodItemSchema = z.strictObject({
  ...foodItemFields,
  quantity: foodItemFields.quantity.default(1),
  unit: foodUnitSchema.default("item"),
  expiresOn: foodItemFields.expiresOn.default(null),
});

// PATCH has no creation defaults: omitted fields retain their stored values.
const foodItemChangesSchema = z
  .strictObject(foodItemFields)
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Provide at least one field to update.",
  );

export const updateFoodItemSchema = z.strictObject({
  expectedRevision: foodItemRevisionSchema,
  changes: foodItemChangesSchema,
});

export const foodItemIdSchema = z.string().regex(/^[a-f0-9]{24}$/);

export const foodItemSchema = z.strictObject({
  ...foodItemFields,
  id: foodItemIdSchema,
  // Missing revisions are accepted only for compatibility with the previous
  // API during the staged rollout. Revision-qualified mutations remain
  // mandatory, so this fallback cannot enable an unprotected write.
  revision: foodItemRevisionSchema.default(0),
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
