import type { CreateFoodItem, FoodItem } from "@sari/contracts";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import Modal from "@/components/Modal/Modal";
import { useUnsavedChangesGuard } from "@/contexts/UnsavedChangesGuard";
import FoodItemForm from "../FoodItemForm/FoodItemForm";

interface FoodItemEditorDialogProps {
  item: FoodItem | null;
  busy: boolean;
  onClose: () => void;
  onSave: (values: CreateFoodItem) => Promise<void>;
  onAcceptCurrentItem: (item: FoodItem, useServerValues: boolean) => void;
  onRestoreFocusFallback?: () => void;
}

interface DiscardConfirmation {
  onDiscard: () => void;
  onContinue: () => void;
}

export default function FoodItemEditorDialog({
  item,
  busy,
  onClose,
  onSave,
  onAcceptCurrentItem,
  onRestoreFocusFallback,
}: FoodItemEditorDialogProps) {
  const [dirty, setDirty] = useState(false);
  const [confirmation, setConfirmation] = useState<DiscardConfirmation | null>(
    null,
  );
  const editContent = useRef<HTMLDivElement>(null);
  const lastEditFocus = useRef<HTMLElement | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const continueButton = useRef<HTMLButtonElement>(null);

  const requestDiscard = useCallback(
    (
      onDiscard: () => void = onClose,
      onContinue: () => void = () => void 0,
    ) => {
      if (busy) {
        onContinue();

        return;
      }

      if (!item || !dirty) {
        onDiscard();

        return;
      }

      const active = document.activeElement;
      const dialog = editContent.current?.closest("dialog");
      previousFocus.current =
        active instanceof HTMLElement &&
        dialog?.contains(active) &&
        active !== dialog
          ? active
          : lastEditFocus.current;
      setConfirmation({ onDiscard, onContinue });
    },
    [busy, dirty, item, onClose],
  );

  useUnsavedChangesGuard(Boolean(item && dirty), requestDiscard);

  useLayoutEffect(() => {
    if (confirmation) {
      continueButton.current?.focus();
    } else {
      previousFocus.current?.focus();
      previousFocus.current = null;
    }
  }, [confirmation]);

  function continueEditing() {
    confirmation?.onContinue();
    setConfirmation(null);
  }

  return (
    <Modal
      title={
        confirmation ? "Discard changes?" : item ? "Edit item" : "Add item"
      }
      description={
        confirmation
          ? "Your unsaved changes will be lost."
          : item
            ? "Update the details of your pantry item."
            : "Add something you have on hand."
      }
      onClose={
        confirmation
          ? continueEditing
          : () => {
              requestDiscard();
            }
      }
      onRestoreFocusFallback={onRestoreFocusFallback}
      dismissible={!busy}
    >
      <div
        ref={editContent}
        hidden={Boolean(confirmation)}
        aria-hidden={Boolean(confirmation)}
        onFocusCapture={(event) => {
          lastEditFocus.current = event.target;
        }}
      >
        <FoodItemForm
          item={item}
          disabled={busy}
          onSave={onSave}
          onCancel={() => {
            requestDiscard();
          }}
          onDirtyChange={setDirty}
          onAcceptCurrentItem={onAcceptCurrentItem}
        />
      </div>
      {confirmation && (
        <div className="space-y-5 px-6 py-6">
          <p className="text-sm leading-relaxed text-content-muted">
            Continue editing to keep your draft, or discard it to complete the
            action you requested.
          </p>
          <div className="flex flex-wrap justify-end gap-3">
            <button
              ref={continueButton}
              type="button"
              onClick={continueEditing}
              className="min-h-11 rounded-control border border-border-default bg-surface px-4 py-2.5 text-sm font-medium text-content hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              Continue editing
            </button>
            <button
              type="button"
              onClick={confirmation.onDiscard}
              className="min-h-11 rounded-control border border-danger-border bg-danger px-4 py-2.5 text-sm font-semibold text-content-inverse hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              Discard changes
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
