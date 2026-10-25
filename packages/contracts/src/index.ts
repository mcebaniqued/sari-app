import { z } from "zod";

export {
  authSessionSchema,
  type AuthUser,
  authUserSchema,
  type LoginInput,
  loginSchema,
  type RegisterInput,
  registerSchema,
} from "./auth.js";
export {
  type CameraDiagnosticBatch,
  cameraDiagnosticBatchSchema,
  type CameraDiagnosticCapabilities,
  type CameraDiagnosticEvent,
  type CameraDiagnosticSettings,
} from "./camera-diagnostics.js";
export { type FoodItemQuery, foodItemQuerySchema } from "./food-item-query.js";
export {
  type CreateFoodItem,
  createFoodItemSchema,
  type FoodItem,
  foodItemIdSchema,
  foodItemListSchema,
  foodItemSchema,
  foodUnitSchema,
  type UpdateFoodItem,
  updateFoodItemSchema,
} from "./food-items.js";
export {
  type BarcodeLookup,
  barcodeLookupSchema,
  barcodeSchema,
  type FoodProduct,
  foodProductSchema,
  normalizeBarcode,
} from "./food-products.js";

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
});

export const notReadyResponseSchema = z.object({
  status: z.literal("not_ready"),
});

export const apiErrorResponseSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
  }),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
export interface ReadyResponse {
  status: "ready";
}

export type NotReadyResponse = z.infer<typeof notReadyResponseSchema>;
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
