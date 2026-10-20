import { z } from "zod";

import { foodUnitSchema } from "./food-items.js";

export { barcodeSchema, normalizeBarcode } from "./barcodes.js";
import { barcodeSchema } from "./barcodes.js";

export const foodProductSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{24}$/),
  barcode: barcodeSchema,
  name: z.string().min(1).max(120),
  brand: z.string().nullable(),
  packageDescription: z.string().nullable(),
  packageQuantity: z.number().positive().max(1_000_000).nullable(),
  packageUnit: foodUnitSchema.nullable(),
  provider: z.literal("usda"),
  externalId: z.string(),
  marketCountry: z.string().nullable(),
  sourceUrl: z.url(),
  sourceModifiedAt: z.string().nullable(),
  sourcePublishedAt: z.string().nullable(),
  checkedAt: z.iso.datetime(),
});

export const barcodeLookupSchema = z.object({
  product: foodProductSchema,
  stale: z.boolean(),
});

export type FoodProduct = z.infer<typeof foodProductSchema>;
export type BarcodeLookup = z.infer<typeof barcodeLookupSchema>;
