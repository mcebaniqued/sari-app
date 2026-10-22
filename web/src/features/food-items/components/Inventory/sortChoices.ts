import type { FoodItemQuery } from "@sari/contracts";

export const SORT_CHOICES: {
  value: string;
  label: string;
  sort: FoodItemQuery["sort"];
}[] = [
  {
    value: "expiresOn-asc",
    label: "Expiration: Soonest",
    sort: [{ colId: "expiresOn", sort: "asc" }],
  },
  {
    value: "expiresOn-desc",
    label: "Expiration: Latest",
    sort: [{ colId: "expiresOn", sort: "desc" }],
  },
  {
    value: "createdAt-desc",
    label: "Added: Newest",
    sort: [{ colId: "createdAt", sort: "desc" }],
  },
  {
    value: "createdAt-asc",
    label: "Added: Oldest",
    sort: [{ colId: "createdAt", sort: "asc" }],
  },
  {
    value: "name-asc",
    label: "Name: A to Z",
    sort: [{ colId: "name", sort: "asc" }],
  },
  {
    value: "name-desc",
    label: "Name: Z to A",
    sort: [{ colId: "name", sort: "desc" }],
  },
  {
    value: "quantity-asc",
    label: "Quantity: Lowest",
    sort: [{ colId: "quantity", sort: "asc" }],
  },
  {
    value: "quantity-desc",
    label: "Quantity: Highest",
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
  const first = sort[0];
  return first ? `${first.colId}-${first.sort}` : "expiresOn-asc";
}
