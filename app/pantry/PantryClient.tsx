"use client";

import Modal from "@/components/modals/Modal";
import PantryAddForm from "@/components/pantry/PantryAddForm";
import {
  DATE_LABEL_TYPE_LABELS,
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

function formatPackageDateLine(i: PantryItem) {
  if (!i.dateOnPackage) return "-";
  const label = i.dateLabelType ? DATE_LABEL_TYPE_LABELS[i.dateLabelType] : "Date on package";
  return `${label} · ${formatDate(i.dateOnPackage)}`;
}

/**
 * Client component that shows the user's pantry and a small form to add items.
 *
 * Responsibilities:
 * - Load pantry items from `/api/pantry` on mount
 * - Provide a small form with validation to create items
 * - Separate items with expiration dates from those without, and sort them
 */
export default function PantryClient() {
  // overall load state for the list
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

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
      .sort((a, b) => new Date(a.dateOnPackage!).getTime() - new Date(b.dateOnPackage!).getTime());

    const noDate = items
      .filter((i) => !i.dateOnPackage)
      .sort(
        (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
      );

    return { withDate, noDate };
  }, [state]);

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
              // TODO: Not wired yet (future issue). Keep it as UI-only for now.
              onClick={() => {}}
            >
              Filter
            </button>
            <button
              type="button"
              className="rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-3 py-2 text-sm"
              // TODO: Not wired yet (future issue). Keep it as UI-only for now.
              onClick={() => {}}
            >
              Sort
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

          <select className="rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-3 py-2 text-sm">
            <option>Sort: Package date</option>
            <option>Sort: Added (newest)</option>
            <option>Sort: Added (oldest)</option>
            <option>Sort: Name</option>
          </select>

          <button
            type="button"
            className="rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-3 py-2 text-sm"
            onClick={() => setIsFilterOpen(true)}
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
        <Modal title="Filter" onClose={() => setIsFilterOpen(false)}>
          <div>
            <p className="text-sm text-[rgb(var(--muted-foreground))]">Filter options will go here.</p>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
