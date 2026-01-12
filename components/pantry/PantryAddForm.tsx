"use client";

import {
  COUNT_UNITS,
  DATE_LABEL_TYPES,
  DATE_LABEL_TYPE_LABELS,
  VOLUME_UNITS,
  WEIGHT_UNITS,
  type DateLabelType,
  type PantryUnit,
} from "@/lib/domain/pantry";
import { useId, useState } from "react";

interface PantryAddFormProps {
  onSuccess: (item: {
    name: string;
    quantity: number;
    unit: PantryUnit;
    dateLabelType: DateLabelType;
    dateOnPackage?: string;
  }) => void;
}

const inputClass =
  "h-10 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--background))] px-3 text-sm text-[rgb(var(--foreground))] placeholder:text-[rgb(var(--muted-foreground))] outline-none focus:ring-2 focus:ring-[rgb(var(--ring))] disabled:cursor-not-allowed disabled:opacity-60";

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
  const dateLabelId = useId();
  const dateOnPkgId = useId();
  const purchaseDateId = useId();

  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState<PantryUnit>("count");

  const [dateLabelType, setDateLabelType] = useState<DateLabelType>("not_sure");
  const [dateOnPackage, setDateOnPackage] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");

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
          dateLabelType,
          dateOnPackage: dateOnPackage || undefined,
          purchaseDate: purchaseDate || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSubmitError(data?.error || `Failed to add item (${res.status})`);
        return;
      }

      // Close modal on success
      onSuccess({ name: trimmedName, quantity: q, unit, dateLabelType, dateOnPackage });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      {/* Name */}
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

      {/* Quantity + Unit */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          <Label htmlFor={unitId} required>Unit</Label>
          <select
            id={unitId}
            className={inputClass}
            value={unit}
            onChange={(e) => setUnit(e.target.value as PantryUnit)}
          >
            {/* Count group */}
            <optgroup label="Count">
              {COUNT_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </optgroup>
            {/* Weight group */}
            <optgroup label="Weight">
              {WEIGHT_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </optgroup>
            {/* Volume group */}
            <optgroup label="Volume">
              {VOLUME_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
      </div>

      {/* Optional details */}
      <div className="mt-4 grid gap-2">
        <p className="text-xs font-medium text-[rgb(var(--muted-foreground))]">
          Optional details
        </p>

        {/* Package date */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="grid gap-1">
            <Label htmlFor={dateLabelId}>Label type</Label>
            <select
              id={dateLabelId}
              className={inputClass}
              value={dateLabelType}
              onChange={(e) => setDateLabelType(e.target.value as DateLabelType)}
            >
              {DATE_LABEL_TYPES.map((v) => (
                <option key={v} value={v}>
                  {DATE_LABEL_TYPE_LABELS[v]}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1">
            <Label htmlFor={dateOnPkgId}>Date on package</Label>
            <input
              id={dateOnPkgId}
              className={inputClass}
              type="date"
              value={dateOnPackage}
              onChange={(e) => setDateOnPackage(e.target.value)}
            />
          </div>
        </div>

        {/* Purchase date */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="grid gap-1">
            <Label htmlFor={purchaseDateId}>Purchase date</Label>
            <input
              id={purchaseDateId}
              className={inputClass}
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}

      <div className="mt-2 border-t border-[rgb(var(--border))] pt-4">
        <button
          className="h-10 w-full rounded-lg bg-[rgb(var(--foreground))] text-sm font-medium text-[rgb(var(--background))] shadow-sm disabled:opacity-60"
          disabled={submitting}
          type="submit"
        >
          {submitting ? "Adding..." : "Add"}
        </button>
      </div>
    </form>
  );
}
