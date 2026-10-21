import type { FoodItem } from "@sari/contracts";
import type { GridApi, IRowNode } from "ag-grid-community";
import { useEffect, useRef, useState } from "react";

function getPageNodes(api: GridApi<FoodItem>) {
  const start = api.paginationGetCurrentPage() * api.paginationGetPageSize();
  const end = start + api.paginationGetPageSize();
  const nodes: IRowNode<FoodItem>[] = [];
  api.forEachNode((node) => {
    if (
      node.data &&
      node.rowIndex !== null &&
      node.rowIndex >= start &&
      node.rowIndex < end
    ) {
      nodes.push(node);
    }
  });

  return nodes;
}

export default function SelectPageHeader({ api }: { api: GridApi<FoodItem> }) {
  const input = useRef<HTMLInputElement>(null);

  const [selection, setSelection] = useState({ selected: 0, total: 0 });

  useEffect(() => {
    let active = true;

    const update = () => {
      if (!active || api.isDestroyed()) {
        return;
      }

      const nodes = getPageNodes(api);
      const selected = nodes.filter((node) => node.isSelected()).length;
      const total = nodes.length;
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
        const nodes = getPageNodes(api);
        api.setNodesSelected({ nodes, newValue: event.currentTarget.checked });
        // AG Grid delivers selection events asynchronously. A controlled input
        // must reflect this click before React restores its checked state.
        setSelection({
          selected: nodes.filter((node) => node.isSelected()).length,
          total: nodes.length,
        });
      }}
      className="size-4 cursor-pointer accent-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed"
    />
  );
}
