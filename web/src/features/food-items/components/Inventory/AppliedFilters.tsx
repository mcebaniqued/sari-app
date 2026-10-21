import { LuX } from "react-icons/lu";
import {
  appliedFilterEntries,
  type InventoryFilters,
  type LogicalFilterField,
} from "./filterModel";

interface AppliedFiltersProps {
  filters: InventoryFilters;
  disabled: boolean;
  onEdit: (field: LogicalFilterField) => void;
  onRemove: (field: LogicalFilterField) => void;
  onClear: () => void;
}

export default function AppliedFilters({
  filters,
  disabled,
  onEdit,
  onRemove,
  onClear,
}: AppliedFiltersProps) {
  const active = appliedFilterEntries(filters);
  if (!active.length) {
    return null;
  }

  return (
    <section
      aria-label="Applied filters"
      className="mb-3 rounded-control border border-border-default bg-surface px-3 py-2"
    >
      <h2 className="mb-2 text-sm font-semibold">Applied filters</h2>
      <div className="flex flex-wrap items-center gap-2">
        {active.map((entry) => (
          <div
            key={entry.field}
            className="inline-flex min-h-11 items-center rounded-control border border-border-default bg-surface text-sm"
          >
            <button
              type="button"
              disabled={disabled}
              aria-label={`Edit ${entry.label} filter`}
              onClick={() => {
                onEdit(entry.field);
              }}
              className="min-h-11 rounded-l-control px-3 text-left hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50"
            >
              {entry.description}
            </button>
            <button
              type="button"
              disabled={disabled}
              aria-label={`Remove ${entry.label} filter`}
              onClick={() => {
                onRemove(entry.field);
              }}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-r-control hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50"
            >
              <LuX aria-hidden="true" />
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={disabled}
          onClick={onClear}
          className="min-h-11 rounded-control px-2 text-sm underline focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50"
        >
          Clear all
        </button>
      </div>
    </section>
  );
}
