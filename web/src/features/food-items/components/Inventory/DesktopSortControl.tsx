import type { FoodItemQuery } from "@sari/contracts";
import { useEffect, useId, useRef, useState } from "react";
import { LuArrowDownUp, LuChevronDown } from "react-icons/lu";
import { SORT_CHOICES, sortChoiceValue } from "./sortChoices";

interface DesktopSortControlProps {
  sort: FoodItemQuery["sort"];
  disabled: boolean;
  onSort: (sort: FoodItemQuery["sort"]) => void;
}

export default function DesktopSortControl({
  sort,
  disabled,
  onSort,
}: DesktopSortControlProps) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const selectedOption = useRef<HTMLInputElement>(null);
  const panelId = useId();
  const activeValue = sortChoiceValue(sort);
  const activeChoice = SORT_CHOICES.find(
    (choice) => choice.value === activeValue,
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    selectedOption.current?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !container.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={container} className="relative shrink-0">
      <button
        ref={trigger}
        type="button"
        disabled={disabled}
        aria-label={`Sort: ${activeChoice?.shortLabel ?? "Added: Newest"}`}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => {
          setOpen((value) => !value);
        }}
        className="inline-flex min-h-11 items-center gap-2 rounded-control border border-border-default bg-surface px-3 text-sm font-medium hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50"
      >
        <LuArrowDownUp aria-hidden="true" />
        Sort
        <LuChevronDown aria-hidden="true" />
      </button>
      {open && (
        <fieldset
          id={panelId}
          className="absolute top-full right-0 z-30 mt-2 max-h-[min(28rem,70dvh)] w-72 overflow-y-auto rounded-panel border border-border-default bg-surface p-2 shadow-modal"
        >
          <legend className="sr-only">Sort pantry items</legend>
          {SORT_CHOICES.map((choice) => (
            <label
              key={choice.value}
              className="flex min-h-11 items-center gap-3 rounded-control px-3 text-sm hover:bg-surface-hover"
            >
              <input
                ref={choice.value === activeValue ? selectedOption : undefined}
                type="radio"
                name="desktop-pantry-sort"
                value={choice.value}
                checked={choice.value === activeValue}
                onChange={() => {
                  onSort(choice.sort);
                  setOpen(false);
                  trigger.current?.focus();
                }}
                className="size-6 accent-brand"
              />
              {choice.label}
            </label>
          ))}
        </fieldset>
      )}
    </div>
  );
}
