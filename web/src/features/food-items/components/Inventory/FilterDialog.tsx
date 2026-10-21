import { type FoodItemQuery, foodItemQuerySchema } from "@sari/contracts";
import { useState } from "react";
import Modal from "@/components/Modal/Modal";
import { SORT_CHOICES, sortChoiceValue } from "./sortChoices";

type Filters = FoodItemQuery["filters"];
type Field = keyof Filters;
interface Draft {
  operator: string;
  value: string;
  to: string;
}

const fields: { id: Field; label: string; kind: "text" | "number" | "date" }[] =
  [
    { id: "name", label: "Food name", kind: "text" },
    { id: "quantity", label: "Quantity", kind: "number" },
    { id: "unit", label: "Unit", kind: "text" },
    { id: "expiresOn", label: "Expiration date", kind: "date" },
    { id: "createdAt", label: "Date added", kind: "date" },
  ];
const textOperators = [
  "contains",
  "notContains",
  "equals",
  "notEqual",
  "startsWith",
  "endsWith",
  "blank",
  "notBlank",
];
const comparisonOperators = [
  "equals",
  "notEqual",
  "lessThan",
  "lessThanOrEqual",
  "greaterThan",
  "greaterThanOrEqual",
  "inRange",
  "blank",
  "notBlank",
];
const operatorLabels: Record<string, string> = {
  contains: "Contains",
  notContains: "Does not contain",
  equals: "Equals",
  notEqual: "Does not equal",
  startsWith: "Starts with",
  endsWith: "Ends with",
  lessThan: "Less than",
  lessThanOrEqual: "Less than or equal",
  greaterThan: "Greater than",
  greaterThanOrEqual: "Greater than or equal",
  inRange: "In range",
  blank: "Is blank",
  notBlank: "Is not blank",
};

function initialDraft(filters: Filters): Partial<Record<Field, Draft>> {
  const draft: Partial<Record<Field, Draft>> = {};
  for (const field of fields) {
    const filter = filters[field.id];
    if (filter) {
      draft[field.id] = {
        operator: filter.type,
        value:
          filter.filterType === "date"
            ? (filter.dateFrom ?? "")
            : `${filter.filter ?? ""}`,
        to:
          filter.filterType === "date"
            ? (filter.dateTo ?? "")
            : filter.filterType === "number"
              ? `${filter.filterTo ?? ""}`
              : "",
      };
    }
  }

  return draft;
}

interface FilterDialogProps {
  filters: Filters;
  sort: FoodItemQuery["sort"];
  mobile: boolean;
  onApply: (filters: Filters, sort: FoodItemQuery["sort"]) => void;
  onClose: () => void;
}

