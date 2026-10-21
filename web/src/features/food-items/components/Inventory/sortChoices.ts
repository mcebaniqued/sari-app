import type { FoodItemQuery } from "@sari/contracts";

export const SORT_CHOICES: {
  value: string;
  label: string;
  shortLabel: string;
  sort: FoodItemQuery["sort"];
}[] = [
  {
    value: "default",
    label: "Added: Newest",
    shortLabel: "Added: Newest",
    sort: [],
  },
  {
    value: "createdAt-asc",
    label: "Added: Oldest",
    shortLabel: "Added: Oldest",
    sort: [{ colId: "createdAt", sort: "asc" }],
  },
  {
    value: "expiresOn-asc",
    label: "Expiration: Soonest",
    shortLabel: "Expiration: Soonest",
    sort: [{ colId: "expiresOn", sort: "asc" }],
  },
  {
    value: "expiresOn-desc",
    label: "Expiration: Latest",
    shortLabel: "Expiration: Latest",
    sort: [{ colId: "expiresOn", sort: "desc" }],
  },
  {
    value: "name-asc",
    label: "Name: A to Z",
    shortLabel: "Name: A to Z",
    sort: [{ colId: "name", sort: "asc" }],
  },
  {
    value: "name-desc",
    label: "Name: Z to A",
    shortLabel: "Name: Z to A",
    sort: [{ colId: "name", sort: "desc" }],
  },
  {
    value: "quantity-asc",
    label: "Quantity: Lowest",
    shortLabel: "Quantity: Lowest",
    sort: [{ colId: "quantity", sort: "asc" }],
  },
  {
    value: "quantity-desc",
    label: "Quantity: Highest",
    shortLabel: "Quantity: Highest",
    sort: [{ colId: "quantity", sort: "desc" }],
  },
  {
    value: "unit-asc",
    label: "Unit: A to Z",
    shortLabel: "Unit: A to Z",
    sort: [{ colId: "unit", sort: "asc" }],
  },
  {
    value: "unit-desc",
    label: "Unit: Z to A",
    shortLabel: "Unit: Z to A",
    sort: [{ colId: "unit", sort: "desc" }],
  },
];

export function sortChoiceValue(sort: FoodItemQuery["sort"]) {
  const first = sort[0];
  if (
    sort.length === 1 &&
    first?.colId === "createdAt" &&
    first.sort === "desc"
  ) {
    return "default";
  }
  return first ? `${first.colId}-${first.sort}` : "default";
}
