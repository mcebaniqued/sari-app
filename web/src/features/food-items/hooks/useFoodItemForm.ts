import { type CreateFoodItem, createFoodItemSchema } from "@sari/contracts";
import { type SubmitEvent, useRef, useState } from "react";

import { notify } from "@/components/Toast/notifications";
import { useAccessDenied } from "@/hooks/useAccessDenied";
import { getApiErrorMessage } from "@/utils/apiError";

import type { FoodItemDraft } from "./useFoodItemDraft";

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
      setError(result.error.issues[0]?.message ?? "Check your food details.");
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
      const message = getApiErrorMessage(
        error,
        "Could not reach your pantry. Check your connection and try again.",
      );
      notify("error", message, "pantry-save-error");
      setError(message);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return { saving, error, handleSubmit };
}
