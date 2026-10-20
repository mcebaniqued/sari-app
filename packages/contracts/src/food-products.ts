import { z } from "zod";

import { foodUnitSchema } from "./food-items.js";

/** Canonical GTIN-14 identity. UPC-A/EAN-13 padding is identity-preserving. */
export function normalizeBarcode(value: string): string | null {
  const digits = value.trim();
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(digits)) {
    return null;
  }
  let sum = 0;
  for (
    let i = digits.length - 2, weight = 3;
    i >= 0;
    i--, weight = 4 - weight
  ) {
    sum += Number(digits[i]) * weight;
  }
  if ((10 - (sum % 10)) % 10 !== Number(digits.at(-1))) {
    return null;
  }
  return digits.padStart(14, "0");
}

export const barcodeSchema = z
  .string()
  .trim()
  .max(14)
  .transform((value, ctx) => {
    const normalized = normalizeBarcode(value);
    if (!normalized) {
      ctx.addIssue({
        code: "custom",
        message:
          "Enter a valid EAN-8, UPC-A, EAN-13, or GTIN-14 barcode, including its check digit.",
      });
      return z.NEVER;
    }
    return normalized;
  });

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
