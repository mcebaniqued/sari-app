import { type BarcodeLookup, foodProductSchema } from "@sari/contracts";

import {
  BarcodeLookupModel,
  FoodProductModel,
  UsdaBudgetModel,
} from "./model.js";
import { parsePackageSize } from "./packageSize.js";
import { LookupError, mapUsdaFood, selectUsdaFood } from "./usda.js";

const day = 86_400_000;
const pending = new Map<string, Promise<BarcodeLookup>>();

export function productDto(product: InstanceType<typeof FoodProductModel>) {
  // Older cached products can have an unrecognized label but no parsed size.
  // Derive missing suggestions without refreshing USDA or changing source dates.
  const hasSize =
    typeof product.packageQuantity === "number" &&
    typeof product.packageUnit === "string";

  return foodProductSchema.parse({
    ...product.toObject(),
    ...(!hasSize ? parsePackageSize(product.packageDescription) : {}),
    id: product._id.toHexString(),
    checkedAt: product.checkedAt.toISOString(),
  });
}

function duplicate(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}

async function reserveCall() {
  const hour = Math.floor(Date.now() / 3_600_000);

  try {
    await UsdaBudgetModel.findOneAndUpdate(
      { _id: `usda-${hour}`, calls: { $lt: 900 } },
      {
        $inc: { calls: 1 },
        $setOnInsert: { expiresAt: new Date((hour + 2) * 3_600_000) },
      },
      { upsert: true },
    );
  } catch (error) {
    if (duplicate(error)) {
      throw new LookupError(
        "LOOKUP_LIMITED",
        "Product lookup limit reached. Continue manually or try again later.",
        429,
      );
    }

    throw error;
  }
}

async function usdaRequest(
  path: string,
  parameters: Record<string, string>,
  signal: AbortSignal,
) {
  const key = process.env.USDA_API_KEY?.trim();
  if (!key) {
    throw new LookupError(
      "LOOKUP_UNAVAILABLE",
      "USDA lookup is not configured. You can still enter item details manually.",
    );
  }

  await reserveCall();
  const url = new URL(`https://api.nal.usda.gov/fdc/v1/${path}`);
  url.search = new URLSearchParams({ ...parameters, api_key: key }).toString();
  const response = await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (response.status === 429) {
    throw new LookupError(
      "LOOKUP_LIMITED",
      "USDA lookup limit reached. Continue manually or try again later.",
      429,
    );
  }

  if (!response.ok) {
    throw new LookupError(
      "LOOKUP_UNAVAILABLE",
      "USDA lookup is unavailable. Continue manually or try again.",
    );
  }

  const body = await response.text();
  if (body.length > 2_000_000) {
    throw new LookupError(
      "LOOKUP_UNAVAILABLE",
      "USDA returned too much data. Continue manually.",
    );
  }

  return JSON.parse(body) as unknown;
}

async function refresh(barcode: string): Promise<BarcodeLookup> {
  const now = new Date();

  // Create the coordination record once; competing upserts may race on its unique barcode.
  try {
    await BarcodeLookupModel.updateOne(
      { barcode },
      { $setOnInsert: { barcode } },
      { upsert: true },
    );
  } catch (error) {
    if (!duplicate(error)) {
      throw error;
    }
  }
  const cached = await BarcodeLookupModel.findOne({ barcode });
  const product = cached?.productId
    ? await FoodProductModel.findById(cached.productId)
    : null;
  if (cached?.refreshAfter && cached.refreshAfter > now) {
    if (product) {
      return { product: productDto(product), stale: false };
    }

    throw new LookupError(
      "PRODUCT_NOT_FOUND",
      "Product not found in USDA. Enter details manually.",
      404,
    );
  }

  if (cached?.retryAfter && cached.retryAfter > now) {
    if (product) {
      return { product: productDto(product), stale: true };
    }

    throw new LookupError(
      "LOOKUP_UNAVAILABLE",
      "Lookup is temporarily unavailable. Continue manually or retry shortly.",
    );
  }

  const lease = await BarcodeLookupModel.findOneAndUpdate(
    { barcode, leaseUntil: { $lte: now } },
    { $set: { leaseUntil: new Date(now.getTime() + 20_000) } },
    { returnDocument: "after" },
  );
  if (!lease) {
    if (product) {
      return { product: productDto(product), stale: true };
    }

    throw new LookupError(
      "LOOKUP_BUSY",
      "This product is being looked up. Try again shortly, or continue manually.",
    );
  }

  try {
    const signal = AbortSignal.timeout(10_000);
    const variants = [
      barcode,
      ...[13, 12, 8]
        .filter((length) => /^0*$/.test(barcode.slice(0, 14 - length)))
        .map((length) => barcode.slice(-length)),
    ];
    const search = await usdaRequest(
      "foods/search",
      {
        query: variants.join(" "),
        dataType: "Branded",
        pageSize: "200",
        requireAllWords: "false",
      },
      signal,
    );
    const id = selectUsdaFood(search, barcode);
    const raw = await usdaRequest(`food/${id}`, {}, signal);
    const mapped = mapUsdaFood(raw, barcode, now);
    if (mapped.externalId !== id) {
      throw new LookupError(
        "LOOKUP_UNAVAILABLE",
        "USDA returned an inconsistent product identity.",
      );
    }

    const updated = await FoodProductModel.findOneAndUpdate(
      { provider: "usda", externalId: id },
      { $set: { ...mapped, checkedAt: now, providerRaw: raw } },
      { upsert: true, returnDocument: "after", runValidators: true },
    );
    await BarcodeLookupModel.updateOne(
      { barcode },
      {
        $set: {
          productId: updated._id,
          checkedAt: now,
          refreshAfter: new Date(now.getTime() + 30 * day),
          retryAfter: new Date(0),
        },
      },
    );

    return { product: productDto(updated), stale: false };
  } catch (error) {
    if (error instanceof LookupError && error.code === "PRODUCT_NOT_FOUND") {
      await BarcodeLookupModel.updateOne(
        { barcode },
        {
          $set: {
            productId: null,
            checkedAt: now,
            refreshAfter: new Date(now.getTime() + day),
          },
        },
      );
      throw error;
    }

    await BarcodeLookupModel.updateOne(
      { barcode },
      { $set: { retryAfter: new Date(now.getTime() + 60_000) } },
    );
    if (product) {
      return { product: productDto(product), stale: true };
    }

    if (error instanceof LookupError) {
      throw error;
    }

    throw new LookupError(
      "LOOKUP_UNAVAILABLE",
      "USDA lookup could not finish. Continue manually or try again.",
    );
  } finally {
    await BarcodeLookupModel.updateOne(
      { barcode },
      { $set: { leaseUntil: new Date(0) } },
    );
  }
}

export async function lookupBarcode(barcode: string) {
  const existing = pending.get(barcode);
  if (existing) {
    return existing;
  }

  const operation = refresh(barcode);
  pending.set(barcode, operation);

  try {
    return await operation;
  } finally {
    pending.delete(barcode);
  }
}
