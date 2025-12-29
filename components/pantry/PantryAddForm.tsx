"use client";

import { PANTRY_UNITS, type PantryUnit } from "@/lib/domain/pantry";
import { useId, useState } from "react";

const units: PantryUnit[] = [...PANTRY_UNITS];

interface PantryAddFormProps {
  onSuccess: () => void;
}

const inputClass =
  "w-full rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--background))] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[rgb(var(--ring))]";

function Label({
  htmlFor,
  children,
  required,
}: {
  htmlFor: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium">
      {children}
      {required ? <span className="ml-0.5 text-red-600">*</span> : null}
    </label>
  );
}

export default function PantryAddForm({ onSuccess }: PantryAddFormProps) {
  const nameId = useId();
  const qtyId = useId();
  const unitId = useId();
  const expId = useId();

  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState<PantryUnit>("count");
  const [expirationDate, setExpirationDate] = useState("");

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const trimmedName = name.trim();
    const q = Number(quantity);

    if (!trimmedName) return setSubmitError("Name is required.");
    if (!Number.isFinite(q) || q <= 0) return setSubmitError("Quantity must be > 0.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/pantry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          quantity: q,
          unit,
          expirationDate: expirationDate || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSubmitError(data?.error || `Failed to add item (${res.status})`);
        return;
      }

      // Close modal on success
      onSuccess();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <div className="grid gap-1">
        <Label htmlFor={nameId} required>
          Name
        </Label>
        <input
          id={nameId}
          className={inputClass}
          placeholder="e.g., Chicken breast"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          aria-required="true"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="grid gap-1">
          <Label htmlFor={qtyId} required>
            Quantity
          </Label>
          <input
            id={qtyId}
            className={inputClass}
            type="number"
            min="0"
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            aria-required="true"
          />
        </div>

        <div className="grid gap-1">
          <Label htmlFor={unitId}>Unit</Label>
          <select
            id={unitId}
            className={inputClass}
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
          <Label htmlFor={expId}>Expiration</Label>
          <input
            id={expId}
            className={inputClass}
            type="date"
            value={expirationDate}
            onChange={(e) => setExpirationDate(e.target.value)}
          />
        </div>
      </div>

      {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}

      <button
        className="rounded-md bg-[rgb(var(--foreground))] py-2 text-sm text-[rgb(var(--background))] disabled:opacity-60"
        disabled={submitting}
        type="submit"
      >
        {submitting ? "Adding..." : "Add"}
      </button>
    </form>
  );
}
