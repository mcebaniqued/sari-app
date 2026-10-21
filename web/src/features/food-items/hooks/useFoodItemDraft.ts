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

  const current = useRef(values);
  const defaults = useRef(values);
  const dirty = useRef(new Set<keyof FoodItemDraft>());
  const automatic = useRef(new Map<keyof FoodItemDraft, string>());

  function update(next: FoodItemDraft) {
    current.current = next;
    setValues(next);
  }

  function edit(field: keyof FoodItemDraft, value: string) {
    dirty.current.add(field);
    update({ ...current.current, [field]: value });
  }

  function applyProduct(product: FoodProduct, overwrite: boolean) {
    const proposals = {
      name: product.name,
      quantity: product.packageQuantity?.toString(),
      unit: product.packageUnit ?? undefined,
    };
    const next = { ...current.current };
    let conflict = false;

    for (const field of ["name", "quantity", "unit"] as const) {
      const value = proposals[field];
      if (!value) {
        continue;
      }
      const amountEdited =
        (field === "quantity" || field === "unit") &&
        (dirty.current.has("quantity") || dirty.current.has("unit"));
      if (
        overwrite ||
        (!amountEdited &&
          (!next[field].trim() || (!item && !dirty.current.has(field))))
      ) {
        next[field] = value;
        automatic.current.set(field, value);
      } else if (next[field] !== value) {
        conflict = true;
      }
    }

    update(next);

    return conflict;
  }

  function resetSuggestions(keepValues: boolean) {
    const next = { ...current.current };

    for (const [field, value] of automatic.current) {
      if (keepValues) {
        dirty.current.add(field);
      } else if (
        !dirty.current.has(field) &&
        next[field] === value &&
        !(
          (field === "quantity" || field === "unit") &&
          (dirty.current.has("quantity") || dirty.current.has("unit"))
        )
      ) {
        next[field] = defaults.current[field];
      }
    }

    automatic.current.clear();
    update(next);
  }

  return { values, edit, applyProduct, resetSuggestions };
}
