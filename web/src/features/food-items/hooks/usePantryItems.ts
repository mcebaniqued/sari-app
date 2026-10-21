import type { CreateFoodItem, FoodItem } from "@sari/contracts";
import { useCallback, useRef, useState } from "react";
import { notify } from "@/components/Toast/notifications";
import { useAccessDenied } from "@/hooks/useAccessDenied";
import {
  createFoodItem,
  deleteFoodItems,
  updateFoodItem,
} from "../api/foodItemsApi";
import type { FoodItemEditorState } from "../types/foodItems";

/** Coordinate mutations; retain a creation key only while retrying the same draft. */
export function usePantryItems() {
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState<FoodItemEditorState | null>(null);
  const [deleteTargets, setDeleteTargets] = useState<FoodItem[] | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [busy, setBusy] = useState(false);

  const mutationRef = useRef(false);
  const createOperation = useRef<{ body: string; key: string } | null>(null);
  const handleAccessDenied = useAccessDenied();

  const startEdit = useCallback((item: FoodItem) => {
    setEditor({ item });
  }, []);

  const startDelete = useCallback((targets: FoodItem[]) => {
    setDeleteError("");
    setDeleteTargets([...targets]);
  }, []);

  function creationKeyFor(values: CreateFoodItem) {
    const body = JSON.stringify(values);
    if (createOperation.current?.body !== body) {
      createOperation.current = { body, key: crypto.randomUUID() };
    }

    return createOperation.current.key;
  }

  async function handleSave(values: CreateFoodItem) {
    if (mutationRef.current) {
      throw new Error("Another change is in progress.");
    }

    mutationRef.current = true;
    setBusy(true);
    const original = editor?.item;

    try {
      const saved = original
        ? await updateFoodItem(original.id, values)
        : await createFoodItem(values, creationKeyFor(values));

      setRevision((value) => value + 1);
      notify(
        "success",
        `${saved.name} ${original ? "updated" : "added to your pantry"}.`,
      );
      setEditor(null);
    } finally {
      mutationRef.current = false;
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (mutationRef.current || !deleteTargets?.length) {
      return;
    }

    mutationRef.current = true;
    setBusy(true);
    setDeleteError("");

    try {
      const { deletedIds, failedIds, accessDenied } = await deleteFoodItems(
        deleteTargets.map((item) => item.id),
      );
      if (deletedIds.length) {
        setRevision((value) => value + 1);
        notify(
          "success",
          deleteTargets.length === 1
            ? `${deleteTargets[0]?.name ?? "Item"} deleted from your pantry.`
            : `${deletedIds.length} items deleted from your pantry.`,
        );
      }
      if (handleAccessDenied(accessDenied)) {
        return;
      }

      if (failedIds.length) {
        const failed = new Set(failedIds);
        const failureSummary = `${failedIds.length} ${failedIds.length === 1 ? "item could" : "items could"} not be deleted.`;

        setDeleteTargets(deleteTargets.filter((item) => failed.has(item.id)));
        notify(
          "error",
          `${failureSummary} Please try again.`,
          "pantry-delete-error",
        );
        setDeleteError(
          `${failureSummary} Check your connection and try again. Successfully deleted items will not be retried.`,
        );
      } else {
        setDeleteTargets(null);
      }
    } finally {
      mutationRef.current = false;
      setBusy(false);
    }
  }

  const startAdd = useCallback(() => {
    createOperation.current = null;
    setEditor({ item: null });
  }, []);

  const closeEditor = useCallback(() => {
    setEditor(null);
  }, []);

  const closeDelete = useCallback(() => {
    setDeleteTargets(null);
  }, []);

  return {
    revision,
    editor,
    deleteTargets,
    deleteError,
    busy,
    startAdd,
    startEdit,
    startDelete,
    closeEditor,
    closeDelete,
    saveItem: handleSave,
    deleteItems: handleDelete,
  };
}
