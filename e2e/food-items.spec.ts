import { expect, type Route } from "@playwright/test";
import {
  bananas,
  expectAccessible,
  foodApi,
  milk,
  nameCells,
  rice,
  selectRow,
  test,
} from "./fixtures/pantry";

const manyItems = Array.from({ length: 65 }, (_, index) => ({
  ...milk,
  id: index.toString(16).padStart(24, "0"),
  name: `Food ${String(index + 1).padStart(2, "0")}`,
}));

test("desktop uses a semantic table with independent scrolling and loaded-only selection", async ({
  page,
}) => {
  const api = await foodApi(page, manyItems);
  await page.goto("/pantry");
  const scroller = page.getByTestId("desktop-inventory-scroll");
  await expect(
    page.getByRole("table", { name: "Food inventory" }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Date added" }),
  ).toBeVisible();
  await expect(nameCells(page)).toHaveCount(20);
  expect(api.queries[0]?.get("limit")).toBe("20");
  await expect(page.getByRole("heading", { name: "My Pantry" })).toBeVisible();
  await page.getByRole("checkbox", { name: "Select all loaded items" }).check();
  await expect(
    page.getByRole("button", { name: "Delete selected (20)" }),
  ).toBeVisible();
  await scroller.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(nameCells(page)).toHaveCount(40);
  await expect(
    page.getByRole("button", { name: "Delete selected (20)" }),
  ).toBeVisible();
  await selectRow(page, manyItems[20]!.id);
  await expect(
    page.getByRole("button", { name: "Delete selected (21)" }),
  ).toBeVisible();
  expect(
    await scroller.evaluate((element) => element.scrollTop),
  ).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  const header = page.getByRole("columnheader", { name: "Food item" });
  const scrollBounds = await scroller.boundingBox();
  const headerBounds = await header.boundingBox();
  expect(headerBounds?.y).toBeGreaterThanOrEqual(scrollBounds?.y ?? 0);
  await page.setViewportSize({ width: 800, height: 700 });
  await expect(
    page.getByRole("columnheader", { name: "Date added", includeHidden: true }),
  ).toBeHidden();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expectAccessible(page);
});

test("a tall desktop scroll area fetches another batch before the user can scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1100, height: 1800 });
  const api = await foodApi(page, manyItems);
  await page.goto("/pantry");
  await expect.poll(() => nameCells(page).count()).toBeGreaterThan(20);
  expect(api.queries.some((query) => query.get("start") === "20")).toBe(true);
});

test("sort and filter apply to the server result and compose with search", async ({
  page,
}) => {
  const api = await foodApi(page, [milk, rice, bananas]);
  await page.goto("/pantry");
  await expect(nameCells(page)).toHaveText(["Milk", "Rice", "Bananas"]);
  await page
    .getByRole("combobox", { name: "Sort pantry items" })
    .selectOption("name-asc");
  await expect(nameCells(page)).toHaveText(["Bananas", "Milk", "Rice"]);
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Filter items" });
  await dialog.getByLabel("Add filter").selectOption("name");
  await dialog
    .getByRole("group", { name: "Food name" })
    .getByLabel("Value")
    .fill("milk");
  await dialog.getByRole("button", { name: "Apply" }).click();
  await expect(nameCells(page)).toHaveText(["Milk"]);
  await expect(
    page.getByRole("button", { name: "Remove name filter" }),
  ).toContainText("contains milk");
  expect(api.queries.at(-1)?.get("filters")).toContain('"name"');
  expect(api.queries.at(-1)?.get("sort")).toContain('"name"');
  await page.getByRole("searchbox", { name: "Search food items" }).fill("ri");
  await expect(nameCells(page)).toHaveCount(0);
  expect(api.queries.at(-1)?.get("search")).toBe("ri");
  await page.getByRole("button", { name: /name filter/ }).click();
  await expect(nameCells(page)).toHaveText(["Rice"]);
});

