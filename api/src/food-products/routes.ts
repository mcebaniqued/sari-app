import { barcodeSchema, foodItemIdSchema } from "@sari/contracts";
import { Router } from "express";

import { connectDatabase } from "../db.js";
import { FoodProductModel } from "./model.js";
import { lookupBarcode, productDto } from "./service.js";
import { LookupError } from "./usda.js";

export const foodProductsRouter = Router();

foodProductsRouter.get("/barcode/:barcode", async (req, res) => {
  const parsed = barcodeSchema.safeParse(req.params.barcode);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: "INVALID_BARCODE",
        message: parsed.error.issues[0]?.message ?? "Invalid barcode.",
      },
    });
    return;
  }
  try {
    await connectDatabase();
    res.json(await lookupBarcode(parsed.data));
  } catch (error) {
    const failure =
      error instanceof LookupError
        ? error
        : new LookupError(
            "LOOKUP_UNAVAILABLE",
            "Product lookup is unavailable. Continue manually or try again.",
          );
    res
      .status(failure.status)
      .json({ error: { code: failure.code, message: failure.message } });
  }
});

foodProductsRouter.get("/:id", async (req, res) => {
  if (!foodItemIdSchema.safeParse(req.params.id).success) {
    res
      .status(400)
      .json({ error: { code: "INVALID_ID", message: "Invalid product ID." } });
    return;
  }
  await connectDatabase();
  const product = await FoodProductModel.findById(req.params.id);
  if (!product) {
    res.status(404).json({
      error: {
        code: "PRODUCT_NOT_FOUND",
        message: "Linked product is unavailable. You can remove its link.",
      },
    });
    return;
  }
  res.json(productDto(product));
});
