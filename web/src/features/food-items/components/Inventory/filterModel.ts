import { type FoodItemQuery, foodUnitSchema } from "@sari/contracts";

export type InventoryFilters = FoodItemQuery["filters"];
export type LogicalFilterField = keyof InventoryFilters | "amount";

export const filterFields = [
  { id: "amount", label: "Amount" },
  { id: "expiresOn", label: "Expiration date" },
  { id: "createdAt", label: "Date added" },
] as const;

export const numericConditions = [
  { value: "equals", label: "Equals" },
  { value: "notEqual", label: "Not equal" },
  { value: "lessThan", label: "Less than" },
  { value: "lessThanOrEqual", label: "At most" },
  { value: "greaterThan", label: "Greater than" },
  { value: "greaterThanOrEqual", label: "At least" },
  { value: "inRange", label: "Between" },
];
export const dateConditions = [
  { value: "equals", label: "On" },
  { value: "notEqual", label: "Not on" },
  { value: "lessThan", label: "Before" },
  { value: "lessThanOrEqual", label: "On or before" },
  { value: "greaterThan", label: "After" },
  { value: "greaterThanOrEqual", label: "On or after" },
  { value: "inRange", label: "Between" },
];
export const expirationConditions = [
  ...dateConditions,
  { value: "notBlank", label: "Has date" },
  { value: "blank", label: "No date" },
];

function displayDate(value: string) {
  // API dates are calendar days; format in UTC so the label cannot shift a day.
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      }).format(date);
}

function describe(
  filter: NonNullable<InventoryFilters[keyof InventoryFilters]>,
) {
  const date = filter.filterType === "date";
  const value = date
    ? filter.dateFrom && displayDate(filter.dateFrom)
    : filter.filter;
  const to = date
    ? filter.dateTo && displayDate(filter.dateTo)
    : filter.filterType === "number"
      ? filter.filterTo
      : undefined;
  const shown = String(value ?? "");
  switch (filter.type) {
    case "equals":
      return shown;
    case "notEqual":
      return `≠ ${shown}`;
    case "contains":
      return `contains ${shown}`;
    case "notContains":
      return `excludes ${shown}`;
    case "startsWith":
      return `starts with ${shown}`;
    case "endsWith":
      return `ends with ${shown}`;
    case "lessThan":
      return `${date ? "before" : "<"} ${shown}`;
    case "lessThanOrEqual":
      return `${date ? "on or before" : "≤"} ${shown}`;
    case "greaterThan":
      return `${date ? "after" : ">"} ${shown}`;
    case "greaterThanOrEqual":
      return `${date ? "on or after" : "≥"} ${shown}`;
    case "inRange":
      return `${shown}–${String(to ?? "")}`;
    case "blank":
      return date ? "no date" : "is blank";
    case "notBlank":
      return date ? "has date" : "is not blank";
  }
}

interface AppliedFilter {
  field: LogicalFilterField;
  label: string;
  apiFields: (keyof InventoryFilters)[];
  editable: boolean;
  description: string;
}

/** Derive presentation from the API query; retain predicates the new UI cannot edit. */
export function appliedFilterEntries(
  filters: InventoryFilters,
): AppliedFilter[] {
  const entries: AppliedFilter[] = [];
  const quantity = filters.quantity;
  const unit = filters.unit;
  const amount =
    quantity &&
    numericConditions.some((condition) => condition.value === quantity.type) &&
    unit?.type === "equals" &&
    foodUnitSchema.safeParse(unit.filter).success;

  if (amount) {
    entries.push({
      field: "amount",
      label: "Amount",
      apiFields: ["quantity", "unit"],
      editable: true,
      description: `Amount: ${describe(quantity)} ${unit.filter === "item" ? "items" : String(unit.filter)}`,
    });
  }

  const labels = {
    name: "Food name",
    quantity: "Quantity",
    unit: "Unit",
    expiresOn: "Expiration date",
    createdAt: "Date added",
  };
  for (const field of Object.keys(labels) as (keyof InventoryFilters)[]) {
    const filter = filters[field];
    if (!filter || (amount && (field === "quantity" || field === "unit"))) {
      continue;
    }

    const label = labels[field];
    const chipLabel =
      field === "expiresOn"
        ? "Expires"
        : field === "createdAt"
          ? "Added"
          : label;
    entries.push({
      field,
      label,
      apiFields: [field],
      editable:
        field === "expiresOn" ||
        (field === "createdAt" &&
          dateConditions.some((condition) => condition.value === filter.type)),
      description: `${chipLabel}: ${describe(filter)}`,
    });
  }

  return entries;
}

export function removeLogicalFilter(
  filters: InventoryFilters,
  field: LogicalFilterField,
) {
  const removed = appliedFilterEntries(filters).find(
    (entry) => entry.field === field,
  );
  return Object.fromEntries(
    Object.entries(filters).filter(
      ([key]) => !removed?.apiFields.includes(key as keyof InventoryFilters),
    ),
  ) as InventoryFilters;
}
