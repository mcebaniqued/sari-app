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
  onSave: (
    values: CreateFoodItem,
    expectedRevision: number | null,
  ) => Promise<void>;
  values: FoodItemDraft;
  linkage?: { productId: string | null; barcode: string | null };
}

export interface FoodItemSaveIssue {
  kind: "conflict" | "unavailable" | "uncertain";
  phase: "notice" | "review";
  currentItem?: FoodItem;
  loading?: boolean;
  readError?: boolean;
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

  async function submit(expectedRevision: number | null, keepReview = false) {
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
    if (!result.success) {
      setSaveIssue(null);
      const field = result.error.issues[0]?.path[0];
      const message =
        typeof field === "string" ? validationMessages.get(field) : undefined;
      setError(message ?? "Check the item details and try again.");

      return;
    }

    if (!keepReview) {
      setSaveIssue(null);
    }

    savingRef.current = true;
    setSaving(true);

    try {
      await onSave(result.data, expectedRevision);
    } catch (error) {
      if (handleAccessDenied(error)) {
        return;
      }

      if (
        error instanceof ApiError &&
        error.code === "FOOD_ITEM_REVISION_CONFLICT"
      ) {
        setSaveIssue({ kind: "conflict", phase: "notice" });
      } else if (error instanceof ApiError && error.status === 404) {
        setSaveIssue({ kind: "unavailable", phase: "notice" });
      } else if (error instanceof FoodItemMutationOutcomeError) {
        setSaveIssue({
          kind: error.outcome,
          phase: "notice",
          ...(error.currentItem ? { currentItem: error.currentItem } : {}),
        });
      } else {
        setSaveIssue(null);
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

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveIssue) {
      return;
    }

    await submit(item?.revision ?? null);
  }

  async function overwriteReviewed() {
    if (
      saveIssue?.phase !== "review" ||
      !saveIssue.currentItem ||
      saveIssue.kind === "unavailable"
    ) {
      return;
    }

    await submit(saveIssue.currentItem.revision, true);
  }

  async function reviewLatest() {
    if (!item || !saveIssue || saveIssue.loading) {
      return;
    }

    const reviewingKind = saveIssue.kind;
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
        kind: reviewingKind,
        phase: "review",
        currentItem,
      });
    } catch (error) {
      if (reviewGeneration.current !== generation) {
        return;
      }

      if (handleAccessDenied(error)) {
        return;
      }

      if (error instanceof ApiError && error.status === 404) {
        setSaveIssue({ kind: "unavailable", phase: "notice" });
      } else {
        setSaveIssue({
          kind: reviewingKind,
          phase: "notice",
          readError: true,
        });
      }
    }
  }

  return {
    saving,
    error,
    saveIssue,
    handleSubmit,
    overwriteReviewed,
    reviewLatest,
    backToNotice: () => {
      ++reviewGeneration.current;
      setSaveIssue((current) =>
        current ? { kind: current.kind, phase: "notice" } : current,
      );
    },
    clearSaveIssue: () => {
      ++reviewGeneration.current;
      setSaveIssue(null);
    },
  };
}
