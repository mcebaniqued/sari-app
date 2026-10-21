import type { FoodItem } from "@sari/contracts";
import { LuPencil, LuTrash2 } from "react-icons/lu";
import type { FoodItemActions } from "../../types/foodItems";

const actionClass =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-control text-content-muted hover:bg-surface-hover hover:text-content disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

interface FoodItemRowActionsProps extends FoodItemActions {
  item: FoodItem;
}

export default function FoodItemRowActions({
  item,
  disabled,
  onEdit,
  onDelete,
}: FoodItemRowActionsProps) {
  return (
    <div className="flex h-full items-center gap-1">
      <button
        type="button"
        aria-label={`Edit ${item.name}`}
        title="Edit item"
        disabled={disabled}
        onClick={() => {
          onEdit(item);
        }}
        className={actionClass}
      >
        <LuPencil aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label={`Delete ${item.name}`}
        title="Delete item"
        disabled={disabled}
        onClick={() => {
          onDelete([item]);
        }}
        className={`${actionClass} text-danger hover:bg-danger-subtle hover:text-danger`}
      >
        <LuTrash2 aria-hidden="true" />
      </button>
    </div>
  );
}
