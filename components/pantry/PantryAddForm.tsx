"use client";

import { PANTRY_UNITS, type PantryUnit } from "@/lib/domain/pantry";
import { useState } from "react";

const units: PantryUnit[] = [...PANTRY_UNITS];

interface PantryAddFormProps {
  onSuccess: () => void;
}

export default function PantryAddForm({ onSuccess }: PantryAddFormProps) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState<string>("1");
  const [unit, setUnit] = useState<PantryUnit>("count");
  const [expirationDate, setExpirationDate] = useState<string>("");

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
        expirationDate: expirationDate ? expirationDate : undefined,
      }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setSubmitError(data?.error || `Failed to add item (${res.status})`);
      return;
    }

    // Close immediately.
    onSuccess();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <div className="grid gap-1">
        <label className="text-sm font-medium">Name</label>
        <input
          className="w-full rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--background))] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[rgb(var(--ring))]"
          placeholder="e.g., Chicken breast"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="grid gap-1">
          <label className="text-sm font-medium">Qty</label>
          <input
            className="w-full rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--background))] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[rgb(var(--ring))]"
            type="number"
            min="0"
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>

        <div className="grid gap-1">
          <label className="text-sm font-medium">Unit</label>
          <select
            className="w-full rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--background))] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[rgb(var(--ring))]"
            value={unit}
            onChange={(e) => setUnit(e.target.value as PantryUnit)}
          >
            {units.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-1">
          <label className="text-sm font-medium">Expiration</label>
          <input
            className="w-full rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--background))] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[rgb(var(--ring))]"
            type="date"
            value={expirationDate}
            onChange={(e) => setExpirationDate(e.target.value)}
          />
        </div>
      </div>

      {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}

      <button
        className="rounded-md bg-[rgb(var(--foreground))] text-[rgb(var(--background))] py-2 text-sm disabled:opacity-60"
        disabled={submitting}
        type="submit"
      >
        {submitting ? "Adding..." : "Add"}
      </button>
    </form>
  );
}
