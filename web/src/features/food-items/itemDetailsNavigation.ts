import type { FoodItem } from "@sari/contracts";
import type { Location } from "react-router-dom";

export interface ItemDetailsNavigationState {
  pantryContextId: string;
  pantryLocation: Location;
  seedItem: FoodItem;
}

const activePantryContexts = new Set<string>();

export function registerPantryContext(contextId: string) {
  activePantryContexts.add(contextId);

  return () => {
    activePantryContexts.delete(contextId);
  };
}

export function itemDetailsNavigationState(
  state: unknown,
): ItemDetailsNavigationState | null {
  if (!state || typeof state !== "object") {
    return null;
  }

  const candidate = state as Partial<ItemDetailsNavigationState>;
  if (
    typeof candidate.pantryContextId !== "string" ||
    !activePantryContexts.has(candidate.pantryContextId) ||
    candidate.pantryLocation?.pathname !== "/pantry" ||
    !candidate.seedItem ||
    typeof candidate.seedItem.id !== "string"
  ) {
    return null;
  }

  return candidate as ItemDetailsNavigationState;
}
