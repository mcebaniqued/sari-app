import { createHash } from "node:crypto";
import {
  type CreateFoodItem,
  foodItemSchema,
  type UpdateFoodItem,
} from "@sari/contracts";
import { FoodProductModel } from "../food-products/model.js";
import { isDuplicateKeyError } from "../utils/mongoError.js";
import { FoodItemModel } from "./model.js";

export function foodItemRevision(document: InstanceType<typeof FoodItemModel>) {
  const revision = document.get("revision") as unknown;

  return typeof revision === "number" ? revision : 0;
}

export function foodItemDto(document: InstanceType<typeof FoodItemModel>) {
  return foodItemSchema.parse({
    id: document._id.toHexString(),
    name: document.name,
    quantity: document.quantity,
    unit: document.unit,
    expiresOn: document.expiresOn ?? null,
    productId: document.productId?.toHexString() ?? null,
    barcode: document.barcode,
    // Documents created before revision enforcement are revision zero. Their
    // first guarded update atomically materializes revision one.
    revision: foodItemRevision(document),
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  });
}

/** Omitted link fields preserve existing values; null explicitly removes a link. */
export async function resolveProductLink(
  values: CreateFoodItem | UpdateFoodItem["changes"],
  existing?: InstanceType<typeof FoodItemModel>,
) {
  if (values.productId === undefined && values.barcode === undefined) {
    return {};
  }

  const productId =
    values.productId === undefined
      ? existing?.productId?.toHexString()
      : values.productId;
  const barcode =
    values.barcode === undefined ? existing?.barcode : values.barcode;
  if (!productId) {
    return { productId: null, barcode: barcode ?? null };
  }

  const product = await FoodProductModel.findById(productId);
  if (!product || (barcode && barcode !== product.barcode)) {
    return null;
  }

  return { productId: product._id, barcode: product.barcode };
}

/**
 * Reuse an owner's operation key only for the same validated payload. A competing
 * insert can win the unique-index race; read its result rather than insert again.
 * Returns null for a reused key with different values. Unkeyed creates stay distinct.
 */
export async function createFoodItem(
  values: CreateFoodItem,
  link: NonNullable<Awaited<ReturnType<typeof resolveProductLink>>>,
  userId: string,
  key: string | undefined,
) {
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(values))
    .digest("hex");
  const input = {
    name: values.name,
    quantity: values.quantity,
    unit: values.unit,
    expiresOn: values.expiresOn,
    productId: link.productId ?? null,
    barcode: link.barcode ?? null,
    userId,
    ...(key ? { creationKey: key, creationFingerprint: fingerprint } : {}),
  };
  let document: InstanceType<typeof FoodItemModel>;

  try {
    document = key
      ? await FoodItemModel.findOneAndUpdate(
          { userId, creationKey: key },
          {
            $setOnInsert: {
              ...input,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
          {
            upsert: true,
            returnDocument: "after",
            runValidators: true,
            timestamps: false,
          },
        ).select("+creationFingerprint")
      : await FoodItemModel.create(input);
  } catch (error) {
    if (!key || !isDuplicateKeyError(error)) {
      throw error;
    }

    document = await FoodItemModel.findOne({
      userId,
      creationKey: key,
    })
      .select("+creationFingerprint")
      .orFail();
  }

  return key && document.creationFingerprint !== fingerprint ? null : document;
}
