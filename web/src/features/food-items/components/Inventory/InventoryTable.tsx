import type { FoodItem } from "@sari/contracts";
import { type RefObject, useEffect } from "react";
import { formatDate } from "@/utils/date";
import type { FoodItemActions } from "../../types/foodItems";
import FoodItemRowActions from "./FoodItemRowActions";

interface InventoryTableProps extends FoodItemActions {
  items: FoodItem[];
  selectedIds: Set<string>;
  selectAllRef: RefObject<HTMLInputElement | null>;
  onSelectionChange: (ids: Set<string>) => void;
}

export default function InventoryTable({
  items,
  selectedIds,
  selectAllRef,
  onSelectionChange,
  ...actions
}: InventoryTableProps) {
  const selectedCount = items.filter((item) => selectedIds.has(item.id)).length;
  const allSelected = items.length > 0 && selectedCount === items.length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectedCount > 0 && !allSelected;
    }
  }, [allSelected, selectedCount, selectAllRef]);

  return (
    <table className="w-full table-fixed border-collapse text-sm">
      <caption className="sr-only">Food inventory</caption>
      <colgroup>
        <col className="w-12" />
        <col />
        <col className="w-34" />
        <col className="w-40" />
        <col className="hidden w-36 lg:table-column" />
        <col className="w-28" />
      </colgroup>
      <thead className="sticky top-0 z-10 bg-surface-subtle text-left text-content-muted">
        <tr>
          <th scope="col" className="border-b border-border-default px-3 py-2">
            <input
              ref={selectAllRef}
              type="checkbox"
              aria-label="Select all loaded items"
              checked={allSelected}
              className="size-4 accent-brand"
              disabled={items.length === 0 || actions.disabled}
              onChange={(event) => {
                onSelectionChange(
                  event.target.checked
                    ? new Set(items.map((item) => item.id))
                    : new Set(),
                );
              }}
            />
          </th>
          <th scope="col" className="border-b border-border-default px-3 py-2">
            Food item
          </th>
          <th
            scope="col"
            className="border-b border-border-default px-3 py-2 text-right"
          >
            Quantity
          </th>
          <th scope="col" className="border-b border-border-default px-3 py-2">
            Expiration date
          </th>
          <th
            scope="col"
            className="hidden border-b border-border-default px-3 py-2 lg:table-cell"
          >
            Date added
          </th>
          <th scope="col" className="border-b border-border-default px-3 py-2">
            Actions
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr
            key={item.id}
            data-item-id={item.id}
            className="border-b border-border-default last:border-b-0 hover:bg-surface-hover"
          >
            <td className="px-3 py-2">
              <input
                type="checkbox"
                aria-label={`Select ${item.name}`}
                checked={selectedIds.has(item.id)}
                className="size-4 accent-brand"
                disabled={actions.disabled}
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
            </td>
            <th
              scope="row"
              className="truncate px-3 py-2 text-left font-medium"
              title={item.name}
            >
              {item.name}
            </th>
            <td className="px-3 py-2 text-right">
              {item.quantity} {item.unit === "item" ? "items" : item.unit}
            </td>
            <td className="px-3 py-2">
              {item.expiresOn
                ? formatDate(item.expiresOn)
                : "No expiration date"}
            </td>
            <td className="hidden px-3 py-2 lg:table-cell">
              {formatDate(item.createdAt)}
            </td>
            <td className="px-3 py-1">
              <FoodItemRowActions item={item} {...actions} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
