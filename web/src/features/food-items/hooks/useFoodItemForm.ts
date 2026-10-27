import {
  type CreateFoodItem,
  createFoodItemSchema,
  type FoodItem,
} from "@sari/contracts";
import { type SubmitEvent, useEffect, useRef, useState } from "react";
import { ApiError } from "@/api/apiFetch";
import { useAccessDenied } from "@/hooks/useAccessDenied";
import { FoodItemMutationOutcomeError, getFoodItem } from "../api/foodItemsApi";
import type { FoodItemDraft } from "./useFoodItemDraft";

const validationMessages = new Map([
  ["name", "Enter a food name with 120 characters or fewer."],
  [
    "quantity",
    "Enter a quantity greater than zero and no more than 1,000,000.",
  ],
  ["unit", "Choose a unit."],
  ["expiresOn", "Enter a valid expiration date."],
]);

interface FoodItemFormOptions {
  disabled: boolean;
  item: FoodItem | null;
  onSave: (values: CreateFoodItem) => Promise<void>;
  values: FoodItemDraft;
  linkage?: { productId: string | null; barcode: string | null };
}

export interface FoodItemSaveIssue {
  kind: "conflict" | "unavailable" | "uncertain";
  currentItem?: FoodItem;
  loading?: boolean;
}

export function useFoodItemForm({
  disabled,
  item,
  onSave,
  values,
  linkage,
}: FoodItemFormOptions) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveIssue, setSaveIssue] = useState<FoodItemSaveIssue | null>(null);

  const savingRef = useRef(false);
  const reviewGeneration = useRef(0);
  const handleAccessDenied = useAccessDenied();

  useEffect(
    () => () => {
      ++reviewGeneration.current;
    },
    [],
  );

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current || disabled) {
      return;
    }

    ++reviewGeneration.current;
    const result = createFoodItemSchema.safeParse({
      name: values.name,
      quantity: Number(values.quantity),
      unit: values.unit,
      expiresOn: values.expiresOn || null,
      ...(linkage ?? {}),
    });
    setError("");
    setSaveIssue(null);
    if (!result.success) {
      const field = result.error.issues[0]?.path[0];
      const message =
        typeof field === "string" ? validationMessages.get(field) : undefined;
      setError(message ?? "Check the item details and try again.");

      return;
    }

    savingRef.current = true;
    setSaving(true);

    try {
      await onSave(result.data);
    } catch (error) {
      if (handleAccessDenied(error)) {
        return;
      }

      if (
        error instanceof ApiError &&
        error.code === "FOOD_ITEM_REVISION_CONFLICT"
      ) {
        setSaveIssue({ kind: "conflict" });
      } else if (error instanceof ApiError && error.status === 404) {
        setSaveIssue({ kind: "unavailable" });
      } else if (error instanceof FoodItemMutationOutcomeError) {
        setSaveIssue({
          kind: error.outcome,
          ...(error.currentItem ? { currentItem: error.currentItem } : {}),
        });
      } else {
        setError(
          error instanceof TypeError
            ? "Could not reach your pantry. Check your connection and try again."
            : "Could not save this item. Try again.",
        );
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function reviewLatest() {
    if (!item || !saveIssue || saveIssue.loading) {
      return;
    }

    const reviewingConflict = saveIssue.kind === "conflict";
    const generation = ++reviewGeneration.current;
    setSaveIssue((current) =>
      current ? { ...current, loading: true } : current,
    );

    try {
      const currentItem = await getFoodItem(item.id);
      if (reviewGeneration.current !== generation) {
        return;
      }

      setSaveIssue({
        kind: reviewingConflict ? "conflict" : "uncertain",
        currentItem,
      });
    } catch (error) {
      if (reviewGeneration.current !== generation) {
        return;
      }

      if (handleAccessDenied(error)) {
        return;
      }

      setSaveIssue({
        kind:
          error instanceof ApiError && error.status === 404
            ? "unavailable"
            : "uncertain",
      });
    }
  }

  return {
    saving,
    error,
    saveIssue,
    handleSubmit,
    reviewLatest,
    clearSaveIssue: () => {
      ++reviewGeneration.current;
      setSaveIssue(null);
    },
  };
}
