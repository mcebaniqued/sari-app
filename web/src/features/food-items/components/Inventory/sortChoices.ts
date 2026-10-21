import type { FoodItemQuery } from "@sari/contracts";

export const SORT_CHOICES: {
  value: string;
  label: string;
  sort: FoodItemQuery["sort"];
}[] = [
  { value: "default", label: "Date added: newest first (default)", sort: [] },
  {
    value: "expiresOn-asc",
    label: "Expiration date: soonest first",
    sort: [{ colId: "expiresOn", sort: "asc" }],
  },
  {
    value: "expiresOn-desc",
    label: "Expiration date: latest first",
    sort: [{ colId: "expiresOn", sort: "desc" }],
  },
  {
    value: "createdAt-desc",
    label: "Date added: newest first",
    sort: [{ colId: "createdAt", sort: "desc" }],
  },
  {
    value: "createdAt-asc",
    label: "Date added: oldest first",
    sort: [{ colId: "createdAt", sort: "asc" }],
  },
  {
    value: "name-asc",
    label: "Food name: A to Z",
    sort: [{ colId: "name", sort: "asc" }],
  },
  {
    value: "name-desc",
    label: "Food name: Z to A",
    sort: [{ colId: "name", sort: "desc" }],
  },
  {
    value: "quantity-asc",
    label: "Quantity: low to high",
    sort: [{ colId: "quantity", sort: "asc" }],
  },
  {
    value: "quantity-desc",
    label: "Quantity: high to low",
    sort: [{ colId: "quantity", sort: "desc" }],
  },
  {
    value: "unit-asc",
    label: "Unit: A to Z",
    sort: [{ colId: "unit", sort: "asc" }],
  },
  {
    value: "unit-desc",
    label: "Unit: Z to A",
    sort: [{ colId: "unit", sort: "desc" }],
  },
];

export function sortChoiceValue(sort: FoodItemQuery["sort"]) {
  return sort[0] ? `${sort[0].colId}-${sort[0].sort}` : "default";
}
