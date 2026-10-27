import {
  type CreateFoodItem,
  type FoodItem,
  foodItemListSchema,
  type FoodItemQuery,
  foodItemRevisionContractHeader,
  foodItemRevisionContractVersion,
  foodItemSchema,
  type UpdateFoodItem,
} from "@sari/contracts";
import { ApiError, apiFetch, ApiResponseParseError } from "@/api/apiFetch";

const revisionHeaders = {
  [foodItemRevisionContractHeader]: foodItemRevisionContractVersion,
};
const ambiguousStatuses = new Set([408, 429, 500, 502, 503, 504]);

class FoodItemMutationResponseError extends Error {
  constructor() {
    super("The successful food item response did not match its contract.");
    this.name = "FoodItemMutationResponseError";
  }
}

export class FoodItemMutationOutcomeError extends Error {
  constructor(
    public readonly outcome: "unavailable" | "uncertain",
    public readonly currentItem?: FoodItem,
  ) {
    super(
      outcome === "unavailable"
        ? "The pantry item is no longer available."
        : "The save outcome could not be confirmed. Refresh your pantry before trying again.",
    );
    this.name = "FoodItemMutationOutcomeError";
  }
}

function isAmbiguousMutationError(error: unknown) {
  return (
    error instanceof TypeError ||
    error instanceof ApiResponseParseError ||
    error instanceof FoodItemMutationResponseError ||
    (error instanceof ApiError && ambiguousStatuses.has(error.status))
  );
}

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
    { headers: revisionHeaders, ...(signal ? { signal } : {}) },
  );

  return foodItemListSchema.parse(response);
}

async function getFoodItem(id: string) {
  const response = await apiFetch<unknown>(`/food-items/${id}`, {
    headers: revisionHeaders,
  });

  return foodItemSchema.parse(response);
}

async function verifyAmbiguousMutation(id: string): Promise<never> {
  try {
    const currentItem = await getFoodItem(id);

    // Matching values cannot prove whether the attempted request succeeded,
    // so report uncertainty even when the current record looks familiar.
    throw new FoodItemMutationOutcomeError("uncertain", currentItem);
  } catch (error) {
    if (error instanceof FoodItemMutationOutcomeError) {
      throw error;
    }
    if (error instanceof ApiError && error.status === 404) {
      throw new FoodItemMutationOutcomeError("unavailable");
    }

    throw new FoodItemMutationOutcomeError("uncertain");
  }
}

export async function createFoodItem(
  item: CreateFoodItem,
  operationKey?: string,
) {
  const response = await apiFetch<unknown>("/food-items", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...revisionHeaders,
      ...(operationKey ? { "Idempotency-Key": operationKey } : {}),
    },
    body: JSON.stringify(item),
  });

  return foodItemSchema.parse(response);
}

export async function updateFoodItem(id: string, update: UpdateFoodItem) {
  try {
    const response = await apiFetch<unknown>(`/food-items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...revisionHeaders },
      body: JSON.stringify(update),
      retry: false,
    });
    const result = foodItemSchema.safeParse(response);
    if (!result.success) {
      throw new FoodItemMutationResponseError();
    }

    return result.data;
  } catch (error) {
    if (!isAmbiguousMutationError(error)) {
      throw error;
    }

    return await verifyAmbiguousMutation(id);
  }
}

async function deleteFoodItem(item: FoodItem) {
  try {
    await apiFetch(`/food-items/${item.id}/revisions/${item.revision}`, {
      method: "DELETE",
      headers: revisionHeaders,
      retry: false,
    });
  } catch (error) {
    if (!isAmbiguousMutationError(error)) {
      throw error;
    }

    await verifyAmbiguousMutation(item.id);
  }
}

/** Limit concurrent requests, and retain failed IDs so a retry cannot repeat successes. */
export async function deleteFoodItems(items: FoodItem[]) {
  const deletedIds: string[] = [];
  const unavailableIds: string[] = [];
  const conflictedIds: string[] = [];
  const uncertainIds: string[] = [];
  const failedIds: string[] = [];
  let accessDenied: ApiError | undefined;

  for (let offset = 0; offset < items.length; offset += 10) {
    const batch = items.slice(offset, offset + 10);
    const results = await Promise.allSettled(
      batch.map(async (item) => {
        try {
          await deleteFoodItem(item);
        } catch (error) {
          if (error instanceof ApiError && error.status === 404) {
            throw new FoodItemMutationOutcomeError("unavailable");
          }

          throw error;
        }
      }),
    );
    results.forEach((result, index) => {
      const item = batch[index];
      if (!item) {
        return;
      }
      if (result.status === "fulfilled") {
        deletedIds.push(item.id);

        return;
      }

      const error: unknown = result.reason;
      if (error instanceof FoodItemMutationOutcomeError) {
        (error.outcome === "unavailable" ? unavailableIds : uncertainIds).push(
          item.id,
        );
      } else if (
        error instanceof ApiError &&
        error.code === "FOOD_ITEM_REVISION_CONFLICT"
      ) {
        conflictedIds.push(item.id);
      } else {
        failedIds.push(item.id);
      }
      if (
        error instanceof ApiError &&
        (error.status === 401 || error.status === 403)
      ) {
        accessDenied = error;
      }
    });
    if (accessDenied) {
      failedIds.push(
        ...items.slice(offset + batch.length).map((item) => item.id),
      );
      break;
    }
  }

  return {
    deletedIds,
    unavailableIds,
    conflictedIds,
    uncertainIds,
    failedIds,
    accessDenied,
  };
}
