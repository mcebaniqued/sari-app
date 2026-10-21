import { type BarcodeLookup, foodProductSchema } from "@sari/contracts";
import { isDuplicateKeyError } from "../utils/mongoError.js";
import { BarcodeLookupModel, FoodProductModel } from "./model.js";
import { parsePackageSize } from "./packageSize.js";
import { fetchUsdaProduct } from "./provider.js";
import { LookupError } from "./usda.js";

const DAY_MS = 86_400_000;
const MATCH_TTL_MS = 30 * DAY_MS;
const MISS_TTL_MS = DAY_MS;
const FAILURE_COOLDOWN_MS = 60_000;
const LOOKUP_LEASE_MS = 20_000;
const pending = new Map<string, Promise<BarcodeLookup>>();

export function productDto(product: InstanceType<typeof FoodProductModel>) {
  // Derive missing suggestions from saved labels without refreshing USDA or source dates.
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

/** Competing initial upserts may race on the unique canonical barcode. */
async function ensureLookupRecord(barcode: string) {
  try {
    await BarcodeLookupModel.updateOne(
      { barcode },
      { $setOnInsert: { barcode } },
      { upsert: true },
    );
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }
  }
}

/** A cached miss expires separately from a transient provider-failure cooldown. */
function readCachedLookup(
  cached: InstanceType<typeof BarcodeLookupModel> | null,
  product: InstanceType<typeof FoodProductModel> | null,
  now: Date,
): BarcodeLookup | undefined {
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
}

/** Refresh only after cache expiry; a database lease coordinates API instances. */
async function refresh(barcode: string): Promise<BarcodeLookup> {
  const now = new Date();

  await ensureLookupRecord(barcode);

  const cached = await BarcodeLookupModel.findOne({ barcode });
  const product = cached?.productId
    ? await FoodProductModel.findById(cached.productId)
    : null;
  const available = readCachedLookup(cached, product, now);
  if (available) {
    return available;
  }

  const lease = await BarcodeLookupModel.findOneAndUpdate(
    { barcode, leaseUntil: { $lte: now } },
    { $set: { leaseUntil: new Date(now.getTime() + LOOKUP_LEASE_MS) } },
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
    const { mapped, raw } = await fetchUsdaProduct(barcode, now);

    const updated = await FoodProductModel.findOneAndUpdate(
      { provider: "usda", externalId: mapped.externalId },
      { $set: { ...mapped, checkedAt: now, providerRaw: raw } },
      { upsert: true, returnDocument: "after", runValidators: true },
    );
    await BarcodeLookupModel.updateOne(
      { barcode },
      {
        $set: {
          productId: updated._id,
          checkedAt: now,
          refreshAfter: new Date(now.getTime() + MATCH_TTL_MS),
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
            refreshAfter: new Date(now.getTime() + MISS_TTL_MS),
          },
        },
      );
      throw error;
    }

    await BarcodeLookupModel.updateOne(
      { barcode },
      { $set: { retryAfter: new Date(now.getTime() + FAILURE_COOLDOWN_MS) } },
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

/** Coalesce callers within this process; the database lease covers other processes. */
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