test("sorting and filtering reach matching items beyond the first loaded batch", async ({
  page,
}) => {
  const api = await foodApi(page, manyItems);
  await page.goto("/pantry");
  await expect(nameCells(page)).toHaveCount(20);
  await page
    .getByRole("combobox", { name: "Sort pantry items" })
    .selectOption("name-desc");
  await expect(nameCells(page).first()).toHaveText("Food 65");
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Filter items" });
  await dialog.getByLabel("Add filter").selectOption("name");
  await dialog
    .getByRole("group", { name: "Food name" })
    .getByLabel("Value")
    .fill("Food 6");
  await dialog.getByRole("button", { name: "Apply" }).click();
  await expect(nameCells(page)).toHaveText([
    "Food 65",
    "Food 64",
    "Food 63",
    "Food 62",
    "Food 61",
    "Food 60",
  ]);
  expect(api.queries.at(-1)?.get("start")).toBe("0");
  expect(api.queries.at(-1)?.get("sort")).toContain('"desc"');
});

test("mobile sort and filters use draft Apply, Cancel, and Reset", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const api = await foodApi(page, [milk, rice, bananas]);
  await page.goto("/pantry");
  await expect(
    page.getByRole("list", { name: "Food inventory" }).getByRole("listitem"),
  ).toHaveCount(3);
  await page.getByRole("button", { name: "Sort", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "Filter and sort" });
  await dialog.getByLabel("Sort by").selectOption("name-asc");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  expect(api.queries.at(-1)?.get("sort")).toBe("[]");
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Filter and sort" });
  await dialog.getByLabel("Sort by").selectOption("name-asc");
  await dialog.getByLabel("Add filter").selectOption("expiresOn");
  await dialog
    .getByRole("group", { name: "Expiration date" })
    .getByLabel("Value")
    .fill("2028-02-29");
  await dialog.getByRole("button", { name: "Apply" }).click();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Milk" }),
  ).toBeVisible();
  expect(api.queries.at(-1)?.get("filters")).toContain("2028-02-29");
  await page.getByRole("button", { name: /Expiration date filter/ }).click();
  await expect(
    page.getByRole("list", { name: "Food inventory" }).getByRole("listitem"),
  ).toHaveCount(3);
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Filter and sort" });
  await dialog.getByLabel("Add filter").selectOption("name");
  await dialog.getByRole("button", { name: "Reset" }).click();
  await dialog.getByRole("button", { name: "Apply" }).click();
  expect(api.queries.at(-1)?.get("filters")).toBe("{}");
  expect(api.queries.at(-1)?.get("sort")).toBe("[]");
});

test("filter controls serialize supported fields and operators", async ({
  page,
}) => {
  const api = await foodApi(page, [milk, rice, bananas]);
  await page.goto("/pantry");
  await expect(nameCells(page)).toHaveCount(3);
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Filter items" });
  await dialog.getByLabel("Add filter").selectOption("name");
  await dialog
    .getByRole("group", { name: "Food name" })
    .getByLabel("Condition")
    .selectOption("notContains");
  await dialog
    .getByRole("group", { name: "Food name" })
    .getByLabel("Value")
    .fill("xyz");
  await dialog.getByLabel("Add filter").selectOption("quantity");
  await dialog
    .getByRole("group", { name: "Quantity" })
    .getByLabel("Condition")
    .selectOption("inRange");
  await dialog
    .getByRole("group", { name: "Quantity" })
    .getByLabel("Value")
    .fill("1");
  await dialog
    .getByRole("group", { name: "Quantity" })
    .getByLabel("Through")
    .fill("12");
  await dialog.getByLabel("Add filter").selectOption("unit");
  await dialog
    .getByRole("group", { name: "Unit" })
    .getByLabel("Condition")
    .selectOption("notBlank");
  await dialog.getByLabel("Add filter").selectOption("expiresOn");
  await dialog
    .getByRole("group", { name: "Expiration date" })
    .getByLabel("Condition")
    .selectOption("lessThan");
  await dialog
    .getByRole("group", { name: "Expiration date" })
    .getByLabel("Value")
    .fill("2029-01-01");
  await dialog.getByLabel("Add filter").selectOption("createdAt");
  await dialog
    .getByRole("group", { name: "Date added" })
    .getByLabel("Condition")
    .selectOption("greaterThan");
  await dialog
    .getByRole("group", { name: "Date added" })
    .getByLabel("Value")
    .fill("2025-01-01");
  await dialog.getByRole("button", { name: "Apply" }).click();
  await expect(dialog).toHaveCount(0);
  expect(JSON.parse(api.queries.at(-1)?.get("filters") ?? "{}")).toMatchObject({
    name: { filterType: "text", type: "notContains", filter: "xyz" },
    quantity: {
      filterType: "number",
      type: "inRange",
      filter: 1,
      filterTo: 12,
    },
    unit: { filterType: "text", type: "notBlank" },
    expiresOn: { filterType: "date", type: "lessThan", dateFrom: "2029-01-01" },
    createdAt: {
      filterType: "date",
      type: "greaterThan",
      dateFrom: "2025-01-01",
    },
  });
});

