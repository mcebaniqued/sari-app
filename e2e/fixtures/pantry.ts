import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test as base } from "@playwright/test";
import {
  createFoodItemSchema,
  type FoodItem,
  type FoodItemQuery,
  foodItemQuerySchema,
  type FoodProduct,
} from "@sari/contracts";
import type { AxeResults } from "axe-core";
import { signedIn } from "../authFixture";

export const test = base.extend({
  page: async ({ page }, use) => {
    await signedIn(page);
    await use(page);
  },
});

export const milk: FoodItem = {
  id: "012345678901234567890123",
  name: "Milk",
  quantity: 2,
  unit: "l",
  expiresOn: "2028-02-29",
  revision: 0,
  createdAt: "2026-10-19T00:00:00Z",
  updatedAt: "2026-10-19T00:00:00Z",
};

export const rice: FoodItem = {
  ...milk,
  id: "112345678901234567890123",
  name: "Rice",
  quantity: 1,
  unit: "kg",
  expiresOn: null,
};

export const bananas: FoodItem = {
  ...milk,
  id: "212345678901234567890123",
  name: "Bananas",
  quantity: 12,
  unit: "item",
  expiresOn: null,
};

export const usdaOats: FoodProduct = {
  id: "412345678901234567890123",
  barcode: "00012345678905",
  name: "USDA oats",
  brand: "Oat brand",
  packageDescription: "500 g",
  packageQuantity: 500,
  packageUnit: "g",
  provider: "usda",
  externalId: "12345",
  marketCountry: "United States",
  sourceUrl: "https://fdc.nal.usda.gov/food-details/12345/nutrients",
  sourceModifiedAt: null,
  sourcePublishedAt: "2026-01-01",
  checkedAt: "2026-10-20T00:00:00Z",
};

function matchesFilter(
  value: string | number | null,
  filter: NonNullable<FoodItemQuery["filters"][keyof FoodItemQuery["filters"]]>,
) {
  if (filter.type === "blank") {
    return value === null || value === "";
  }
  if (filter.type === "notBlank") {
    return value !== null && value !== "";
  }
  if (filter.filterType === "text") {
    const text = String(value ?? "").toLowerCase();
    const expected = String(filter.filter ?? "").toLowerCase();
    switch (filter.type) {
      case "equals":
        return text === expected;
      case "notEqual":
        return text !== expected;
      case "contains":
        return text.includes(expected);
      case "notContains":
        return !text.includes(expected);
      case "startsWith":
        return text.startsWith(expected);
      case "endsWith":
        return text.endsWith(expected);
    }
  }
  if (value === null) {
    return false;
  }
  const from = filter.filterType === "date" ? filter.dateFrom : filter.filter;
  const to = filter.filterType === "date" ? filter.dateTo : filter.filterTo;
  const compare = (bound: string | number | null | undefined) =>
    typeof value === "number" && typeof bound === "number"
      ? value - bound
      : String(value).localeCompare(String(bound));
  const order = compare(from);
  switch (filter.type) {
    case "equals":
      return order === 0;
    case "notEqual":
      return order !== 0;
    case "lessThan":
      return order < 0;
    case "lessThanOrEqual":
      return order <= 0;
    case "greaterThan":
      return order > 0;
    case "greaterThanOrEqual":
      return order >= 0;
    case "inRange":
      return order >= 0 && compare(to) <= 0;
  }
}

