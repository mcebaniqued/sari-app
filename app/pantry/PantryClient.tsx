"use client";

import Modal from "@/components/modals/Modal";
import PantryAddForm from "@/components/pantry/PantryAddForm";
import PantryFilterSortForm from "@/components/pantry/PantryFilterSortForm";
import PantryListSection from "@/components/pantry/PantryListSection";
import PantryToolbar from "@/components/pantry/PantryToolbar";
import {
  DATE_LABEL_TYPE_LABELS,
  DEFAULT_PANTRY_SORT,
  formatDate,
  formatPackageDateLine,
  LoadState,
  PantryItem,
  PantrySortOption
} from "@/lib/domain/pantry";
import { compareAsc, compareDesc, compareNameAZ, toTime } from "@/lib/domain/sort";
import { notifySuccess } from "@/lib/ui/toast/toast";
import { useEffect, useMemo, useState } from "react";

/**
 * Get a sort function based on the selected sort option.
 * @param sortOption - selected sort option
 * @returns comparison function for Array.prototype.sort
 */
const sortBasedOnOption = (sortOption: PantrySortOption) => {
  function compareExpirationWithFallback(a: PantryItem, b: PantryItem) {
    if (a.dateOnPackage) {
      // If only a has dateOnPackage, it goes first
      return -1;
    } else if (b.dateOnPackage) {
      // If only b has dateOnPackage, it goes first
      return 1;
    } else {
      // If neither have dateOnPackage, sort by createdAt (newest first), then name (A-Z), then _id to ensure consistent order
      const c1 = compareDesc(toTime(a.createdAt), toTime(b.createdAt));
      if (c1 !== 0) {
        return c1;
      }

      const c2 = compareNameAZ(a.name, b.name);
      if (c2 !== 0) {
        return c2;
      }

      return a._id.localeCompare(b._id);
    }
  }

  switch (sortOption) {
    case "expirationDateSoonest":
      return (a: PantryItem, b: PantryItem) => {
        // If both have dateOnPackage, sort by it
        if (a.dateOnPackage && b.dateOnPackage) {
          return compareAsc(toTime(a.dateOnPackage), toTime(b.dateOnPackage));
        } else {
          // If one or both don't have dateOnPackage, use the fallback that puts items with dates first, then sorts by createdAt and name
          return compareExpirationWithFallback(a, b);
        }
      };
    case "expirationDateLatest":
      return (a: PantryItem, b: PantryItem) => {
        // If both have dateOnPackage, sort by it
        if (a.dateOnPackage && b.dateOnPackage) {
          return compareDesc(toTime(a.dateOnPackage), toTime(b.dateOnPackage));
        } else {
          // If one or both don't have dateOnPackage, use the fallback that puts items with dates first, then sorts by createdAt and name
          return compareExpirationWithFallback(a, b);
        }
      };
    case "addedDateNewest":
      return (a: PantryItem, b: PantryItem) => compareDesc(toTime(a.createdAt), toTime(b.createdAt));
    case "addedDateOldest":
      return (a: PantryItem, b: PantryItem) => compareAsc(toTime(a.createdAt), toTime(b.createdAt));

    case "nameAZ":
      return (a: PantryItem, b: PantryItem) => compareNameAZ(a.name, b.name);

    case "nameZA":
      return (a: PantryItem, b: PantryItem) => compareNameAZ(b.name, a.name);

    default:
      // Safest fallback. Don't use dateOnPackage as it may be undefined, especially for noDate.
      return (a: PantryItem, b: PantryItem) => compareDesc(toTime(a.createdAt), toTime(b.createdAt));
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
  const [searchQuery, setSearchQuery] = useState("");

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
   * Handle search input changes.
   * @param e - change event from the search input
   */
  function onSearchChange(nextQuery: string) {
    setSearchQuery(nextQuery);
  }

  // Trimmed search query for filtering. We trim here so that the memoized sorting only runs when the meaningful query changes, not when the user types extra spaces.
  const q = searchQuery.trim();

  /**
   * Partition and sort items for display.
   * - `withDate`: items with a package date, sorted earliest-first
   * - `noDate`: items without a package date, newest-first by createdAt
   *
   * We memoize this so sorting only runs when the source `state`, `sortOption`, and `q` changes.
   */
  const pantryItems = useMemo(() => {
    const qLower = q.toLowerCase(); // Prevents from calling `toLowerCase` repeatedly in the filter below.

    // First filter based on search query. If the query is empty, show all items.
    const searchItems = state.status === "ready" && q !== ""
      ? state.items.filter((i) => i.name.toLowerCase().includes(qLower))
      : state.status === "ready"
        ? state.items
        : [];

    // Then sort based on the selected sort option.
    return [...searchItems] // We spread to avoid mutating the original array in state.
      .sort(sortBasedOnOption(sortOption));
  }, [state, sortOption, q]);

  return (
    <div className="space-y-4">
      <PantryToolbar
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        sortOption={sortOption}
        onSortChange={setSortOption}
        openFilterModal={openFilterModal}
        onAdd={() => setIsAddOpen(true)}
      />

      {/* List */}
      <PantryListSection
        state={state}
        pantryItems={pantryItems}
        searchQuery={searchQuery}
        onLoad={load}
        onDelete={async (item) => {
          await fetch(`/api/pantry/${item._id}`, { method: "DELETE" });
          notifySuccess("Item removed", `${item.name} · ${item.quantity} ${item.unit} · ${formatPackageDateLine(item)}`);
          await load();
        }}
      />

      {/* Add item modal */}
      {isAddOpen ? (
        <Modal
          title="Add item"
          onClose={() => setIsAddOpen(false)}
          footer={
            <div className="flex justify-end">
              <button
                type="submit"
                form="pantry-add-form"
                className="h-10 rounded-lg bg-[rgb(var(--foreground))] px-6 text-sm font-medium text-[rgb(var(--background))]"
              >
                Add
              </button>
            </div>
          }
        >
          <PantryAddForm
            formId="pantry-add-form"
            onSuccess={async ({ name, quantity, unit, dateLabelType, dateOnPackage }) => {
              setIsAddOpen(false);
              notifySuccess("Item added", `${name} · ${quantity} ${unit} ${dateOnPackage ? `· ${DATE_LABEL_TYPE_LABELS[dateLabelType]} ${formatDate(dateOnPackage)}` : ""}`);
              await load(); // refresh list immediately
            }}
          />
        </Modal>
      ) : null}

      {/* Filter modal */}
      {isFilterOpen ? (
        <Modal
          title="Filter & Sort"
          onClose={closeFilterModal}
          footer={
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="h-10 w-24 rounded-lg border border-[rgb(var(--border))] text-sm font-medium text-[rgb(var(--foreground))] shadow-sm"
                onClick={closeFilterModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="h-10 w-24 rounded-lg bg-[rgb(var(--foreground))] text-sm font-medium text-[rgb(var(--background))] shadow-sm disabled:opacity-60"
                onClick={applyFilterAndSort}
              >
                Apply
              </button>
            </div>
          }
        >
          <PantryFilterSortForm
            draftSortOption={draftSortOption}
            onDraftSortChange={setDraftSortOption}
          />
        </Modal>
      ) : null}
    </div>
  );
}