test("mobile list, selection, item actions, and viewport changes share one result set", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const api = await foodApi(page, [milk, rice, bananas]);
  await page.goto("/pantry");
  const list = page.getByRole("list", { name: "Food inventory" });
  await expect(list.getByRole("listitem")).toHaveCount(3);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Actions for Milk" }).click();
  await list.getByRole("button", { name: "Edit" }).click();
  await expect(page.getByRole("dialog", { name: "Edit item" })).toBeVisible();
  await page
    .getByRole("dialog", { name: "Edit item" })
    .getByRole("button", { name: "Cancel" })
    .click();
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await list.getByRole("checkbox", { name: "Select Milk" }).check();
  await expect(
    page.getByRole("button", { name: "Delete selected (1)" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1100, height: 700 });
  await expect(
    page.getByRole("checkbox", { name: "Select Milk" }),
  ).toBeChecked();
  expect(api.queries).toHaveLength(1);
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(
    list.getByRole("checkbox", { name: "Select Milk" }),
  ).toBeChecked();
});

test("mobile header reveals on upward scroll and Back to top restores it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 500 });
  await foodApi(page, manyItems);
  await page.goto("/pantry");
  await expect(
    page.getByRole("list", { name: "Food inventory" }).getByRole("listitem"),
  ).toHaveCount(20);
  await page.evaluate(() => window.scrollTo(0, 1100));
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(800);
  await expect(page.locator("header")).toHaveClass(/-translate-y-full/);
  await expect
    .poll(
      async () =>
        (await page.getByRole("heading", { name: "My Pantry" }).boundingBox())
          ?.y,
    )
    .toBeGreaterThanOrEqual(0);
  await page.evaluate(() => window.scrollBy(0, -200));
  await expect(page.locator("header")).toHaveClass(/translate-y-0/);
  await expect
    .poll(async () => {
      const header = await page.locator("header").boundingBox();
      const heading = await page
        .getByRole("heading", { name: "My Pantry" })
        .boundingBox();
      return (heading?.y ?? 0) - ((header?.y ?? 0) + (header?.height ?? 0));
    })
    .toBeGreaterThanOrEqual(-1);
  await page.evaluate(() => window.scrollBy(0, 5));
  await expect(page.locator("header")).toHaveClass(/translate-y-0/);
  await page.getByRole("searchbox", { name: "Search food items" }).focus();
  await page.evaluate(() => window.scrollBy(0, 150));
  await expect(page.locator("header")).toHaveClass(/translate-y-0/);
  await page.evaluate(() => window.scrollTo(0, 1300));
  await page.getByRole("button", { name: "Back to top" }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.locator("header")).toHaveClass(/translate-y-0/);
});

test("failed loading offers retry and a rapid query change rejects stale results", async ({
  page,
}) => {
  const pending: Route[] = [];
  await page.route("**/api/v1/food-items?**", (route) => {
    pending.push(route);
  });
  await page.goto("/pantry");
  await expect.poll(() => pending.length).toBe(1);
  await page.getByRole("searchbox", { name: "Search food items" }).fill("Milk");
  await expect.poll(() => pending.length).toBe(2);
  await pending[1]?.fulfill({
    json: { items: [milk], total: 1, start: 0, limit: 20 },
  });
  await expect(nameCells(page)).toHaveText(["Milk"]);
  await pending[0]
    ?.fulfill({ json: { items: [rice], total: 1, start: 0, limit: 20 } })
    .catch(() => {});
  await expect(nameCells(page)).toHaveText(["Milk"]);
  await page.getByRole("button", { name: "Clear search" }).click();
  for (const index of [2, 3, 4]) {
    await expect.poll(() => pending.length).toBe(index + 1);
    await pending[index]?.fulfill({
      status: 503,
      json: { error: { code: "DATABASE_UNAVAILABLE", message: "Unavailable" } },
    });
  }
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect.poll(() => pending.length).toBe(6);
  await pending[5]?.fulfill({
    json: { items: [rice], total: 1, start: 0, limit: 20 },
  });
  await expect(nameCells(page)).toHaveText(["Rice"]);
});