export async function foodApi(
  page: Page,
  initial: FoodItem[],
  failOnceId?: string,
) {
  let items = initial.map((item) => ({ ...item }));
  let failurePending = Boolean(failOnceId);
  const deleted: string[] = [];
  const queries: URLSearchParams[] = [];
  await page.route("**/api/v1/food-items**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const segments = url.pathname.split("/").filter(Boolean);
    const id =
      request.method() === "DELETE" ? segments.at(-3) : segments.at(-1);
    if (request.method() === "POST") {
      const item: FoodItem = {
        ...createFoodItemSchema.parse(request.postDataJSON()),
        id: "312345678901234567890123",
        revision: 0,
        createdAt: milk.createdAt,
        updatedAt: milk.updatedAt,
      };
      items.unshift(item);
      await route.fulfill({ status: 201, json: item });
    } else if (request.method() === "PATCH") {
      const item = items.find((entry) => entry.id === id);
      if (!item) {
        throw new Error("Fixture item missing.");
      }

      const body = request.postDataJSON() as {
        expectedRevision: number;
        changes: Partial<FoodItem>;
      };
      if (body.expectedRevision !== item.revision) {
        await route.fulfill({
          status: 409,
          json: {
            error: {
              code: "FOOD_ITEM_REVISION_CONFLICT",
              message: "This pantry item changed since it was loaded.",
            },
          },
        });

        return;
      }
      Object.assign(item, body.changes, {
        revision: item.revision + 1,
        updatedAt: "2026-10-19T00:01:00Z",
      });
      await route.fulfill({ json: item });
    } else if (request.method() === "DELETE") {
      if (!id) {
        throw new Error("Missing fixture ID.");
      }

      deleted.push(id);
      if (failurePending && id === failOnceId) {
        failurePending = false;
        await route.fulfill({
          status: 422,
          json: {
            error: {
              code: "DATABASE_UNAVAILABLE",
              message: "Please try again shortly.",
            },
          },
        });
      } else {
        items = items.filter((item) => item.id !== id);
        await route.fulfill({ status: 204, body: "" });
      }
    } else if (id && id !== "food-items") {
      const item = items.find((entry) => entry.id === id);
      await route.fulfill(
        item
          ? { json: item }
          : {
              status: 404,
              json: {
                error: {
                  code: "FOOD_ITEM_NOT_FOUND",
                  message: "Food item not found.",
                },
              },
            },
      );
    } else {
      const parameters = url.searchParams;
      queries.push(parameters);
      const query = foodItemQuerySchema.parse(Object.fromEntries(parameters));
      let matching = items.filter((item) =>
        item.name.toLowerCase().includes(query.search.toLowerCase()),
      );
      for (const field of Object.keys(
        query.filters,
      ) as (keyof FoodItemQuery["filters"])[]) {
        const filter = query.filters[field];
        if (filter) {
          matching = matching.filter((item) =>
            matchesFilter(
              field === "createdAt" ? item.createdAt.slice(0, 10) : item[field],
              filter,
            ),
          );
        }
      }
      matching.sort((left, right) => {
        for (const entry of query.sort) {
          const a = left[entry.colId] ?? "";
          const b = right[entry.colId] ?? "";
          const order =
            typeof a === "number" && typeof b === "number"
              ? a - b
              : String(a).localeCompare(String(b));
          if (order) {
            return entry.sort === "asc" ? order : -order;
          }
        }

        return 0;
      });
      await route.fulfill({
        json: {
          items: matching.slice(query.start, query.start + query.limit),
          total: matching.length,
          start: query.start,
          limit: query.limit,
        },
      });
    }
  });

  return { deleted, queries };
}

export const nameCells = (page: Page) =>
  page.locator('table tbody th[scope="row"]');

export async function selectRow(page: Page, id: string) {
  const checkbox = page.locator(
    `table tbody tr[data-item-id="${id}"] input[type="checkbox"]`,
  );
  await checkbox.click();
  await expect(checkbox).toBeChecked();
}

export async function expectAccessible(page: Page) {
  const results: AxeResults = await new AxeBuilder({ page })
    .withTags([
      "wcag2a",
      "wcag2aa",
      "wcag21a",
      "wcag21aa",
      "wcag22aa",
      "best-practice",
    ])
    .analyze();
  expect(results.violations).toEqual([]);
}

export function requireGeometry<T>(value: T | null): T {
  if (value === null) {
    throw new Error("Expected element geometry.");
  }

  return value;
}
