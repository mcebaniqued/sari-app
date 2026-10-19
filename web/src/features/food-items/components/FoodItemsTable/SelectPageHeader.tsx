import type { FoodItem } from "@sari/contracts";
import type { GridApi } from "ag-grid-community";
import { useEffect, useRef, useState } from "react";

export default function SelectPageHeader({ api }: { api: GridApi<FoodItem> }) {
  const input = useRef<HTMLInputElement>(null);
  const [selection, setSelection] = useState({ selected: 0, total: 0 });
  useEffect(() => {
    let active = true;
    const update = () => {
      if (!active || api.isDestroyed()) {
        return;
      }
      const start =
        api.paginationGetCurrentPage() * api.paginationGetPageSize();
      const end = start + api.paginationGetPageSize();
      let selected = 0;
      let total = 0;
      api.forEachNode((node) => {
        if (
          node.data &&
          node.rowIndex !== null &&
          node.rowIndex >= start &&
          node.rowIndex < end
        ) {
          total++;
          if (node.isSelected()) {
            selected++;
          }
        }
      });
      setSelection((current) =>
        current.selected === selected && current.total === total
          ? current
          : { selected, total },
      );
    };
    api.addEventListener("selectionChanged", update);
    api.addEventListener("paginationChanged", update);
    api.addEventListener("modelUpdated", update);
    queueMicrotask(update);
    return () => {
      active = false;
      if (!api.isDestroyed()) {
        api.removeEventListener("selectionChanged", update);
        api.removeEventListener("paginationChanged", update);
        api.removeEventListener("modelUpdated", update);
      }
    };
  }, [api]);
  useEffect(() => {
    if (input.current) {
      input.current.indeterminate =
        selection.selected > 0 && selection.selected < selection.total;
    }
  }, [selection]);
  return (
    <input
      ref={input}
      type="checkbox"
      aria-label="Select current page"
      checked={selection.total > 0 && selection.selected === selection.total}
      disabled={selection.total === 0}
      onChange={(event) => {
        const start =
          api.paginationGetCurrentPage() * api.paginationGetPageSize();
        const end = start + api.paginationGetPageSize();
        const checked = event.target.checked;
        api.forEachNode((node) => {
          if (
            node.data &&
            node.rowIndex !== null &&
            node.rowIndex >= start &&
            node.rowIndex < end
          ) {
            node.setSelected(checked);
          }
        });
      }}
      className="size-4 cursor-pointer accent-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed"
    />
  );
}
