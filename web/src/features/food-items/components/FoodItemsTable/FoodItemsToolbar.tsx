import { LuPlus, LuTrash2 } from "react-icons/lu";
import SearchBar from "@/components/SearchBar/SearchBar";

const secondaryClass =
  "inline-flex items-center justify-center gap-2 rounded-control border border-border-default bg-surface px-3 py-2 text-sm font-medium text-content hover:bg-surface-hover disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

interface FoodItemsToolbarProps {
  selectedCount: number;
  hasFilters: boolean;
  disabled: boolean;
  onSearch: (value: string) => void;
  onAdd: () => void;
  onClearFilters: () => void;
  onClearSelection: () => void;
  onDeleteSelected: () => void;
}

export default function FoodItemsToolbar({
  selectedCount,
  hasFilters,
  disabled,
  onSearch,
  onAdd,
  onClearFilters,
  onClearSelection,
  onDeleteSelected,
}: FoodItemsToolbarProps) {
  return (
    <div
      aria-label="Pantry actions"
      className="flex flex-wrap items-center gap-3 border-b border-border-default p-4"
    >
      <div className="min-w-36 flex-1 sm:max-w-80">
        <SearchBar
          label="Search food items"
          placeholder="Search items…"
          maxLength={120}
          onSearch={onSearch}
          disabled={disabled}
        />
      </div>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
        {hasFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className={secondaryClass}
          >
            Clear filters
          </button>
        )}
        {selectedCount > 0 && (
          <>
            <span className="text-xs text-content-muted" aria-live="polite">
              {selectedCount} selected
            </span>
            <button
              type="button"
              onClick={onClearSelection}
              className="text-xs text-content-muted underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-brand"
            >
              Clear selection
            </button>
            <button
              type="button"
              onClick={onDeleteSelected}
              className="inline-flex items-center gap-2 rounded-control border border-danger-border bg-surface px-3 py-2 text-xs font-medium text-danger hover:bg-danger-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <LuTrash2 aria-hidden="true" />
              Delete selected ({selectedCount})
            </button>
          </>
        )}
        <button
          type="button"
          disabled={disabled}
          onClick={onAdd}
          className="inline-flex items-center justify-center gap-2 rounded-control bg-brand px-4 py-2.5 text-sm font-semibold text-content-inverse hover:bg-brand-hover disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <LuPlus aria-hidden="true" />
          Add item
        </button>
      </div>
    </div>
  );
}
