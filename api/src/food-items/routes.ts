import {
  type ApiErrorResponse,
  createFoodItemSchema,
  foodItemIdSchema,
  foodItemQuerySchema,
  updateFoodItemSchema,
} from "@sari/contracts";
import { type Response, Router } from "express";
import { connectDatabase } from "../db.js";
import { FoodItemModel } from "./model.js";
import { foodMongoQuery } from "./query.js";
import { createFoodItem, foodItemDto, resolveProductLink } from "./service.js";

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

  const link = await resolveProductLink(result.data);
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

  const document = await createFoodItem(
    result.data,
    link,
    res.locals.userId,
    key,
  );

  if (!document) {
    res.status(409).json({
      error: {
        code: "SAVE_CONFLICT",
        message:
          "This save identifier was already used for different item details. Reopen Add item to make a new entry.",
      },
    });

    return;
  }

  res.status(201).json(foodItemDto(document));
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
  res.json({ items: documents.map(foodItemDto), total, start, limit });
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

  res.json(foodItemDto(document));
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

  const link = await resolveProductLink(result.data, existing);
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

  res.json(foodItemDto(document));
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
