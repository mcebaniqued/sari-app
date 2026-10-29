import type { CreateFoodItem, FoodItem } from "@sari/contracts";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import Modal from "@/components/Modal/Modal";
import { useUnsavedChangesGuard } from "@/contexts/UnsavedChangesGuard";
import FoodItemForm, {
  type FoodItemRecoveryState,
} from "../FoodItemForm/FoodItemForm";

interface FoodItemEditorDialogProps {
  item: FoodItem | null;
  busy: boolean;
  onClose: () => void;
  onSave: (
    values: CreateFoodItem,
    expectedRevision: number | null,
  ) => Promise<void>;
  onKeepSavedAndClose: (item: FoodItem) => void;
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
  onKeepSavedAndClose,
  onRestoreFocusFallback,
}: FoodItemEditorDialogProps) {
  const [dirty, setDirty] = useState(false);
  const [recoveryState, setRecoveryState] =
    useState<FoodItemRecoveryState>("editing");
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

      if (!item || (!dirty && recoveryState === "editing")) {
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
    [busy, dirty, item, onClose, recoveryState],
  );

  useUnsavedChangesGuard(
    Boolean(item && (dirty || recoveryState !== "editing")),
    requestDiscard,
  );

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

  const dedicatedRecovery =
    recoveryState === "review-conflict" ||
    recoveryState === "review-uncertain" ||
    recoveryState === "unavailable";

  useLayoutEffect(() => {
    if (
      recoveryState === "review-conflict" ||
      recoveryState === "review-uncertain" ||
      recoveryState === "unavailable"
    ) {
      editContent.current
        ?.closest("dialog")
        ?.querySelector<HTMLElement>("[data-modal-header] h2")
        ?.focus();
    }
  }, [recoveryState]);

  const title = confirmation
    ? "Discard changes?"
    : recoveryState === "review-conflict"
      ? "Review changes"
      : recoveryState === "review-uncertain"
        ? "Review saved version"
        : recoveryState === "unavailable"
          ? "Item unavailable"
          : item
            ? "Edit item"
            : "Add item";

  return (
    <Modal
      title={title}
      description={
        confirmation
          ? "Your unsaved changes will be lost."
          : recoveryState === "review-conflict"
            ? "Compare your edits with the latest saved version."
            : recoveryState === "review-uncertain"
              ? "Compare your edits with the version Sari can currently read."
              : recoveryState === "unavailable"
                ? "Review or copy your unsaved draft before closing."
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
      presentation={dedicatedRecovery ? "responsive" : "centered"}
      scroll="contained"
      dismissal={
        dedicatedRecovery
          ? { backdrop: false, closeButton: !busy, escape: !busy }
          : { backdrop: !busy, closeButton: !busy, escape: !busy }
      }
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
          onDiscardAndClose={onClose}
          onDirtyChange={setDirty}
          onRecoveryStateChange={setRecoveryState}
          onKeepSavedAndClose={onKeepSavedAndClose}
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