test("bulk deletion refreshes after partial success and retries only failed IDs", async ({
  page,
}) => {
  const api = await foodApi(page, [milk, rice, bananas], rice.id);
  await page.goto("/pantry");
  await expect(nameCells(page)).toHaveCount(3);
  await selectRow(page, milk.id);
  await selectRow(page, rice.id);
  await page.getByRole("button", { name: "Delete selected (2)" }).click();
  let dialog = page.getByRole("dialog", { name: "Delete 2 items?" });
  await dialog.getByRole("button", { name: "Confirm delete" }).click();
  dialog = page.getByRole("dialog", { name: "Delete item?" });
  await expect(dialog.getByRole("alert")).toContainText(
    "1 item could not be deleted",
  );
  await expect(nameCells(page)).toHaveText(["Rice", "Bananas"]);
  await dialog.getByRole("button", { name: "Confirm delete" }).click();
  await expect(nameCells(page)).toHaveText(["Bananas"]);
  expect(api.deleted).toEqual([milk.id, rice.id, rice.id]);
});

test("successful add, edit, and delete refetch the first page with applied query and reset desktop scroll", async ({
  page,
}) => {
  const api = await foodApi(page, manyItems);
  await page.goto("/pantry");
  await expect(nameCells(page)).toHaveCount(20);
  await page
    .getByRole("combobox", { name: "Sort pantry items" })
    .selectOption("name-asc");
  await page.getByRole("searchbox", { name: "Search food items" }).fill("Food");
  await expect(nameCells(page)).toHaveCount(20);
  const scroller = page.getByTestId("desktop-inventory-scroll");
  await scroller.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect
    .poll(() => scroller.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  await expect(nameCells(page)).toHaveCount(40);

  async function expectResetAfter(action: () => Promise<void>) {
    const before = api.queries.length;
    await action();
    await expect.poll(() => api.queries.length).toBeGreaterThan(before);
    expect(api.queries[before]?.get("start")).toBe("0");
    expect(api.queries[before]?.get("search")).toBe("Food");
    expect(api.queries[before]?.get("sort")).toContain('"name"');
    await expect
      .poll(() => scroller.evaluate((element) => element.scrollTop))
      .toBe(0);
  }

  await expectResetAfter(async () => {
    await page.getByRole("button", { name: "Add item", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Add item" });
    await dialog.getByLabel(/^Food name/).fill("Food 00");
    await dialog.getByRole("button", { name: "Add item" }).click();
    await expect(dialog).toHaveCount(0);
  });
  await expect(nameCells(page).first()).toHaveText("Food 00");
  await expectResetAfter(async () => {
    await page.getByRole("button", { name: "Edit Food 00" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit item" });
    await dialog.getByLabel(/^Food name/).fill("Food 000");
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(dialog).toHaveCount(0);
  });
  await expect(nameCells(page).first()).toHaveText("Food 000");
  await expectResetAfter(async () => {
    await page.getByRole("button", { name: "Delete Food 000" }).click();
    const dialog = page.getByRole("dialog", { name: "Delete item?" });
    await dialog.getByRole("button", { name: "Confirm delete" }).click();
    await expect(dialog).toHaveCount(0);
  });
  await expect(nameCells(page).first()).toHaveText("Food 01");
});

test("empty pantry and no matches offer creation and query guidance", async ({
  page,
}) => {
  await foodApi(page, []);
  await page.goto("/pantry");
  await expect(
    page.getByRole("region", { name: "No items found" }),
  ).toContainText("Add your first item");
  await page.getByRole("searchbox", { name: "Search food items" }).fill("milk");
  await expect(
    page.getByRole("region", { name: "No items found" }),
  ).toContainText("Try a different search");
});
