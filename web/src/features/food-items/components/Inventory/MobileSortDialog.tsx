import type { FoodItemQuery } from "@sari/contracts";
import { useState } from "react";
import Modal from "@/components/Modal/Modal";
import { SORT_CHOICES, sortChoiceValue } from "./sortChoices";

interface MobileSortDialogProps {
  sort: FoodItemQuery["sort"];
  onApply: (sort: FoodItemQuery["sort"]) => void;
  onClose: () => void;
}

export default function MobileSortDialog({
  sort,
  onApply,
  onClose,
}: MobileSortDialogProps) {
  const [draft, setDraft] = useState(sortChoiceValue(sort));

  return (
    <Modal title="Sort items" onClose={onClose}>
      <fieldset className="max-h-[calc(100dvh-13rem)] space-y-1 overflow-y-auto px-6 py-4">
        <legend className="sr-only">Sort pantry items</legend>
        {SORT_CHOICES.map((choice) => (
          <label
            key={choice.value}
            className="flex min-h-12 items-center gap-3 rounded-control px-2 text-sm hover:bg-surface-hover"
          >
            <input
              type="radio"
              name="mobile-pantry-sort"
              value={choice.value}
              checked={draft === choice.value}
              onChange={() => {
                setDraft(choice.value);
              }}
              className="size-4 accent-brand"
            />
            {choice.label}
          </label>
        ))}
      </fieldset>
      <div className="flex justify-end gap-3 border-t border-border-default bg-surface px-6 py-4">
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 rounded-control border border-border-default px-4 text-sm focus-visible:outline-2 focus-visible:outline-brand"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            onApply(
              SORT_CHOICES.find((choice) => choice.value === draft)?.sort ?? [],
            );
          }}
          className="min-h-11 rounded-control bg-brand px-4 text-sm font-semibold text-content-inverse focus-visible:outline-2 focus-visible:outline-brand"
        >
          Apply
        </button>
      </div>
    </Modal>
  );
}
