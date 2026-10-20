import {
  type CreateFoodItem,
  type FoodItem,
  foodUnitSchema,
} from "@sari/contracts";
import { useRef } from "react";
import { LuCheck, LuPlus } from "react-icons/lu";

import Input from "@/components/Input/Input";

import { useBarcodeProduct } from "../../hooks/useBarcodeProduct";
import { useFoodItemForm } from "../../hooks/useFoodItemForm";
import { foodUnitLabels } from "../../utils/foodUnits";
import BarcodeEntry from "../BarcodeEntry/BarcodeEntry";
import ProductReview from "../BarcodeEntry/ProductReview";

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
  const formRef = useRef<HTMLFormElement>(null);
  const barcode = useBarcodeProduct(item, formRef);
  const linked =
    barcode.productId !== null ||
    barcode.barcode !== null ||
    Boolean(item?.productId ?? item?.barcode);
  const { saving, error, handleSubmit } = useFoodItemForm({
    disabled,
    onSave,
    ...(linked
      ? { linkage: { productId: barcode.productId, barcode: barcode.barcode } }
      : {}),
  });
  return (
    <form
      ref={formRef}
      onChange={barcode.onFormChange}
      onSubmit={(event) => {
        barcode.cancelLookup();
        void handleSubmit(event);
      }}
      aria-busy={saving}
    >
      <fieldset disabled={disabled || saving} className="space-y-5 px-6 py-6">
        <div>
          <label htmlFor="food-name" className="mb-2 block text-sm font-medium">
            Food name <span className="text-brand">*</span>
          </label>
          <Input
            data-autofocus
            id="food-name"
            name="name"
            required
            maxLength={120}
            defaultValue={item?.name ?? ""}
            placeholder="e.g. Eggs, rice, or milk"
          />
        </div>
        {!item &&
          !saving &&
          !disabled &&
          (barcode.open ? (
            <BarcodeEntry
              loading={barcode.loading}
              onLookup={(value) => {
                void barcode.lookup(value);
              }}
              onChange={barcode.resetSearch}
              onCamera={barcode.cancelLookup}
              onClose={() => {
                barcode.cancelLookup();
                barcode.setOpen(false);
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                barcode.setOpen(true);
              }}
              className="text-sm font-medium text-brand underline"
            >
              Scan or enter barcode
            </button>
          ))}
        <ProductReview
          product={barcode.product}
          productId={barcode.productId}
          barcode={barcode.barcode}
          message={barcode.message}
          replacing={Boolean(barcode.replace)}
          onReplace={barcode.replaceValues}
          onKeep={barcode.keepValues}
          onUnlink={barcode.unlink}
        />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="food-quantity"
              className="mb-2 block text-sm font-medium"
            >
              Quantity <span className="text-brand">*</span>
            </label>
            <Input
              id="food-quantity"
              name="quantity"
              type="number"
              required
              min="0"
              max="1000000"
              step="any"
              defaultValue={item?.quantity ?? 1}
            />
          </div>
          <div>
            <label
              htmlFor="food-unit"
              className="mb-2 block text-sm font-medium"
            >
              Unit
            </label>
            <select
              id="food-unit"
              name="unit"
              defaultValue={item?.unit ?? "item"}
              className="w-full rounded-control border border-border-control bg-surface px-3 py-2.5 text-sm text-content focus:outline-2 focus:outline-offset-1 focus:outline-brand disabled:opacity-50"
            >
              {foodUnitSchema.options.map((unit) => (
                <option key={unit} value={unit}>
                  {foodUnitLabels[unit]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label
            htmlFor="food-expiration"
            className="mb-2 block text-sm font-medium"
          >
            Expiration date{" "}
            <span className="font-normal text-content-muted">(optional)</span>
          </label>
          <Input
            id="food-expiration"
            name="expiresOn"
            type="date"
            min="0001-01-01"
            max="9999-12-31"
            aria-describedby="expiration-hint"
            defaultValue={item?.expiresOn ?? ""}
          />
          <p
            id="expiration-hint"
            className="mt-2 text-xs leading-relaxed text-content-muted"
          >
            Leave blank if unknown.
          </p>
        </div>
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
          className="inline-flex items-center justify-center gap-2 rounded-control border border-border-default bg-surface px-3 py-2 text-sm font-medium text-content hover:bg-surface-hover disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={disabled || saving}
          className="inline-flex items-center justify-center gap-2 rounded-control bg-brand px-4 py-2.5 text-sm font-semibold text-content-inverse hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
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
  );
}
