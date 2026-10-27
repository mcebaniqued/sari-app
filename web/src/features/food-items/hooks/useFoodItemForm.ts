import { type CreateFoodItem, createFoodItemSchema } from "@sari/contracts";
import { type SubmitEvent, useRef, useState } from "react";
import { ApiError } from "@/api/apiFetch";
import { useAccessDenied } from "@/hooks/useAccessDenied";
import { FoodItemMutationOutcomeError } from "../api/foodItemsApi";
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
  onSave: (values: CreateFoodItem) => Promise<void>;
  values: FoodItemDraft;
  linkage?: { productId: string | null; barcode: string | null };
}

export function useFoodItemForm({
  disabled,
  onSave,
  values,
  linkage,
}: FoodItemFormOptions) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const savingRef = useRef(false);
  const handleAccessDenied = useAccessDenied();

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current || disabled) {
      return;
    }

    const result = createFoodItemSchema.safeParse({
      name: values.name,
      quantity: Number(values.quantity),
      unit: values.unit,
      expiresOn: values.expiresOn || null,
      ...(linkage ?? {}),
    });
    setError("");
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

      const message =
        error instanceof ApiError &&
        error.code === "FOOD_ITEM_REVISION_CONFLICT"
          ? "This item changed since you opened it. Your edits are still here; refresh the pantry before trying again."
          : error instanceof FoodItemMutationOutcomeError
            ? error.message
            : error instanceof TypeError
              ? "Could not reach your pantry. Check your connection and try again."
              : "Could not save this item. Try again.";
      setError(message);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return { saving, error, handleSubmit };
}
