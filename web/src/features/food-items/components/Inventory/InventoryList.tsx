import type { FoodItem } from "@sari/contracts";
import { useEffect, useRef, useState } from "react";
import { LuEllipsis } from "react-icons/lu";
import { formatDate } from "@/utils/date";
import type { FoodItemActions } from "../../types/foodItems";
import ExpirationStatus from "./ExpirationStatus";

interface InventoryListProps extends FoodItemActions {
  items: FoodItem[];
  now: Date;
  selecting: boolean;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
}

export default function InventoryList({
  items,
  now,
  selecting,
  selectedIds,
  onSelectionChange,
  disabled,
  onEdit,
  onDelete,
}: InventoryListProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const openAction = useRef<HTMLDivElement>(null);

  function focusActionTrigger() {
    openAction.current
      ?.querySelector<HTMLButtonElement>("[data-row-action]")
      ?.focus();
  }

  useEffect(() => {
    if (!openId) {
      return;
    }
    const closeOutside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !openAction.current?.contains(event.target)
      ) {
        setOpenId(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenId(null);
        focusActionTrigger();
      }
    };
    const closeOnFocus = (event: FocusEvent) => {
      if (
        event.target instanceof Node &&
        !openAction.current?.contains(event.target)
      ) {
        setOpenId(null);
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("focusin", closeOnFocus);

    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("focusin", closeOnFocus);
    };
  }, [openId]);

  return (
    <ul
      aria-label="Food inventory"
      className="divide-y divide-border-default rounded-panel border border-border-default bg-surface"
    >
      {items.map((item) => (
        <li
          key={item.id}
          className="flex min-w-0 flex-wrap items-start gap-2 px-4 py-3"
        >
          <div className="min-w-0 flex-1">
            <p className="wrap-anywhere font-medium">{item.name}</p>
            <p className="mt-1 text-sm text-content-muted">
              {item.quantity} {item.unit === "item" ? "items" : item.unit}
            </p>
            <p className="mt-1 text-sm text-content-muted">
              {item.expiresOn ? formatDate(item.expiresOn) : "No date"}
            </p>
          </div>
          {item.expiresOn && (
            <div className="max-w-full shrink-0 pt-0.5 text-right">
              <ExpirationStatus expiresOn={item.expiresOn} now={now} />
            </div>
          )}
          <div
            ref={openId === item.id ? openAction : undefined}
            className="relative flex size-11 shrink-0 items-center justify-center"
          >
            {selecting ? (
              <input
                type="checkbox"
                aria-label={`Select ${item.name}`}
                checked={selectedIds.has(item.id)}
                disabled={disabled}
                className="size-4 accent-brand"
                onChange={(event) => {
                  const next = new Set(selectedIds);
                  if (event.target.checked) {
                    next.add(item.id);
                  } else {
                    next.delete(item.id);
                  }
                  onSelectionChange(next);
                }}
              />
            ) : (
              <button
                data-row-action
                data-item-id={item.id}
                type="button"
                aria-label={`Actions for ${item.name}`}
                aria-expanded={openId === item.id}
                disabled={disabled}
                onClick={() => {
                  setOpenId(openId === item.id ? null : item.id);
                }}
                className="inline-flex size-11 items-center justify-center rounded-control hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-brand"
              >
                <LuEllipsis aria-hidden="true" className="size-5" />
              </button>
            )}
            {!selecting && openId === item.id && (
              <div className="absolute top-full right-0 z-20 w-40 rounded-panel border border-border-default bg-surface p-1 shadow-modal">
                <button
                  type="button"
                  aria-label={`Edit ${item.name}`}
                  className="min-h-11 w-full rounded-control px-3 text-left hover:bg-surface-hover"
                  onClick={() => {
                    focusActionTrigger();
                    setOpenId(null);
                    onEdit(item);
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${item.name}`}
                  className="min-h-11 w-full rounded-control px-3 text-left text-danger hover:bg-danger-subtle"
                  onClick={() => {
                    focusActionTrigger();
                    setOpenId(null);
                    onDelete([item]);
                  }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
