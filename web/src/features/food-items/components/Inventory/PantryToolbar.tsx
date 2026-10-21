import type { FoodItemQuery } from "@sari/contracts";
import { useState } from "react";
import { LuPlus, LuTrash2, LuX } from "react-icons/lu";
import SearchBar from "@/components/SearchBar/SearchBar";
import FilterDialog from "./FilterDialog";
import { SORT_CHOICES, sortChoiceValue } from "./sortChoices";

interface PantryToolbarProps {
  query: Pick<FoodItemQuery, "search" | "sort" | "filters">;
  selectedCount: number;
  loadedCount: number;
  selecting: boolean;
  disabled: boolean;
  onSearch: (search: string) => void;
  onSort: (sort: FoodItemQuery["sort"]) => void;
  onFilters: (
    filters: FoodItemQuery["filters"],
    sort: FoodItemQuery["sort"],
  ) => void;
  onRemoveFilter: (field: keyof FoodItemQuery["filters"]) => void;
  onAdd: () => void;
  onSelectMode: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDeleteSelected: () => void;
}

const secondary =
  "inline-flex min-h-11 items-center justify-center rounded-control border border-border-default bg-surface px-3 text-sm font-medium hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-brand";

function describeFilter(
  field: keyof FoodItemQuery["filters"],
  filter: NonNullable<FoodItemQuery["filters"][typeof field]>,
) {
  const label =
    field === "expiresOn"
      ? "Expiration date"
      : field === "createdAt"
        ? "Date added"
        : field === "name"
          ? "Food name"
          : field;
  const condition = filter.type.replace(/([A-Z])/g, " $1").toLowerCase();
  const value = filter.filterType === "date" ? filter.dateFrom : filter.filter;
  const end =
    filter.filterType === "date"
      ? filter.dateTo
      : filter.filterType === "number"
        ? filter.filterTo
        : undefined;

  return `${label}: ${condition}${value === undefined || value === null ? "" : ` ${value}`}${end === undefined || end === null ? "" : ` through ${end}`}`;
}

export default function PantryToolbar({
  query,
  selectedCount,
  loadedCount,
  selecting,
  disabled,
  onSearch,
  onSort,
  onFilters,
  onRemoveFilter,
  onAdd,
  onSelectMode,
  onSelectAll,
  onClearSelection,
  onDeleteSelected,
}: PantryToolbarProps) {
  const [panel, setPanel] = useState<"desktop" | "mobile" | null>(null);
  const activeFilters = Object.keys(
    query.filters,
  ) as (keyof FoodItemQuery["filters"])[];

  return (
    <>
      <div aria-label="Pantry actions" className="space-y-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <div className="min-w-0 flex-1 sm:max-w-80">
            <SearchBar
              label="Search food items"
              placeholder="Search items…"
              maxLength={120}
              onSearch={onSearch}
              disabled={disabled}
            />
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={onAdd}
            className="inline-flex min-h-11 w-28 shrink-0 items-center justify-center gap-1 rounded-control bg-brand px-3 text-sm font-semibold text-content-inverse hover:bg-brand-hover disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-brand"
          >
            <LuPlus aria-hidden="true" /> Add item
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden items-center gap-2 md:flex">
            <label htmlFor="pantry-sort" className="text-sm font-medium">
              Sort by
            </label>
            <select
              id="pantry-sort"
              aria-label="Sort pantry items"
              value={sortChoiceValue(query.sort)}
              disabled={disabled}
              onChange={(event) => {
                onSort(
                  SORT_CHOICES.find(
                    (choice) => choice.value === event.target.value,
                  )?.sort ?? [],
                );
              }}
              className="min-h-11 max-w-72 rounded-control border border-border-control bg-surface px-3 text-sm"
            >
              {SORT_CHOICES.map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setPanel("desktop");
              }}
              className={secondary}
            >
              Filter{activeFilters.length ? ` (${activeFilters.length})` : ""}
            </button>
          </div>
          <div className="flex gap-2 md:hidden">
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setPanel("mobile");
              }}
              className={secondary}
            >
              Sort
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setPanel("mobile");
              }}
              className={secondary}
            >
              Filter{activeFilters.length ? ` (${activeFilters.length})` : ""}
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={onSelectMode}
              className={secondary}
            >
              {selecting ? "Done selecting" : "Select"}
            </button>
          </div>
          {selecting && loadedCount > 0 && (
            <button
              type="button"
              onClick={onSelectAll}
              className={`${secondary} md:hidden`}
            >
              Select all loaded ({loadedCount})
            </button>
          )}
          {selectedCount > 0 && (
            <div className="flex flex-wrap items-center gap-2 md:ml-auto">
              <span aria-live="polite" className="text-sm text-content-muted">
                {selectedCount} selected
              </span>
              <button
                type="button"
                onClick={onClearSelection}
                className="min-h-11 px-2 text-sm underline"
              >
                Clear selection
              </button>
              <button
                type="button"
                onClick={onDeleteSelected}
                className="inline-flex min-h-11 items-center gap-1 rounded-control border border-danger-border px-3 text-sm text-danger hover:bg-danger-subtle"
              >
                <LuTrash2 aria-hidden="true" />
                Delete selected ({selectedCount})
              </button>
            </div>
          )}
        </div>
        {activeFilters.length > 0 && (
          <div aria-label="Active filters" className="flex flex-wrap gap-2">
            {activeFilters.map((field) => (
              <button
                key={field}
                type="button"
                aria-label={`Remove ${field} filter`}
                onClick={() => {
                  onRemoveFilter(field);
                }}
                className="inline-flex min-h-11 items-center gap-1 rounded-control bg-brand-subtle px-3 text-xs text-content focus-visible:outline-2 focus-visible:outline-brand"
              >
                {query.filters[field] &&
                  describeFilter(field, query.filters[field])}
                <LuX aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
      </div>
      {panel && (
        <FilterDialog
          key={panel}
          filters={query.filters}
          sort={query.sort}
          mobile={panel === "mobile"}
          onClose={() => {
            setPanel(null);
          }}
          onApply={(filters, sort) => {
            onFilters(filters, sort);
            setPanel(null);
          }}
        />
      )}
    </>
  );
}