export default function FilterDialog({
  filters,
  sort,
  mobile,
  onApply,
  onClose,
}: FilterDialogProps) {
  const [draft, setDraft] = useState(() => initialDraft(filters));
  const [draftSort, setDraftSort] = useState(sortChoiceValue(sort));
  const [error, setError] = useState("");

  function apply() {
    const raw: Record<string, unknown> = {};
    for (const field of fields) {
      const entry = draft[field.id];
      if (!entry) {
        continue;
      }

      const blank = entry.operator === "blank" || entry.operator === "notBlank";
      raw[field.id] =
        field.kind === "date"
          ? {
              filterType: "date",
              type: entry.operator,
              ...(blank
                ? {}
                : {
                    dateFrom: entry.value,
                    ...(entry.operator === "inRange"
                      ? { dateTo: entry.to }
                      : {}),
                  }),
            }
          : field.kind === "number"
            ? {
                filterType: "number",
                type: entry.operator,
                ...(blank
                  ? {}
                  : {
                      filter: entry.value === "" ? null : Number(entry.value),
                      ...(entry.operator === "inRange"
                        ? {
                            filterTo: entry.to === "" ? null : Number(entry.to),
                          }
                        : {}),
                    }),
              }
            : {
                filterType: "text",
                type: entry.operator,
                ...(blank ? {} : { filter: entry.value }),
              };
    }
    const parsed = foodItemQuerySchema.safeParse({ filters: raw });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the filter values.");
      return;
    }

    const nextSort = mobile
      ? (SORT_CHOICES.find((choice) => choice.value === draftSort)?.sort ?? [])
      : sort;
    onApply(parsed.data.filters, nextSort);
  }

  function update(field: Field, change: Partial<Draft>) {
    setDraft((current) => ({
      ...current,
      [field]: { ...current[field], ...change } as Draft,
    }));
    setError("");
  }

  return (
    <Modal
      title={mobile ? "Filter and sort" : "Filter items"}
      onClose={onClose}
    >
      <div className="max-h-[60dvh] space-y-5 overflow-y-auto px-6 py-5">
        {mobile && (
          <label className="block text-sm font-medium">
            Sort by
            <select
              value={draftSort}
              onChange={(event) => {
                setDraftSort(event.target.value);
              }}
              className="mt-1 min-h-11 w-full rounded-control border border-border-control bg-surface px-3"
            >
              {SORT_CHOICES.map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block text-sm font-medium">
          Add filter
          <select
            value=""
            onChange={(event) => {
              const field = fields.find(
                (candidate) => candidate.id === event.target.value,
              );
              if (field) {
                update(field.id, {
                  operator: field.kind === "text" ? "contains" : "equals",
                  value: "",
                  to: "",
                });
              }
            }}
            className="mt-1 min-h-11 w-full rounded-control border border-border-control bg-surface px-3"
          >
            <option value="">Choose a field</option>
            {fields
              .filter((field) => !draft[field.id])
              .map((field) => (
                <option key={field.id} value={field.id}>
                  {field.label}
                </option>
              ))}
          </select>
        </label>
        {fields
          .filter((field) => draft[field.id])
          .map((field) => {
            const entry = draft[field.id];
            if (!entry) {
              return null;
            }
            const needsValue =
              entry.operator !== "blank" && entry.operator !== "notBlank";
            return (
              <fieldset
                key={field.id}
                className="space-y-2 rounded-control border border-border-default p-3"
              >
                <legend className="px-1 text-sm font-semibold">
                  {field.label}
                </legend>
                <label className="block text-sm">
                  Condition
                  <select
                    value={entry.operator}
                    onChange={(event) => {
                      update(field.id, { operator: event.target.value });
                    }}
                    className="mt-1 min-h-11 w-full rounded-control border border-border-control bg-surface px-3"
                  >
                    {(field.kind === "text"
                      ? textOperators
                      : comparisonOperators
                    ).map((operator) => (
                      <option key={operator} value={operator}>
                        {operatorLabels[operator]}
                      </option>
                    ))}
                  </select>
                </label>
                {needsValue && (
                  <label className="block text-sm">
                    Value
                    <input
                      type={
                        field.kind === "date"
                          ? "date"
                          : field.kind === "number"
                            ? "number"
                            : "text"
                      }
                      value={entry.value}
                      onChange={(event) => {
                        update(field.id, { value: event.target.value });
                      }}
                      className="mt-1 min-h-11 w-full rounded-control border border-border-control bg-surface px-3"
                    />
                  </label>
                )}
                {needsValue && entry.operator === "inRange" && (
                  <label className="block text-sm">
                    Through
                    <input
                      type={field.kind === "date" ? "date" : "number"}
                      value={entry.to}
                      onChange={(event) => {
                        update(field.id, { to: event.target.value });
                      }}
                      className="mt-1 min-h-11 w-full rounded-control border border-border-control bg-surface px-3"
                    />
                  </label>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setDraft((current) => ({
                      ...current,
                      [field.id]: undefined,
                    }));
                  }}
                  className="min-h-11 text-sm text-danger underline"
                >
                  Remove {field.label} filter
                </button>
              </fieldset>
            );
          })}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
      <div className="flex justify-end gap-3 border-t border-border-default px-6 py-4">
        <button
          type="button"
          onClick={() => {
            setDraft({});
            if (mobile) {
              setDraftSort("default");
            }
            setError("");
          }}
          className="min-h-11 rounded-control px-3 text-sm underline"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 rounded-control border border-border-default px-3 text-sm"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={apply}
          className="min-h-11 rounded-control bg-brand px-4 text-sm font-semibold text-content-inverse"
        >
          Apply
        </button>
      </div>
    </Modal>
  );
}
