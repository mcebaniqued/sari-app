import { foodUnitSchema } from "@sari/contracts";
import { LuChevronDown } from "react-icons/lu";

import Input from "@/components/Input/Input";

import type { FoodItemDraft } from "../../hooks/useFoodItemDraft";
import { foodUnitLabels } from "../../utils/foodUnits";

interface Props {
  values: FoodItemDraft;
  onChange: (field: keyof FoodItemDraft, value: string) => void;
}

export default function FoodItemFields({ values, onChange }: Props) {
  return (
    <>
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
          value={values.name}
          onChange={(event) => {
            onChange("name", event.target.value);
          }}
          placeholder="e.g. Eggs, rice, or milk"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="min-w-0">
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
            aria-describedby="quantity-hint"
            value={values.quantity}
            onChange={(event) => {
              onChange("quantity", event.target.value);
            }}
          />
        </div>
        <div className="min-w-0">
          <label htmlFor="food-unit" className="mb-2 block text-sm font-medium">
            Unit
          </label>
          <div className="relative">
            <select
              id="food-unit"
              name="unit"
              value={values.unit}
              onChange={(event) => {
                onChange("unit", event.target.value);
              }}
              className="min-h-[2.875rem] w-full min-w-0 appearance-none rounded-control border border-border-control bg-surface py-2.5 pr-10 pl-3 text-base text-content focus:border-brand focus:outline-2 focus:outline-offset-1 focus:outline-brand disabled:opacity-50"
            >
              {foodUnitSchema.options.map((unit) => (
                <option key={unit} value={unit}>
                  {foodUnitLabels[unit]}
                </option>
              ))}
            </select>
            <LuChevronDown
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-content-muted"
            />
          </div>
        </div>
        <p
          id="quantity-hint"
          className="col-span-2 -mt-2 text-xs text-content-muted"
        >
          Enter the amount you have.
        </p>
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
          value={values.expiresOn}
          onChange={(event) => {
            onChange("expiresOn", event.target.value);
          }}
        />
        <p
          id="expiration-hint"
          className="mt-2 text-xs leading-relaxed text-content-muted"
        >
          Leave blank if unknown.
        </p>
      </div>
    </>
  );
}
