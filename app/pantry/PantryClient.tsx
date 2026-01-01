"use client";

import Modal from "@/components/modals/Modal";
import PantryAddForm from "@/components/pantry/PantryAddForm";
import { PantrySortSelect } from "@/components/pantry/PantrySortSelect";
import {
  DATE_LABEL_TYPE_LABELS,
  DEFAULT_PANTRY_SORT,
  PantrySortOption,
  type DateLabelType,
  type PantryUnit,
} from "@/lib/domain/pantry";
import { useEffect, useMemo, useState } from "react";

/**
 * Representation of the pantry item as returned from the API.
 * Dates are serialized as ISO strings by `NextResponse`.
 */
type PantryItem = {
  _id: string;
  name: string;
  quantity: number;
  unit: PantryUnit;
  dateLabelType?: DateLabelType;
  dateOnPackage?: string; // ISO date string
  createdAt?: string; // ISO date string
};

/**
 * Local load state for async data fetching.
 */
type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; items: PantryItem[] };

/**
 * Format an ISO date string for display.
 * Returns `-` for missing or invalid values.
 *
 * @param iso - optional ISO date string
 */
function formatDate(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString();
}

/**
 * Format the package date line for a pantry item.
 * @param i - pantry item
 * @returns formatted line like `Best if used by · 01/01/2024` or `-` if no date
 */
function formatPackageDateLine(i: PantryItem) {
  if (!i.dateOnPackage) return "-";
  const label = i.dateLabelType ? DATE_LABEL_TYPE_LABELS[i.dateLabelType] : "Date on package";
  return `${label} · ${formatDate(i.dateOnPackage)}`;
}

/**
 * Get a sort function based on the selected sort option.
 * @param sortOption - selected sort option
 * @param hasDate- whether to expect items to have dateOnPackage defined
 * @returns comparison function for Array.prototype.sort
 */
const sortBasedOnOption = (sortOption: PantrySortOption, hasDate: boolean) => {
  switch (sortOption) {
    case 'packageDateNewest':
      if (hasDate) {
        return (a: PantryItem, b: PantryItem) => new Date(b.dateOnPackage!).getTime() - new Date(a.dateOnPackage!).getTime();
      }
      // Fallback for items without dateOnPackage
      return (a: PantryItem, b: PantryItem) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
    case 'packageDateOldest':
      if (hasDate) {
        return (a: PantryItem, b: PantryItem) => new Date(a.dateOnPackage!).getTime() - new Date(b.dateOnPackage!).getTime();
      }
      // Fallback for items without dateOnPackage
      return (a: PantryItem, b: PantryItem) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
    case 'addedDateNewest':
      return (a: PantryItem, b: PantryItem) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
    case 'addedDateOldest':
      return (a: PantryItem, b: PantryItem) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
    case 'nameAZ':
      return (a: PantryItem, b: PantryItem) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    case 'nameZA':
      return (a: PantryItem, b: PantryItem) => b.name.localeCompare(a.name, undefined, { sensitivity: "base" });
    default:
      // Safest fallback. Don't use dateOnPackage as it may be undefined, especially for noDate.
      return (a: PantryItem, b: PantryItem) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
  }
};

/**
 * Client component that shows the user's pantry and a small form to add items.
 *
 * Responsibilities:
 * - Load pantry items from `/api/pantry` on mount
 * - Provide a small form with validation to create items
 * - Separate items with expiration dates from those without, and sort them
 */
