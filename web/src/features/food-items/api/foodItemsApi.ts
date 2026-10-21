import {
  type CreateFoodItem,
  foodItemListSchema,
  type FoodItemQuery,
  foodItemSchema,
  type UpdateFoodItem,
} from "@sari/contracts";

import { ApiError, apiFetch } from "@/api/apiFetch";

export async function listFoodItems(
  query: FoodItemQuery,
  signal?: AbortSignal,
) {
  const parameters = new URLSearchParams({
    start: String(query.start),
    limit: String(query.limit),
    search: query.search,
    sort: JSON.stringify(query.sort),
    filters: JSON.stringify(query.filters),
  });
  const response = await apiFetch<unknown>(
    `/food-items?${parameters.toString()}`,
    signal ? { signal } : {},
  );

  return foodItemListSchema.parse(response);
}

export async function createFoodItem(
  item: CreateFoodItem,
  operationKey?: string,
) {
  const response = await apiFetch<unknown>("/food-items", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(operationKey ? { "Idempotency-Key": operationKey } : {}),
    },
    body: JSON.stringify(item),
  });

  return foodItemSchema.parse(response);
}

export async function updateFoodItem(id: string, item: UpdateFoodItem) {
  const response = await apiFetch<unknown>(`/food-items/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item),
  });

  return foodItemSchema.parse(response);
}

async function deleteFoodItem(id: string) {
  await apiFetch(`/food-items/${id}`, { method: "DELETE" });
}

/** Limit concurrent requests, and retain failed IDs so a retry cannot repeat successes. */
export async function deleteFoodItems(ids: string[]) {
  const deletedIds: string[] = [];
  const failedIds: string[] = [];
  let accessDenied: ApiError | undefined;

  for (let offset = 0; offset < ids.length; offset += 10) {
    const batch = ids.slice(offset, offset + 10);
    const results = await Promise.allSettled(
      batch.map(async (id) => {
        try {
          await deleteFoodItem(id);
        } catch (error) {
          if (!(error instanceof ApiError && error.status === 404)) {
            throw error;
          }
        }
      }),
    );
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        const error: unknown = result.reason;
        if (
          error instanceof ApiError &&
          (error.status === 401 || error.status === 403)
        ) {
          accessDenied = error;
        }
      }
      const id = batch[index];
      if (id) {
        (result.status === "fulfilled" ? deletedIds : failedIds).push(id);
      }
    });
    if (accessDenied) {
      failedIds.push(...ids.slice(offset + batch.length));
      break;
    }
  }

  return { deletedIds, failedIds, accessDenied };
}
