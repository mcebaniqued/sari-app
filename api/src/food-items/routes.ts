import {
  type ApiErrorResponse,
  createFoodItemSchema,
  foodItemIdSchema,
  foodItemQuerySchema,
  foodItemRevisionContractHeader,
  foodItemRevisionContractVersion,
  foodItemRevisionSchema,
  updateFoodItemSchema,
} from "@sari/contracts";
import { type Request, type Response, Router } from "express";
import { connectDatabase } from "../db.js";
import { FoodItemModel } from "./model.js";
import { foodMongoQuery } from "./query.js";
import {
  createFoodItem,
  foodItemDto,
  foodItemRevision,
  resolveProductLink,
} from "./service.js";

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

foodItemsRouter.param("revision", (_req, res, next, revision: string) => {
  if (!/^\d+$/.test(revision)) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid food item revision.",
      },
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

function revisionConflict(res: Response) {
  res.status(409).json({
    error: {
      code: "FOOD_ITEM_REVISION_CONFLICT",
      message:
        "This pantry item changed since it was loaded. Refresh it before trying again.",
    },
  } satisfies ApiErrorResponse);
}

function revisionRequired(res: Response) {
  res.status(428).json({
    error: {
      code: "FOOD_ITEM_REVISION_REQUIRED",
      message: "A food item revision is required for this change.",
    },
  } satisfies ApiErrorResponse);
}

function revisionFilter(expectedRevision: number) {
  return expectedRevision === 0
    ? { $or: [{ revision: 0 }, { revision: { $exists: false } }] }
    : { revision: expectedRevision };
}

function revisionResponseRequested(req: Request) {
  return (
    req.get(foodItemRevisionContractHeader) === foodItemRevisionContractVersion
  );
}

function responseItem(
  req: Request,
  document: InstanceType<typeof FoodItemModel>,
) {
  const item = foodItemDto(document);
  if (revisionResponseRequested(req)) {
    return item;
  }

  const { revision: _revision, ...legacyItem } = item;

  return legacyItem;
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

  res.vary(foodItemRevisionContractHeader);
  res.status(201).json(responseItem(req, document));
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
  const {
    filter: queryFilter,
    sort,
    expirationFirst,
  } = foodMongoQuery(result.data);
  const filter = { ...queryFilter, userId: res.locals.userId };
  const findPage = (pageFilter: typeof filter, offset: number, size: number) =>
    FoodItemModel.find(pageFilter)
      .collation({ locale: "en", strength: 2 })
      .sort(sort)
      .skip(offset)
      .limit(size)
      .maxTimeMS(5000);

  let documents: Awaited<ReturnType<typeof findPage>>;
  let total: number;
  if (expirationFirst) {
    // MongoDB sorts null before strings in ascending order. Query the two
    // indexed segments separately so undated items remain last on every page.
    const datedFilter = { ...filter, expiresOn: { $type: "string" as const } };
    const undatedFilter = { ...filter, expiresOn: null };
    const [matchingTotal, datedCount] = await Promise.all([
      FoodItemModel.countDocuments(filter).maxTimeMS(5000),
      FoodItemModel.countDocuments(datedFilter).maxTimeMS(5000),
    ]);
    total = matchingTotal;
    const datedLimit = Math.min(limit, Math.max(datedCount - start, 0));
    const undatedLimit = limit - datedLimit;
    const [dated, undated] = await Promise.all([
      datedLimit
        ? findPage(datedFilter, start, datedLimit)
        : Promise.resolve([]),
      undatedLimit
        ? findPage(undatedFilter, Math.max(start - datedCount, 0), undatedLimit)
        : Promise.resolve([]),
    ]);
    documents = [...dated, ...undated];
  } else {
    [documents, total] = await Promise.all([
      findPage(filter, start, limit),
      FoodItemModel.countDocuments(filter).maxTimeMS(5000),
    ]);
  }
  res.vary(foodItemRevisionContractHeader);
  res.json({
    items: documents.map((document) => responseItem(req, document)),
    total,
    start,
    limit,
  });
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

  res.vary(foodItemRevisionContractHeader);
  res.json(responseItem(req, document));
});

foodItemsRouter.patch("/:id", async (req, res) => {
  if (
    !req.body ||
    typeof req.body !== "object" ||
    !("expectedRevision" in req.body)
  ) {
    revisionRequired(res);

    return;
  }

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

  const currentRevision = foodItemRevision(existing);
  if (currentRevision !== result.data.expectedRevision) {
    revisionConflict(res);

    return;
  }

  const link = await resolveProductLink(result.data.changes, existing);
  if (!link) {
    invalidLink(res);

    return;
  }

  const document = await FoodItemModel.findOneAndUpdate(
    {
      _id: req.params.id,
      userId: res.locals.userId,
      ...revisionFilter(result.data.expectedRevision),
    },
    { $set: { ...result.data.changes, ...link }, $inc: { revision: 1 } },
    { returnDocument: "after", runValidators: true },
  );
  if (!document) {
    const stillExists = await FoodItemModel.exists({
      _id: req.params.id,
      userId: res.locals.userId,
    });
    if (stillExists) {
      revisionConflict(res);
    } else {
      itemNotFound(res);
    }

    return;
  }

  res.vary(foodItemRevisionContractHeader);
  res.json(responseItem(req, document));
});

foodItemsRouter.delete("/:id/revisions/:revision", async (req, res) => {
  const revision = foodItemRevisionSchema.safeParse(
    Number(req.params.revision),
  );
  if (!revision.success) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid food item revision.",
      },
    } satisfies ApiErrorResponse);

    return;
  }

  if (!(await databaseAvailable(res))) {
    return;
  }

  const document = await FoodItemModel.findOneAndDelete({
    _id: req.params.id,
    userId: res.locals.userId,
    ...revisionFilter(revision.data),
  });
  if (!document) {
    const stillExists = await FoodItemModel.exists({
      _id: req.params.id,
      userId: res.locals.userId,
    });
    if (stillExists) {
      revisionConflict(res);
    } else {
      itemNotFound(res);
    }

    return;
  }

  res.status(204).end();
});

// Keep old clients from silently issuing unprotected deletes during an
// API-first rollout. The revision-qualified route above is the only write path.
foodItemsRouter.delete("/:id", (_req, res) => {
  revisionRequired(res);
});
