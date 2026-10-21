import type { FoodItemQuery } from "@sari/contracts";
import { useEffect, useId, useRef, useState } from "react";
import { LuArrowDownUp, LuCheck, LuChevronDown } from "react-icons/lu";
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
  const choices = useRef<(HTMLButtonElement | null)[]>([]);
  const panelId = useId();
  const activeValue = sortChoiceValue(sort);
  const activeIndex = SORT_CHOICES.findIndex(
    (choice) => choice.value === activeValue,
  );
  const activeChoice = SORT_CHOICES[activeIndex];

  useEffect(() => {
    if (!open) {
      return;
    }

    choices.current[Math.max(activeIndex, 0)]?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !container.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [activeIndex, open]);

  function select(index: number) {
    const choice = SORT_CHOICES[index];
    if (choice && choice.value !== activeValue) {
      onSort(choice.sort);
    }
    setOpen(false);
    trigger.current?.focus();
  }

  return (
    <div ref={container} className="relative shrink-0">
      <button
        ref={trigger}
        type="button"
        disabled={disabled}
        aria-label={`Sort: ${activeChoice?.shortLabel ?? "Added: Newest"}`}
        aria-haspopup="menu"
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
        <div
          id={panelId}
          role="menu"
          aria-label="Sort pantry items"
          tabIndex={-1}
          className="absolute top-full right-0 z-30 mt-2 max-h-[min(28rem,70dvh)] w-72 overflow-y-auto rounded-panel border border-border-default bg-surface p-2 shadow-modal"
          onBlur={(event) => {
            if (
              !event.currentTarget.contains(event.relatedTarget) &&
              event.relatedTarget !== trigger.current
            ) {
              setOpen(false);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Tab") {
              setOpen(false);
              return;
            }
            if (event.key === "Escape") {
              event.preventDefault();
              setOpen(false);
              trigger.current?.focus();
              return;
            }

            const index = choices.current.indexOf(
              event.target as HTMLButtonElement,
            );
            const last = SORT_CHOICES.length - 1;
            let next: number;
            switch (event.key) {
              case "ArrowDown":
                next = (index + 1) % SORT_CHOICES.length;
                break;
              case "ArrowUp":
                next = (index - 1 + SORT_CHOICES.length) % SORT_CHOICES.length;
                break;
              case "Home":
                next = 0;
                break;
              case "End":
                next = last;
                break;
              default:
                return;
            }
            event.preventDefault();
            choices.current[next]?.focus();
          }}
        >
          {SORT_CHOICES.map((choice, index) => (
            <button
              key={choice.value}
              ref={(element) => {
                choices.current[index] = element;
              }}
              type="button"
              role="menuitemradio"
              aria-checked={choice.value === activeValue}
              tabIndex={-1}
              onClick={() => {
                select(index);
              }}
              className="flex min-h-11 w-full items-center gap-3 rounded-control px-3 text-left text-sm hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-brand"
            >
              {choice.value === activeValue ? (
                <LuCheck aria-hidden="true" className="size-5 shrink-0" />
              ) : (
                <span aria-hidden="true" className="size-5 shrink-0" />
              )}
              {choice.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
