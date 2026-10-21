import type { FoodItem, FoodProduct } from "@sari/contracts";
import { useRef, useState } from "react";

export interface FoodItemDraft {
  name: string;
  quantity: string;
  unit: string;
  expiresOn: string;
}

/** Draft values outlive individual entry views; provider suggestions never overwrite edits. */
export function useFoodItemDraft(item: FoodItem | null) {
  const [values, setValues] = useState<FoodItemDraft>(() => ({
    name: item?.name ?? "",
    quantity: String(item?.quantity ?? 1),
    unit: item?.unit ?? "item",
    expiresOn: item?.expiresOn ?? "",
  }));

  // Refs keep asynchronous suggestions aligned with edits made before React rerenders.
  const currentValues = useRef(values);
  const initialValues = useRef(values);
  const editedFields = useRef(new Set<keyof FoodItemDraft>());
  const suggestedValues = useRef(new Map<keyof FoodItemDraft, string>());

  function update(next: FoodItemDraft) {
    currentValues.current = next;
    setValues(next);
  }

  function edit(field: keyof FoodItemDraft, value: string) {
    editedFields.current.add(field);
    update({ ...currentValues.current, [field]: value });
  }

  /** Editing either half protects the entire amount from partial provider replacement. */
  function hasEditedAmount(field: keyof FoodItemDraft) {
    return (
      (field === "quantity" || field === "unit") &&
      (editedFields.current.has("quantity") || editedFields.current.has("unit"))
    );
  }

  function applyProduct(product: FoodProduct, overwrite: boolean) {
    const proposals = {
      name: product.name,
      quantity: product.packageQuantity?.toString(),
      unit: product.packageUnit ?? undefined,
    };
    const next = { ...currentValues.current };
    let conflict = false;

    for (const field of ["name", "quantity", "unit"] as const) {
      const value = proposals[field];
      if (!value) {
        continue;
      }
      const amountEdited = hasEditedAmount(field);
      if (
        overwrite ||
        (!amountEdited &&
          (!next[field].trim() || (!item && !editedFields.current.has(field))))
      ) {
        next[field] = value;
        suggestedValues.current.set(field, value);
      } else if (next[field] !== value) {
        conflict = true;
      }
    }

    update(next);

    return conflict;
  }

  /** Remove only unchanged suggestions; unlinking can promote them to private user values. */
  function resetSuggestions(keepValues: boolean) {
    const next = { ...currentValues.current };

    for (const [field, value] of suggestedValues.current) {
      if (keepValues) {
        editedFields.current.add(field);
      } else if (
        !editedFields.current.has(field) &&
        next[field] === value &&
        !hasEditedAmount(field)
      ) {
        next[field] = initialValues.current[field];
      }
    }

    suggestedValues.current.clear();
    update(next);
  }

  return { values, edit, applyProduct, resetSuggestions };
}
