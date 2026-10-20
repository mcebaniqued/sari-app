import { foodProductSchema, normalizeBarcode } from "@sari/contracts";

import { parsePackageSize } from "./packageSize.js";

export class LookupError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 503,
  ) {
    super(message);
  }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new LookupError(
      "LOOKUP_UNAVAILABLE",
      "USDA returned unusable product details. Continue manually or try again.",
    );
  }
  return value as Record<string, unknown>;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function selectUsdaFood(raw: unknown, barcode: string): string {
  const response = object(raw);
  if (!Array.isArray(response.foods)) {
    throw new LookupError(
      "LOOKUP_UNAVAILABLE",
      "USDA returned an invalid search response.",
    );
  }
  const matches = response.foods
    .map(object)
    .filter(
      (food) =>
        food.dataType === "Branded" &&
        typeof food.gtinUpc === "string" &&
        normalizeBarcode(food.gtinUpc) === barcode &&
        !text(food.discontinuedDate) &&
        Number.isSafeInteger(food.fdcId) &&
        Number(food.fdcId) > 0,
    );
  if (!matches.length) {
    if (Number(response.totalHits) > response.foods.length) {
      throw new LookupError(
        "PRODUCT_AMBIGUOUS",
        "USDA could not establish an exact product match. Continue manually.",
        422,
      );
    }
    throw new LookupError(
      "PRODUCT_NOT_FOUND",
      "Product not found in USDA. Enter the item details manually.",
      404,
    );
  }
  // Prefer the target North American market; never choose a known unrelated market.
  const eligible = matches.filter(
    (food) =>
      !text(food.marketCountry) ||
      /^(united states|canada|mexico)$/i.test(String(food.marketCountry)),
  );
  if (!eligible.length) {
    throw new LookupError(
      "PRODUCT_AMBIGUOUS",
      "This USDA match is for another market. Review the package and enter details manually.",
      422,
    );
  }
  const date = (food: Record<string, unknown>) =>
    Date.parse(text(food.publicationDate) ?? text(food.modifiedDate) ?? "") ||
    0;
  eligible.sort((a, b) => date(b) - date(a));
  const first = eligible[0];
  if (!first) {
    throw new LookupError("PRODUCT_NOT_FOUND", "Product not found.", 404);
  }
  if (
    eligible.some(
      (food) =>
        date(food) === date(first) &&
        food.fdcId !== first.fdcId &&
        (food.description !== first.description ||
          food.marketCountry !== first.marketCountry ||
          food.brandOwner !== first.brandOwner),
    )
  ) {
    throw new LookupError(
      "PRODUCT_AMBIGUOUS",
      "USDA has multiple possible matches. Enter the item details manually.",
      422,
    );
  }
  return String(first.fdcId);
}

export function mapUsdaFood(
  raw: unknown,
  barcode: string,
  checkedAt = new Date(),
) {
  const food = object(raw);
  if (
    food.dataType !== "Branded" ||
    typeof food.gtinUpc !== "string" ||
    normalizeBarcode(food.gtinUpc) !== barcode ||
    !Number.isSafeInteger(food.fdcId) ||
    Number(food.fdcId) <= 0 ||
    Boolean(text(food.discontinuedDate)) ||
    (Boolean(text(food.marketCountry)) &&
      !/^(united states|canada|mexico)$/i.test(text(food.marketCountry) ?? ""))
  ) {
    throw new LookupError(
      "LOOKUP_UNAVAILABLE",
      "USDA details did not match the scanned product. Continue manually.",
    );
  }
  const packageDescription = text(food.packageWeight);
  const result = foodProductSchema.omit({ id: true }).safeParse({
    barcode,
    name: text(food.description),
    brand: text(food.brandName) ?? text(food.brandOwner),
    packageDescription,
    ...parsePackageSize(packageDescription),
    provider: "usda",
    externalId: String(food.fdcId),
    marketCountry: text(food.marketCountry),
    sourceUrl: `https://fdc.nal.usda.gov/food-details/${String(food.fdcId)}/nutrients`,
    sourceModifiedAt: text(food.modifiedDate),
    sourcePublishedAt: text(food.publicationDate),
    checkedAt: checkedAt.toISOString(),
  });
  if (!result.success) {
    throw new LookupError(
      "LOOKUP_UNAVAILABLE",
      "USDA product fields could not be used safely. Enter details manually.",
    );
  }
  return result.data;
}
