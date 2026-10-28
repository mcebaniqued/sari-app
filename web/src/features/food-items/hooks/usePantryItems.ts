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
export function usePantryItems(onChanged?: () => void) {
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
        ? await updateFoodItem(original.id, {
            expectedRevision: original.revision,
            changes: values,
          })
        : await createFoodItem(values, creationKeyFor(values));

      setRevision((value) => value + 1);
      onChanged?.();
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
      const {
        deletedIds,
        unavailableIds,
        conflictedIds,
        uncertainIds,
        failedIds,
        accessDenied,
      } = await deleteFoodItems(deleteTargets);
      if (
        deletedIds.length ||
        unavailableIds.length ||
        conflictedIds.length ||
        uncertainIds.length
      ) {
        setRevision((value) => value + 1);
        onChanged?.();
      }
      if (deletedIds.length) {
        notify(
          "success",
          deleteTargets.length === 1
            ? `${deleteTargets[0]?.name ?? "Item"} deleted from your pantry.`
            : `${deletedIds.length} ${deletedIds.length === 1 ? "item" : "items"} deleted from your pantry.`,
        );
      }
      if (handleAccessDenied(accessDenied)) {
        return;
      }

      if (conflictedIds.length) {
        notify(
          "error",
          `${conflictedIds.length === 1 ? "An item has" : "Some items have"} changed since this pantry view loaded. The delete was not applied; review the refreshed pantry before trying again.`,
          "pantry-delete-conflict",
        );
      }
      if (uncertainIds.length) {
        notify(
          "error",
          `The outcome for ${uncertainIds.length === 1 ? "an item" : `${uncertainIds.length} items`} could not be confirmed. Sari did not repeat the delete; review the refreshed pantry before trying again.`,
          "pantry-delete-uncertain",
        );
      }
      if (unavailableIds.length) {
        notify(
          "error",
          `${unavailableIds.length === 1 ? "An item is" : "Some items are"} no longer available in your pantry.`,
          "pantry-delete-unavailable",
        );
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

  const acceptCurrentItem = useCallback(
    (item: FoodItem, useServerValues: boolean) => {
      setEditor((current) => {
        if (useServerValues || !current?.item) {
          return { item };
        }

        return {
          item: {
            ...current.item,
            revision: item.revision,
            updatedAt: item.updatedAt,
          },
        };
      });
    },
    [],
  );

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
    acceptCurrentItem,
    closeDelete,
    saveItem: handleSave,
    deleteItems: handleDelete,
  };
}
