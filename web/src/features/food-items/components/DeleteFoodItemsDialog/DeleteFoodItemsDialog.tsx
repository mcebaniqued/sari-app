import type { FoodItem } from "@sari/contracts";
import { LuTrash2 } from "react-icons/lu";
import Modal from "@/components/Modal/Modal";

interface DeleteFoodItemsDialogProps {
  items: FoodItem[];
  error: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function DeleteFoodItemsDialog({
  items,
  error,
  busy,
  onClose,
  onConfirm,
}: DeleteFoodItemsDialogProps) {
  return (
    <Modal
      title={
        items.length === 1 ? "Delete item?" : `Delete ${items.length} items?`
      }
      description="These items will be permanently removed from your pantry."
      onClose={onClose}
      dismissible={!busy}
    >
      <div className="px-6 py-5">
        <ul className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-border-default bg-surface-subtle p-4 text-sm">
          {items.map((item) => (
            <li key={item.id} className="wrap-anywhere">
              {item.name}
            </li>
          ))}
        </ul>
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-danger-subtle p-3 text-sm text-danger"
          >
            {error}
          </p>
        )}
      </div>
      <div className="flex justify-end gap-3 border-t border-border-default bg-surface-subtle/60 px-6 py-4">
        <button
          type="button"
          data-autofocus
          disabled={busy}
          onClick={onClose}
          className="inline-flex items-center justify-center gap-2 rounded-control border border-border-default bg-surface px-3 py-2 text-sm font-medium text-content hover:bg-surface-hover disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void onConfirm();
          }}
          className="inline-flex items-center justify-center gap-2 rounded-control bg-danger px-4 py-2.5 text-sm font-semibold text-content-inverse hover:bg-danger-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <LuTrash2 aria-hidden="true" />
          {busy ? "Deleting…" : "Confirm delete"}
        </button>
      </div>
    </Modal>
  );
}
