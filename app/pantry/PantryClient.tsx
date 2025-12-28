"use client";

import { PANTRY_UNITS, type PantryUnit } from "@/lib/domain/pantry";
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
  expirationDate?: string; // ISO date string
  createdAt?: string; // ISO date string
};

/**
 * Local load state for async data fetching.
 */
type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; items: PantryItem[] };

const units: PantryUnit[] = [...PANTRY_UNITS];

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

  // Form state (minimal - matches server expectations)
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState<string>("1");
  const [unit, setUnit] = useState<PantryUnit>("count");
  const [expirationDate, setExpirationDate] = useState<string>("");

  // UI state for submission feedback
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
  const { withExp, noExp } = useMemo(() => {
    const items = state.status === "ready" ? state.items : [];
    const withExp = items
      .filter((i) => i.expirationDate)
      .sort((a, b) => new Date(a.expirationDate!).getTime() - new Date(b.expirationDate!).getTime());
    const noExp = items
      .filter((i) => !i.expirationDate)
      .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
    return { withExp, noExp };
  }, [state]);

  /**
   * Handle form submit to create a new pantry item.
   * - Performs client-side validation to avoid unnecessary requests
   * - Sends JSON and shows server error messages when available
   */
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const q = Number(quantity);
    if (!name.trim()) return setSubmitError("Name is required.");
    if (!Number.isFinite(q) || q <= 0) return setSubmitError("Quantity must be > 0.");

    setSubmitting(true);

    const res = await fetch("/api/pantry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        quantity: q,
        unit,
        // send `undefined` when no date is selected so the server treats it as absent
        expirationDate: expirationDate ? expirationDate : undefined,
      }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setSubmitError(data?.error || `Failed to add item (${res.status})`);
      return;
    }

    // reset minimal fields after success
    setName("");
    setQuantity("1");
    setUnit("count");
    setExpirationDate("");

    // Refresh list to show the newly created item
    await load();
  }

  return (
    <div className="space-y-6">
      {/* Add Item */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Add item</h2>

        <form onSubmit={onSubmit} className="grid gap-3 max-w-xl">
          <input
            className="border rounded px-3 py-2"
            placeholder="e.g., Chicken breast"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <div className="grid grid-cols-3 gap-3">
            <input
              className="border rounded px-3 py-2"
              type="number"
              min="0"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />

            <select
              className="border rounded px-3 py-2"
              value={unit}
              onChange={(e) => setUnit(e.target.value as PantryUnit)}
            >
              {units.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>

            <input
              className="border rounded px-3 py-2"
              type="date"
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
            />
          </div>

          {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}

          <button
            className="rounded bg-black text-white py-2 disabled:opacity-60"
            disabled={submitting}
            type="submit"
          >
            {submitting ? "Adding..." : "Add"}
          </button>
        </form>
      </section>

      {/* List */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Your pantry</h2>

        {state.status === "loading" ? <p className="text-sm">Loading…</p> : null}

        {state.status === "error" ? (
          <div className="space-y-2">
            <p className="text-sm text-red-600">{state.message}</p>
            <button className="rounded border px-3 py-2" onClick={() => void load()} type="button">
              Retry
            </button>
          </div>
        ) : null}

        {state.status === "ready" && state.items.length === 0 ? (
          <p className="text-sm text-gray-600">No items yet. Add your first item above.</p>
        ) : null}

        {state.status === "ready" && state.items.length > 0 ? (
          <div className="space-y-4">
            {withExp.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Expiring items</h3>
                <ul className="divide-y border rounded">
                  {withExp.map((i) => (
                    <li key={i._id} className="p-3 flex justify-between gap-4">
                      <div>
                        <div className="font-medium">{i.name}</div>
                        <div className="text-sm text-gray-600">
                          {i.quantity} {i.unit}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <div className="text-sm">{formatDate(i.expirationDate)}</div>

                        <button
                          className="text-xs text-red-600 hover:underline hover:cursor-pointer"
                          type="button"
                          onClick={async () => {
                            await fetch(`/api/pantry/${i._id}`, { method: "DELETE" });
                            await load(); // refetch list
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {noExp.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">No expiration date</h3>
                <ul className="divide-y border rounded">
                  {noExp.map((i) => (
                    <li key={i._id} className="p-3 flex justify-between gap-4">
                      <div>
                        <div className="font-medium">{i.name}</div>
                        <div className="text-sm text-gray-600">
                          {i.quantity} {i.unit}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <div className="text-sm">-</div>

                        <button
                          className="text-xs text-red-600 hover:underline hover:cursor-pointer"
                          type="button"
                          onClick={async () => {
                            await fetch(`/api/pantry/${i._id}`, { method: "DELETE" });
                            await load(); // refetch list
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
