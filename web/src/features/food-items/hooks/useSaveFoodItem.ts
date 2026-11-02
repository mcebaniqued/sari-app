import type { CreateFoodItem, FoodItem } from "@sari/contracts";
import { useCallback, useRef, useState } from "react";
import { notify } from "@/components/Toast/notifications";
import { createFoodItem, updateFoodItem } from "../api/foodItemsApi";

export function useSaveFoodItem(onChanged?: (item: FoodItem) => void) {
  const [busy, setBusy] = useState(false);
  const mutationRef = useRef(false);
  const createOperation = useRef<{ body: string; key: string } | null>(null);

  const resetCreateOperation = useCallback(() => {
    createOperation.current = null;
  }, []);

  function creationKeyFor(values: CreateFoodItem) {
    const body = JSON.stringify(values);
    if (createOperation.current?.body !== body) {
      createOperation.current = { body, key: crypto.randomUUID() };
    }

    return createOperation.current.key;
  }

  const saveItem = useCallback(
    async (
      item: FoodItem | null,
      values: CreateFoodItem,
      expectedRevision: number | null,
    ) => {
      if (mutationRef.current) {
        throw new Error("Another change is in progress.");
      }
      if (item && expectedRevision === null) {
        throw new Error("An edited item requires an expected revision.");
      }

      mutationRef.current = true;
      setBusy(true);

      try {
        let saved: FoodItem;
        if (item) {
          if (expectedRevision === null) {
            throw new Error("An edited item requires an expected revision.");
          }
          saved = await updateFoodItem(item.id, {
            expectedRevision,
            changes: values,
          });
        } else {
          saved = await createFoodItem(values, creationKeyFor(values));
        }

        onChanged?.(saved);
        notify(
          "success",
          `${saved.name} ${item ? "updated" : "added to your pantry"}.`,
        );

        return saved;
      } finally {
        mutationRef.current = false;
        setBusy(false);
      }
    },
    [onChanged],
  );

  return { busy, resetCreateOperation, saveItem };
}
