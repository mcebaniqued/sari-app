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

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
});

export const readyResponseSchema = z.object({
  status: z.literal("ready"),
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
export type ReadyResponse = z.infer<typeof readyResponseSchema>;
export type NotReadyResponse = z.infer<typeof notReadyResponseSchema>;
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
