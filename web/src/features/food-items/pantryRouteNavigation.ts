import type { FoodItem } from "@sari/contracts";
import type { Location } from "react-router-dom";

export interface PantryRouteNavigationState {
  completedEdit?: FoodItem;
  editOrigin?: "details" | "pantry";
  pantryContextId: string;
  pantryLocation: Location;
  seedItem: FoodItem;
}

interface PantryContextActions {
  onItemsChanged: () => void;
  restoreItemFocus: (itemId: string) => void;
}

const activePantryContexts = new Map<string, PantryContextActions>();

export function registerPantryContext(
  contextId: string,
  actions: PantryContextActions,
) {
  activePantryContexts.set(contextId, actions);

  return () => {
    activePantryContexts.delete(contextId);
  };
}

export function invalidatePantryContext(contextId: string) {
  activePantryContexts.get(contextId)?.onItemsChanged();
}

export function restorePantryItemFocus(contextId: string, itemId: string) {
  activePantryContexts.get(contextId)?.restoreItemFocus(itemId);
}

export function pantryRouteNavigationState(
  state: unknown,
): PantryRouteNavigationState | null {
  if (!state || typeof state !== "object") {
    return null;
  }

  const candidate = state as {
    completedEdit?: Partial<FoodItem>;
    editOrigin?: unknown;
    pantryContextId?: unknown;
    pantryLocation?: Partial<Location>;
    seedItem?: Partial<FoodItem>;
  };
  if (
    typeof candidate.pantryContextId !== "string" ||
    !activePantryContexts.has(candidate.pantryContextId) ||
    candidate.pantryLocation?.pathname !== "/pantry" ||
    !candidate.seedItem ||
    typeof candidate.seedItem.id !== "string" ||
    (candidate.completedEdit !== undefined &&
      candidate.completedEdit.id !== candidate.seedItem.id) ||
    (candidate.editOrigin !== undefined &&
      candidate.editOrigin !== "details" &&
      candidate.editOrigin !== "pantry")
  ) {
    return null;
  }

  return candidate as PantryRouteNavigationState;
}
