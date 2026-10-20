import { createHash } from "node:crypto";

import {
  type ApiErrorResponse,
  type CreateFoodItem,
  createFoodItemSchema,
  foodItemIdSchema,
  foodItemQuerySchema,
  foodItemSchema,
  type UpdateFoodItem,
  updateFoodItemSchema,
} from "@sari/contracts";
import { type Response, Router } from "express";

import { connectDatabase } from "../db.js";
import { FoodProductModel } from "../food-products/model.js";
import { FoodItemModel } from "./model.js";
import { foodMongoQuery } from "./query.js";

export const foodItemsRouter = Router();

foodItemsRouter.param("id", (_req, res, next, id: string) => {
  if (!foodItemIdSchema.safeParse(id).success) {
    res.status(400).json({
      error: { code: "INVALID_ID", message: "Invalid food item ID." },
    } satisfies ApiErrorResponse);
    return;
  }
  next();
});

function itemNotFound(res: Response) {
  res.status(404).json({
    error: { code: "FOOD_ITEM_NOT_FOUND", message: "Food item not found." },
  } satisfies ApiErrorResponse);
}

async function databaseAvailable(res: Response): Promise<boolean> {
  try {
    await connectDatabase();
    return true;
  } catch {
    res.status(503).json({
      error: {
        code: "DATABASE_UNAVAILABLE",
        message: "Cannot reach your pantry. Please try again shortly.",
      },
    } satisfies ApiErrorResponse);
    return false;
  }
}

function toDto(document: InstanceType<typeof FoodItemModel>) {
  return foodItemSchema.parse({
    id: document._id.toHexString(),
    name: document.name,
    quantity: document.quantity,
    unit: document.unit,
    expiresOn: document.expiresOn,
    productId: document.productId?.toHexString() ?? null,
    barcode: document.barcode,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  });
}

async function resolveLink(
  values: CreateFoodItem | UpdateFoodItem,
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

function invalidLink(res: Response) {
  res.status(400).json({
    error: {
      code: "INVALID_PRODUCT_LINK",
      message:
        "The product and barcode do not match. Remove the product link or look up the barcode again.",
    },
  });
}

foodItemsRouter.post("/", async (req, res) => {
  const result = createFoodItemSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: result.error.issues[0]?.message ?? "Invalid food item.",
      },
    } satisfies ApiErrorResponse);
    return;
  }

  if (!(await databaseAvailable(res))) {
    return;
  }
  const link = await resolveLink(result.data);
  if (!link) {
    invalidLink(res);
    return;
  }
  const key = req.get("Idempotency-Key");
  if (key && !/^[a-zA-Z0-9-]{16,80}$/.test(key)) {
    res.status(400).json({
      error: {
        code: "INVALID_REQUEST_KEY",
        message: "Invalid save request identifier.",
      },
    });
    return;
  }
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(result.data))
    .digest("hex");
  const input = {
    name: result.data.name,
    quantity: result.data.quantity,
    unit: result.data.unit,
    expiresOn: result.data.expiresOn,
    productId: link.productId ?? null,
    barcode: link.barcode ?? null,
    userId: res.locals.userId,
    ...(key ? { creationKey: key, creationFingerprint: fingerprint } : {}),
  };
  let document: InstanceType<typeof FoodItemModel>;
  try {
    document = key
      ? await FoodItemModel.findOneAndUpdate(
          { userId: res.locals.userId, creationKey: key },
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
    if (
      !key ||
      typeof error !== "object" ||
      error === null ||
      !("code" in error) ||
      error.code !== 11000
    ) {
      throw error;
    }
    document = await FoodItemModel.findOne({
      userId: res.locals.userId,
      creationKey: key,
    })
      .select("+creationFingerprint")
      .orFail();
  }
  if (key && document.creationFingerprint !== fingerprint) {
    res.status(409).json({
      error: {
        code: "SAVE_CONFLICT",
        message:
          "This save identifier was already used for different item details. Reopen Add item to make a new entry.",
      },
    });
    return;
  }
  res.status(201).json(toDto(document));
});

foodItemsRouter.get("/", async (req, res) => {
  const result = foodItemQuerySchema.safeParse(req.query);
  if (!result.success) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid pagination, search, sort, or filter parameters.",
      },
    } satisfies ApiErrorResponse);
    return;
  }
  if (!(await databaseAvailable(res))) {
    return;
  }
  const { start, limit } = result.data;
  const { filter: queryFilter, sort } = foodMongoQuery(result.data);
  const filter = { ...queryFilter, userId: res.locals.userId };
  const [documents, total] = await Promise.all([
    FoodItemModel.find(filter)
      .collation({ locale: "en", strength: 2 })
      .sort(sort)
      .skip(start)
      .limit(limit)
      .maxTimeMS(5000),
    FoodItemModel.countDocuments(filter).maxTimeMS(5000),
  ]);
  res.json({ items: documents.map(toDto), total, start, limit });
});

foodItemsRouter.get("/:id", async (req, res) => {
  if (!(await databaseAvailable(res))) {
    return;
  }
  const document = await FoodItemModel.findOne({
    _id: req.params.id,
    userId: res.locals.userId,
  });
  if (!document) {
    itemNotFound(res);
    return;
  }
  res.json(toDto(document));
});

foodItemsRouter.patch("/:id", async (req, res) => {
  const result = updateFoodItemSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: result.error.issues[0]?.message ?? "Invalid food item.",
      },
    } satisfies ApiErrorResponse);
    return;
  }
  if (!(await databaseAvailable(res))) {
    return;
  }
  const existing = await FoodItemModel.findOne({
    _id: req.params.id,
    userId: res.locals.userId,
  });
  if (!existing) {
    itemNotFound(res);
    return;
  }
  const link = await resolveLink(result.data, existing);
  if (!link) {
    invalidLink(res);
    return;
  }
  const document = await FoodItemModel.findOneAndUpdate(
    { _id: req.params.id, userId: res.locals.userId },
    { $set: { ...result.data, ...link } },
    { returnDocument: "after", runValidators: true },
  );
  if (!document) {
    itemNotFound(res);
    return;
  }
  res.json(toDto(document));
});

foodItemsRouter.delete("/:id", async (req, res) => {
  if (!(await databaseAvailable(res))) {
    return;
  }
  const document = await FoodItemModel.findOneAndDelete({
    _id: req.params.id,
    userId: res.locals.userId,
  });
  if (!document) {
    itemNotFound(res);
    return;
  }
  res.status(204).end();
});
