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
 * @param hasDate- whether to expect items to have dateOnPackage defined
 * @returns comparison function for Array.prototype.sort
 */
const sortBasedOnOption = (sortOption: PantrySortOption, hasDate: boolean) => {
  switch (sortOption) {
    case "expirationDateSoonest":
      return hasDate
        ? (a: PantryItem, b: PantryItem) => compareAsc(toTime(a.dateOnPackage), toTime(b.dateOnPackage))
        // Fallback for items without dateOnPackage
        : (a: PantryItem, b: PantryItem) => compareAsc(toTime(a.createdAt), toTime(b.createdAt));

    case "expirationDateLatest":
      return hasDate
        ? (a: PantryItem, b: PantryItem) => compareDesc(toTime(a.dateOnPackage), toTime(b.dateOnPackage))
        // Fallback for items without dateOnPackage
        : (a: PantryItem, b: PantryItem) => compareDesc(toTime(a.createdAt), toTime(b.createdAt));

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
  const { withDate, noDate } = useMemo(() => {
    const qLower = q.toLowerCase(); // Prevents from calling `toLowerCase` repeatedly in the filter below.

    // First filter based on search query. If the query is empty, show all items.
    const searchItems = state.status === "ready" && q !== ""
      ? state.items.filter((i) => i.name.toLowerCase().includes(qLower))
      : state.status === "ready"
        ? state.items
        : [];

    // Then partition based on presence of dateOnPackage and sort each list based on the selected sort option.
    const withDate = searchItems
      .filter((i) => Boolean(i.dateOnPackage))
      .sort(sortBasedOnOption(sortOption, true));

    const noDate = searchItems
      .filter((i) => !i.dateOnPackage)
      .sort(sortBasedOnOption(sortOption, false));

    return { withDate, noDate };
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
        withDate={withDate}
        noDate={noDate}
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
        <Modal title="Add item" onClose={() => setIsAddOpen(false)}>
          <PantryAddForm
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
        <Modal title="Filter & Sort" onClose={closeFilterModal}>
          <PantryFilterSortForm
            draftSortOption={draftSortOption}
            onDraftSortChange={setDraftSortOption}
            onCancel={closeFilterModal}
            onApply={applyFilterAndSort}
          />
        </Modal>
      ) : null}
    </div>
  );
}
