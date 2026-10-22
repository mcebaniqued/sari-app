import type { FoodItemQuery } from "@sari/contracts";
import { type Ref, useState } from "react";
import { LuArrowDownUp, LuListFilter, LuPlus } from "react-icons/lu";
import SearchBar from "@/components/SearchBar/SearchBar";
import DesktopSortControl from "./DesktopSortControl";
import { appliedFilterEntries } from "./filterModel";
import MobileSortDialog from "./MobileSortDialog";
import { SORT_CHOICES, sortChoiceValue } from "./sortChoices";

interface PantryToolbarProps {
  query: Pick<FoodItemQuery, "search" | "sort" | "filters">;
  disabled: boolean;
  onSearch: (search: string) => void;
  onSort: (sort: FoodItemQuery["sort"]) => void;
  filterOpen: boolean;
  filterButtonRef: Ref<HTMLButtonElement>;
  mobileAddButtonRef: Ref<HTMLButtonElement>;
  onOpenFilters: () => void;
  onAdd: () => void;
}

const secondary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-border-default bg-surface px-3 text-sm font-medium hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50";

export default function PantryToolbar({
  query,
  disabled,
  onSearch,
  onSort,
  filterOpen,
  filterButtonRef,
  mobileAddButtonRef,
  onOpenFilters,
  onAdd,
}: PantryToolbarProps) {
  const [mobileSortOpen, setMobileSortOpen] = useState(false);
  const activeFilters = appliedFilterEntries(query.filters);
  const filterLabel = `Filter${activeFilters.length ? ` (${activeFilters.length})` : ""}`;
  const filterClass = `${secondary} ${activeFilters.length ? "border-brand bg-brand-subtle text-brand" : ""}`;
  const activeSortLabel =
    SORT_CHOICES.find((choice) => choice.value === sortChoiceValue(query.sort))
      ?.label ??
    SORT_CHOICES[0]?.label ??
    "";

  function addButton(className: string, ref?: Ref<HTMLButtonElement>) {
    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        onClick={onAdd}
        className={className}
      >
        <LuPlus aria-hidden="true" /> Add item
      </button>
    );
  }

  return (
    <>
      <div role="group" aria-label="Pantry actions">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 md:flex md:min-h-11 md:items-center">
          <div className="min-w-0 md:flex-1">
            <SearchBar
              label="Search food items"
              placeholder="Search items…"
              maxLength={120}
              onSearch={onSearch}
              disabled={disabled}
            />
          </div>
          {addButton(
            "inline-flex min-h-11 w-28 shrink-0 items-center justify-center gap-1 rounded-control bg-brand px-3 text-sm font-semibold text-content-inverse hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50 md:hidden",
            mobileAddButtonRef,
          )}
          <div className="col-span-2 grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-2 md:col-auto md:ml-auto md:flex md:shrink-0">
            <div className="hidden md:block">
              <DesktopSortControl
                sort={query.sort}
                disabled={disabled}
                onSort={onSort}
              />
            </div>
            <button
              type="button"
              disabled={disabled}
              aria-label={`Sort by: ${activeSortLabel}`}
              aria-haspopup="dialog"
              aria-expanded={mobileSortOpen}
              onClick={() => {
                setMobileSortOpen(true);
              }}
              className={`${secondary} min-w-0 whitespace-nowrap md:hidden`}
            >
              <LuArrowDownUp aria-hidden="true" className="shrink-0" />
              {activeSortLabel}
            </button>
            <button
              ref={filterButtonRef}
              type="button"
              disabled={disabled}
              aria-haspopup="dialog"
              aria-expanded={filterOpen}
              onClick={onOpenFilters}
              className={filterClass}
            >
              <LuListFilter aria-hidden="true" /> {filterLabel}
            </button>
          </div>
          {addButton(
            "hidden min-h-11 shrink-0 items-center justify-center gap-1 rounded-control bg-brand px-3 text-sm font-semibold text-content-inverse hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50 md:inline-flex",
          )}
        </div>
      </div>
      {mobileSortOpen && (
        <MobileSortDialog
          sort={query.sort}
          onClose={() => {
            setMobileSortOpen(false);
          }}
          onApply={(sort) => {
            onSort(sort);
            setMobileSortOpen(false);
          }}
        />
      )}
    </>
  );
}
