import {
  type ApiErrorResponse,
  createFoodItemSchema,
  foodItemIdSchema,
  foodItemQuerySchema,
  foodItemSchema,
  updateFoodItemSchema,
} from "@sari/contracts";
import { type Response, Router } from "express";

import { connectDatabase } from "../db.js";
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
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
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
  const document = await FoodItemModel.create(result.data);
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
  const { filter, sort } = foodMongoQuery(result.data);
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
  const document = await FoodItemModel.findById(req.params.id);
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
  const document = await FoodItemModel.findByIdAndUpdate(
    req.params.id,
    { $set: result.data },
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
  const document = await FoodItemModel.findByIdAndDelete(req.params.id);
  if (!document) {
    itemNotFound(res);
    return;
  }
  res.status(204).end();
});
