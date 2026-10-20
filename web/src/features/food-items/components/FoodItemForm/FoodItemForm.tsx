import type { CreateFoodItem, FoodItem } from "@sari/contracts";
import { useEffect, useRef, useState } from "react";
import { LuCheck, LuPlus } from "react-icons/lu";

import { useBarcodeProduct } from "../../hooks/useBarcodeProduct";
import { useFoodItemDraft } from "../../hooks/useFoodItemDraft";
import { useFoodItemForm } from "../../hooks/useFoodItemForm";
import BarcodeEntry from "../BarcodeEntry/BarcodeEntry";
import ProductReview from "../BarcodeEntry/ProductReview";
import FoodItemFields from "./FoodItemFields";

interface FoodItemFormProps {
  item: FoodItem | null;
  disabled: boolean;
  onSave: (values: CreateFoodItem) => Promise<void>;
  onCancel: () => void;
}

export default function FoodItemForm({
  item,
  disabled,
  onSave,
  onCancel,
}: FoodItemFormProps) {
  const [mode, setMode] = useState<"manual" | "barcode">("manual");
  const [barcodeValue, setBarcodeValue] = useState("");
  const entryRef = useRef<HTMLDivElement>(null);
  const draft = useFoodItemDraft(item);
  const barcode = useBarcodeProduct(item, draft);
  const linked =
    barcode.productId !== null ||
    barcode.barcode !== null ||
    Boolean(item?.productId ?? item?.barcode);
  const { saving, error, handleSubmit } = useFoodItemForm({
    disabled,
    onSave,
    values: draft.values,
    ...(linked
      ? { linkage: { productId: barcode.productId, barcode: barcode.barcode } }
      : {}),
  });

  useEffect(() => {
    entryRef.current
      ?.querySelector<HTMLInputElement>("[data-autofocus]")
      ?.focus();
  }, [mode]);

  function switchMode(next: "manual" | "barcode") {
    barcode.cancelLookup();
    setMode(next);
  }

  return (
    <div ref={entryRef} aria-busy={saving}>
      {!item && (
        <div
          role="group"
          aria-label="Item entry method"
          className="mx-6 mt-5 grid grid-cols-2 gap-1 rounded-control bg-surface-subtle p-1"
        >
          {(["manual", "barcode"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              disabled={disabled || saving}
              onClick={() => {
                switchMode(value);
              }}
              className={`min-h-11 rounded-control px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50 ${mode === value ? "bg-brand text-content-inverse" : "text-content hover:bg-surface-hover"}`}
            >
              {value === "manual" ? "Manual entry" : "Barcode"}
            </button>
          ))}
        </div>
      )}
      {mode === "barcode" ? (
        <BarcodeEntry
          disabled={disabled}
          loading={barcode.loading}
          value={barcodeValue}
          message={barcode.productId ? "" : barcode.message}
          onLookup={(value) => {
            void barcode.lookup(value).then((found) => {
              if (found) {
                setMode("manual");
              }
            });
          }}
          onChange={(value) => {
            setBarcodeValue(value);
            barcode.resetSearch();
          }}
          onCamera={barcode.cancelLookup}
          onManual={() => {
            switchMode("manual");
          }}
          onCancel={onCancel}
        />
      ) : (
        <form
          onSubmit={(event) => {
            barcode.cancelLookup();
            void handleSubmit(event);
          }}
        >
          <fieldset
            disabled={disabled || saving}
            className="space-y-5 px-6 py-6"
          >
            <ProductReview
              product={barcode.product}
              productId={barcode.productId}
              barcode={barcode.barcode}
              message={barcode.productId ? barcode.message : ""}
              replacing={Boolean(barcode.replace)}
              onReplace={barcode.replaceValues}
              onKeep={barcode.keepValues}
              onUnlink={barcode.unlink}
            />
            <FoodItemFields values={draft.values} onChange={draft.edit} />
            {error && (
              <p
                role="alert"
                className="rounded-lg bg-danger-subtle p-3 text-sm text-danger"
              >
                {error} Your entries have been kept.
              </p>
            )}
          </fieldset>
          <div className="flex items-center justify-end gap-3 border-t border-border-default bg-surface-subtle/60 px-6 py-4">
            <button
              type="button"
              disabled={disabled || saving}
              onClick={onCancel}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-border-default bg-surface px-3 py-2 text-sm font-medium text-content hover:bg-surface-hover disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={disabled || saving}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-brand px-4 py-2.5 text-sm font-semibold text-content-inverse hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {item ? (
                <LuCheck aria-hidden="true" />
              ) : (
                <LuPlus aria-hidden="true" />
              )}
              {saving ? "Saving…" : item ? "Save changes" : "Add item"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
