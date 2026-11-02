import type { CreateFoodItem, FoodItem } from "@sari/contracts";
import { useCallback, useRef, useState } from "react";
import { notify } from "@/components/Toast/notifications";
import { useAccessDenied } from "@/hooks/useAccessDenied";
import { deleteFoodItems } from "../api/foodItemsApi";
import type { FoodItemEditorState } from "../types/foodItems";
import { useSaveFoodItem } from "./useSaveFoodItem";

/** Coordinate mutations; retain a creation key only while retrying the same draft. */
export function usePantryItems(onChanged?: () => void) {
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState<FoodItemEditorState | null>(null);
  const [deleteTargets, setDeleteTargets] = useState<FoodItem[] | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);

  const deleteMutationRef = useRef(false);
  const handleAccessDenied = useAccessDenied();
  const handleChanged = useCallback(() => {
    setRevision((value) => value + 1);
    onChanged?.();
  }, [onChanged]);
  const {
    busy: saveBusy,
    resetCreateOperation,
    saveItem,
  } = useSaveFoodItem(handleChanged);
  const busy = saveBusy || deleteBusy;

  const startDelete = useCallback((targets: FoodItem[]) => {
    setDeleteError("");
    setDeleteTargets([...targets]);
  }, []);

  async function handleSave(
    values: CreateFoodItem,
    expectedRevision: number | null,
  ) {
    const original = editor?.item;
    await saveItem(original ?? null, values, expectedRevision);
    setEditor(null);
  }

  async function handleDelete() {
    if (deleteMutationRef.current || saveBusy || !deleteTargets?.length) {
      return;
    }

    deleteMutationRef.current = true;
    setDeleteBusy(true);
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
      deleteMutationRef.current = false;
      setDeleteBusy(false);
    }
  }

  const startAdd = useCallback(() => {
    resetCreateOperation();
    setEditor({ item: null });
  }, [resetCreateOperation]);

  const closeEditor = useCallback(() => {
    setEditor(null);
  }, []);

  const keepSavedAndClose = useCallback(
    (item: FoodItem) => {
      setRevision((value) => value + 1);
      onChanged?.();
      setEditor((current) => (current?.item?.id === item.id ? null : current));
    },
    [onChanged],
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
    startDelete,
    closeEditor,
    keepSavedAndClose,
    closeDelete,
    saveItem: handleSave,
    deleteItems: handleDelete,
  };
}