export default function PantryClient() {
  const [state, setState] = useState<LoadState>({ status: "loading" }); // overall load state for the list
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [sortOption, setSortOption] = useState(DEFAULT_PANTRY_SORT);
  const [draftSortOption, setDraftSortOption] = useState(DEFAULT_PANTRY_SORT);

  /**
   * Load the pantry list from the API.
   * - Uses `cache: 'no-store'` so we always have a fresh view.
   * - Sets explicit `loading` / `error` / `ready` states to control the UI.
   */
  async function load() {
    setState({ status: "loading" });
    const res = await fetch("/api/pantry", { cache: "no-store" });

    if (!res.ok) {
      // Try to read JSON error body but fall back to a generic message
      const data = await res.json().catch(() => ({}));
      setState({
        status: "error",
        message: data?.error || `Failed to load pantry (${res.status})`,
      });
      return;
    }

    const data = await res.json();
    setState({ status: "ready", items: data.items ?? [] });
  }

  useEffect(() => {
    // Load on mount. Wrapped in an async IIFE to avoid making the effect callback async.
    void (async () => {
      await load();
    })();
  }, []);

  /**
   * Open the filter modal.
   * - Sets the draft state to the current value.
   * - Opens the modal.
   */
  function openFilterModal() {
    // Set draft to current value
    setDraftSortOption(sortOption);

    // Open modal
    setIsFilterOpen(true);
  }

  /**
   * Close the filter modal without applying changes.
   */
  function closeFilterModal() {
    setIsFilterOpen(false);
  }

  /**
   * Apply the filter and sort options.
   * - Sets the main sort option from the draft.
   * - Closes the modal.
   */
  function applyFilterAndSort() {
    // Apply sort
    setSortOption(draftSortOption);

    // Close modal
    setIsFilterOpen(false);
  }

  /**
   * Partition and sort items for display.
   * - `withExp`: items with an expiration date, sorted earliest-first
   * - `noExp`: items without an expiration date, newest-first by createdAt
   *
   * We memoize this so sorting only runs when the source `state` changes.
   */
  const { withDate, noDate } = useMemo(() => {
    const items = state.status === "ready" ? state.items : [];

    const withDate = items
      .filter((i) => Boolean(i.dateOnPackage))
      .sort(sortBasedOnOption(sortOption, true));

    const noDate = items
      .filter((i) => !i.dateOnPackage)
      .sort(sortBasedOnOption(sortOption, false));

    return { withDate, noDate };
  }, [state, sortOption]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <section className="space-y-2">
        {/* Mobile toolbar */}
        <div className="flex flex-col gap-2 md:hidden">
          <label className="sr-only" htmlFor="pantry-search">
            Search pantry
          </label>
          <input
            id="pantry-search"
            placeholder="Search..."
            className="w-full rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[rgb(var(--ring))]"
            // TODO: Not wired yet (future issue). Keep it as UI-only for now.
            value={""}
            onChange={() => {}}
          />

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-3 py-2 text-sm"
              onClick={openFilterModal}
            >
              Filter & Sort
            </button>
            <button
              type="button"
              className="rounded-md bg-[rgb(var(--foreground))] text-[rgb(var(--background))] px-3 py-2 text-sm"
              onClick={() => setIsAddOpen(true)}
            >
              Add
            </button>
          </div>
        </div>

        {/* Desktop toolbar */}
        <div className="hidden md:flex items-center gap-3">
          {/* Search Bar */}
          <div className="flex-1">
            <label className="sr-only" htmlFor="pantry-search-desktop">
              Search pantry
            </label>
            <input
              id="pantry-search-desktop"
              placeholder="Search..."
              className="w-full rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[rgb(var(--ring))]"
              // TODO: Not wired yet (future issue). Keep it as UI-only for now.
              value={""}
              onChange={() => {}}
            />
          </div>

          {/* Sort Dropdown */}
          <PantrySortSelect
            value={sortOption}
            onChange={setSortOption}
          />

          {/* Filter Button */}
          <button
            type="button"
            className="rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-3 py-2 text-sm"
            onClick={openFilterModal}
          >
            Filter
          </button>

          <button
            type="button"
            className="rounded-md bg-[rgb(var(--foreground))] text-[rgb(var(--background))] px-3 py-2 text-sm"
            onClick={() => setIsAddOpen(true)}
          >
            Add item
          </button>
        </div>
      </section>

      {/* List */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Your pantry</h2>
        </div>

        {state.status === "loading" ? (
          <p className="text-sm text-[rgb(var(--muted-foreground))]">Loading…</p>
        ) : null}

        {state.status === "error" ? (
          <div className="space-y-2">
            <p className="text-sm text-red-600">{state.message}</p>
            <button
              className="rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-3 py-2 text-sm"
              onClick={() => void load()}
              type="button"
            >
              Retry
            </button>
          </div>
        ) : null}

        {state.status === "ready" && state.items.length === 0 ? (
          <p className="text-sm text-[rgb(var(--muted-foreground))]">
            No items yet. Add your first item above.
          </p>
        ) : null}

        {state.status === "ready" && state.items.length > 0 ? (
          <div className="space-y-4">
            {/* With package date */}
            {withDate.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-[rgb(var(--muted-foreground))]">
                  Items with a package date
                </h3>

                <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--card))]">
                  <ul className="divide-y divide-[rgb(var(--border))]">
                    {withDate.map((i) => (
                      <li key={i._id} className="p-3 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{i.name}</div>
                          <div className="text-sm text-[rgb(var(--muted-foreground))]">
                            {i.quantity} {i.unit}
                          </div>
                        </div>

                        <div className="flex items-end flex-col gap-1">
                          <div className="text-sm whitespace-nowrap">{formatPackageDateLine(i)}</div>

                          <button
                            className="text-xs text-red-600 hover:underline"
                            type="button"
                            onClick={async () => {
                              await fetch(`/api/pantry/${i._id}`, { method: "DELETE" });
                              await load();
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}

            {/* No package date */}
            {noDate.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-[rgb(var(--muted-foreground))]">
                  No expiration date
                </h3>

                <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--card))]">
                  <ul className="divide-y divide-[rgb(var(--border))]">
                    {noDate.map((i) => (
                      <li key={i._id} className="p-3 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{i.name}</div>
                          <div className="text-sm text-[rgb(var(--muted-foreground))]">
                            {i.quantity} {i.unit}
                          </div>
                        </div>

                        <div className="flex items-end flex-col gap-1">
                          <div className="text-sm whitespace-nowrap">-</div>

                          <button
                            className="text-xs text-red-600 hover:underline"
                            type="button"
                            onClick={async () => {
                              await fetch(`/api/pantry/${i._id}`, { method: "DELETE" });
                              await load();
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* Add item modal */}
      {isAddOpen ? (
        <Modal title="Add item" onClose={() => setIsAddOpen(false)}>
          <PantryAddForm
            onSuccess={async () => {
              setIsAddOpen(false);
              await load(); // refresh list immediately
            }}
          />
        </Modal>
      ) : null}

      {/* Filter modal */}
      {isFilterOpen ? (
        <Modal title="Filter" onClose={closeFilterModal}>
          {/* Body/content for filter modal */}
          <div className='flex flex-col md:hidden gap-4'>
            <PantrySortSelect
              value={draftSortOption}
              onChange={setDraftSortOption}
            />
          </div>

          {/* CTA Buttons */}
          <div className="flex items-center justify-end gap-3 mt-4">
            <button
              className="h-10 w-24 rounded-lg border border-[rgb(var(--border))] text-sm font-medium text-[rgb(var(--foreground))] shadow-sm"
              onClick={closeFilterModal}
            >
              Cancel
            </button>
            <button
              className="h-10 w-24 rounded-lg bg-[rgb(var(--foreground))] text-sm font-medium text-[rgb(var(--background))] shadow-sm disabled:opacity-60"
              onClick={applyFilterAndSort}
            >
              Apply
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
