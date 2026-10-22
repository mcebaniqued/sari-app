import { expect, type Page, type Route } from "@playwright/test";
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

async function chooseDesktopSort(page: Page, label: string) {
  await page.getByRole("button", { name: /Sort:/ }).click();
  await page
    .getByRole("menu", { name: "Sort pantry items" })
    .getByRole("menuitemradio", { name: label })
    .click();
}

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
  const toolbar = page.getByLabel("Pantry actions");
  const searchBounds = await toolbar.getByRole("searchbox").boundingBox();
  const sortBounds = await toolbar
    .getByRole("button", { name: /Sort:/ })
    .boundingBox();
  const filterBounds = await toolbar
    .getByRole("button", { name: "Filter" })
    .boundingBox();
  const addBounds = await toolbar
    .getByRole("button", { name: "Add item" })
    .boundingBox();
  const centers = [searchBounds, sortBounds, filterBounds, addBounds].map(
    (bounds) => (bounds?.y ?? 0) + (bounds?.height ?? 0) / 2,
  );
  expect(Math.max(...centers) - Math.min(...centers)).toBeLessThan(3);
  expect(searchBounds?.x).toBeLessThan(sortBounds?.x ?? 0);
  expect(sortBounds?.x).toBeLessThan(filterBounds?.x ?? 0);
  expect(filterBounds?.x).toBeLessThan(addBounds?.x ?? 0);
  await page.getByRole("checkbox", { name: "Select all loaded items" }).check();
  await expect(
    page
      .getByRole("toolbar", { name: "Selected items" })
      .getByRole("button", { name: "Delete (20)" }),
  ).toBeVisible();
  await expect(toolbar.getByRole("searchbox")).toBeVisible();
  await expect(toolbar.getByRole("button", { name: /Sort:/ })).toBeVisible();
  await expect(toolbar.getByRole("button", { name: "Filter" })).toBeVisible();
  await expect(toolbar.getByRole("button", { name: "Add item" })).toBeVisible();
  await scroller.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(nameCells(page)).toHaveCount(40);
  await expect(page.getByRole("button", { name: "Delete (20)" })).toBeVisible();
  await selectRow(page, manyItems[20]!.id);
  await expect(page.getByRole("button", { name: "Delete (21)" })).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Select all loaded items" }),
  ).toHaveJSProperty("indeterminate", true);
  await page
    .getByRole("toolbar", { name: "Selected items" })
    .getByRole("button", { name: "Clear selection" })
    .click();
  await expect(
    page.getByRole("checkbox", { name: "Select all loaded items" }),
  ).toHaveJSProperty("indeterminate", false);
  await expect(toolbar.getByRole("button", { name: /Sort:/ })).toBeVisible();
  expect(
    await scroller.evaluate((element) => element.scrollTop),
  ).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  const header = page.getByRole("columnheader", { name: "Food item" });
  const scrollBounds = await scroller.boundingBox();
  const headerBounds = await header.boundingBox();
  expect(headerBounds?.y).toBeGreaterThanOrEqual(scrollBounds?.y ?? 0);
  await page.setViewportSize({ width: 800, height: 700 });
  const narrowSort = await toolbar
    .getByRole("button", { name: /Sort:/ })
    .boundingBox();
  const narrowAdd = await toolbar
    .getByRole("button", { name: "Add item" })
    .boundingBox();
  expect(Math.abs((narrowSort?.y ?? 0) - (narrowAdd?.y ?? 0))).toBeLessThan(4);
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
  await chooseDesktopSort(page, "Name: A to Z");
  await expect(nameCells(page)).toHaveText(["Bananas", "Milk", "Rice"]);
  await expect(
    page.getByRole("button", { name: "Sort: Name: A to Z" }),
  ).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Filter items" });
  await dialog
    .getByRole("group", { name: "Filter 1" })
    .getByLabel("Filter by")
    .selectOption("amount");
  await dialog
    .getByRole("group", { name: "Filter 1" })
    .getByLabel("Condition")
    .selectOption("greaterThan");
  await dialog
    .getByRole("group", { name: "Filter 1" })
    .getByLabel("Quantity")
    .fill("11");
  await dialog.getByLabel("Unit").selectOption("item");
  await dialog.getByRole("button", { name: "Apply" }).click();
  await expect(nameCells(page)).toHaveText(["Bananas"]);
  await expect(
    page.getByRole("button", { name: "Edit Amount filter" }),
  ).toHaveText("Amount: > 11 items");
  expect(api.queries.at(-1)?.get("filters")).toContain('"quantity"');
  expect(api.queries.at(-1)?.get("sort")).toContain('"name"');
  await page.getByRole("searchbox", { name: "Search food items" }).fill("ri");
  await expect(nameCells(page)).toHaveCount(0);
  expect(api.queries.at(-1)?.get("search")).toBe("ri");
  await page.getByRole("button", { name: "Remove Amount filter" }).click();
  await expect(nameCells(page)).toHaveText(["Rice"]);
});

test("sorting and filtering reach matching items beyond the first loaded batch", async ({
  page,
}) => {
  const api = await foodApi(
    page,
    manyItems.map((item, index) => ({ ...item, quantity: index + 1 })),
  );
  await page.goto("/pantry");
  await expect(nameCells(page)).toHaveCount(20);
  await chooseDesktopSort(page, "Name: Z to A");
  await expect(nameCells(page).first()).toHaveText("Food 65");
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Filter items" });
  await dialog
    .getByRole("group", { name: "Filter 1" })
    .getByLabel("Filter by")
    .selectOption("amount");
  await dialog
    .getByRole("group", { name: "Filter 1" })
    .getByLabel("Condition")
    .selectOption("greaterThan");
  await dialog
    .getByRole("group", { name: "Filter 1" })
    .getByLabel("Quantity")
    .fill("59");
  await dialog.getByLabel("Unit").selectOption("l");
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
  await page.getByRole("button", { name: /^Sort by:/ }).click();
  let dialog = page.getByRole("dialog", { name: "Sort items" });
  await dialog.getByRole("radio", { name: "Name: A to Z" }).check();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  expect(api.queries.at(-1)?.get("sort")).toBe("[]");
  await page.getByRole("button", { name: /^Sort by:/ }).click();
  dialog = page.getByRole("dialog", { name: "Sort items" });
  await dialog.getByRole("radio", { name: "Name: A to Z" }).check();
  await dialog.getByRole("button", { name: "Apply" }).click();
  await expect(dialog).toHaveCount(0);
  expect(api.queries.at(-1)?.get("sort")).toContain('"name"');
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Filter items" });
  await dialog
    .getByRole("group", { name: "Filter 1" })
    .getByLabel("Filter by")
    .selectOption("expiresOn");
  await dialog
    .getByRole("group", { name: "Filter 1" })
    .getByLabel("Date", { exact: true })
    .fill("2028-02-29");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  expect(api.queries.at(-1)?.get("filters")).toBe("{}");
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Filter items" });
  await dialog
    .getByRole("group", { name: "Filter 1" })
    .getByLabel("Filter by")
    .selectOption("expiresOn");
  await dialog
    .getByRole("group", { name: "Filter 1" })
    .getByLabel("Date", { exact: true })
    .fill("2028-02-29");
  await dialog.getByRole("button", { name: "Apply" }).click();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Milk" }),
  ).toBeVisible();
  expect(api.queries.at(-1)?.get("filters")).toContain("2028-02-29");
  await expect(page.getByRole("button", { name: "Filter (1)" })).toBeVisible();
  await page.getByRole("button", { name: "Filter (1)" }).click();
  dialog = page.getByRole("dialog", { name: "Filter items" });
  await expect(dialog.getByRole("group", { name: "Filter 1" })).toBeVisible();
  await dialog.getByRole("button", { name: "Add another filter" }).click();
  await dialog
    .getByRole("group", { name: "Filter 2" })
    .getByLabel("Filter by")
    .selectOption("amount");
  await dialog.getByRole("button", { name: "Reset" }).click();
  await dialog.getByRole("button", { name: "Apply" }).click();
  expect(api.queries.at(-1)?.get("filters")).toBe("{}");
  expect(api.queries.at(-1)?.get("sort")).toContain('"name"');
});

test("filter controls serialize three logical filters with AND semantics", async ({
  page,
}) => {
  const api = await foodApi(page, [milk, rice, bananas]);
  await page.goto("/pantry");
  await expect(nameCells(page)).toHaveCount(3);
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Filter items" });
  const first = dialog.getByRole("group", { name: "Filter 1" });
  await expect(first.getByLabel("Filter by").locator("option")).toHaveText([
    "Choose a field",
    "Amount",
    "Expiration date",
    "Date added",
  ]);
  await expect(
    dialog.getByRole("button", { name: "Add another filter" }),
  ).toHaveCount(0);
  await first.getByLabel("Filter by").selectOption("amount");
  await expect(dialog.getByLabel("Filter by")).toHaveCount(1);
  await expect(first.getByLabel("Condition").locator("option")).toHaveText([
    "Equals",
    "Not equal",
    "Less than",
    "At most",
    "Greater than",
    "At least",
    "Between",
  ]);
  await first.getByLabel("Condition").selectOption("inRange");
  await first.getByLabel("From").fill("1");
  await first.getByLabel("To").fill("12");
  await first.getByLabel("Unit").selectOption("l");
  await dialog.getByRole("button", { name: "Add another filter" }).click();
  const second = dialog.getByRole("group", { name: "Filter 2" });
  await expect(second.getByLabel("Filter by")).toBeFocused();
  await expect(
    second.getByLabel("Filter by").locator("option[value=amount]"),
  ).toHaveCount(0);
  await second.getByLabel("Filter by").selectOption("expiresOn");
  await expect(second.getByLabel("Condition").locator("option")).toHaveText([
    "On",
    "Not on",
    "Before",
    "On or before",
    "After",
    "On or after",
    "Between",
    "Has date",
    "No date",
  ]);
  await second.getByLabel("Condition").selectOption("lessThan");
  await second.getByLabel("Date", { exact: true }).fill("2029-01-01");
  await dialog.getByRole("button", { name: "Add another filter" }).click();
  const third = dialog.getByRole("group", { name: "Filter 3" });
  await third.getByLabel("Filter by").selectOption("createdAt");
  await expect(third.getByLabel("Condition").locator("option")).toHaveText([
    "On",
    "Not on",
    "Before",
    "On or before",
    "After",
    "On or after",
    "Between",
  ]);
  await third.getByLabel("Condition").selectOption("greaterThan");
  await third.getByLabel("Date", { exact: true }).fill("2025-01-01");
  await expect(
    dialog.getByRole("button", { name: "Add another filter" }),
  ).toHaveCount(0);
  await dialog.getByRole("button", { name: "Apply" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(nameCells(page)).toHaveText(["Milk"]);
  await expect(page.getByRole("button", { name: "Filter (3)" })).toBeVisible();
  expect(JSON.parse(api.queries.at(-1)?.get("filters") ?? "{}")).toEqual({
    quantity: {
      filterType: "number",
      type: "inRange",
      filter: 1,
      filterTo: 12,
    },
    unit: { filterType: "text", type: "equals", filter: "l" },
    expiresOn: { filterType: "date", type: "lessThan", dateFrom: "2029-01-01" },
    createdAt: {
      filterType: "date",
      type: "greaterThan",
      dateFrom: "2025-01-01",
    },
  });
  await page
    .getByRole("button", { name: "Remove Expiration date filter" })
    .click();
  await expect(page.getByRole("button", { name: "Filter (2)" })).toBeVisible();
  const remaining = JSON.parse(api.queries.at(-1)?.get("filters") ?? "{}");
  expect(remaining.quantity).toMatchObject({ filter: 1, filterTo: 12 });
  expect(remaining.unit).toMatchObject({ type: "equals", filter: "l" });
});

test("applied chips edit and clear filters without losing search or sort", async ({
  page,
}) => {
  const api = await foodApi(page, [milk, rice, bananas]);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/pantry");
  const toolbar = page.getByLabel("Pantry actions");
  const [search, add, sort, filter] = await Promise.all([
    toolbar.getByRole("searchbox").boundingBox(),
    toolbar.getByRole("button", { name: "Add item" }).boundingBox(),
    toolbar.getByRole("button", { name: /^Sort by:/ }).boundingBox(),
    toolbar.getByRole("button", { name: "Filter", exact: true }).boundingBox(),
  ]);
  expect(Math.abs((search?.y ?? 0) - (add?.y ?? 0))).toBeLessThan(4);
  expect(Math.abs((sort?.y ?? 0) - (filter?.y ?? 0))).toBeLessThan(4);
  expect(sort?.y).toBeGreaterThan((search?.y ?? 0) + (search?.height ?? 0));
  await page.getByRole("button", { name: /^Sort by:/ }).click();
  await page
    .getByRole("dialog", { name: "Sort items" })
    .getByRole("radio", { name: "Name: A to Z" })
    .check();
  await page
    .getByRole("dialog", { name: "Sort items" })
    .getByRole("button", { name: "Apply" })
    .click();
  await page.getByRole("searchbox", { name: "Search food items" }).fill("a");
  await expect.poll(() => api.queries.at(-1)?.get("search")).toBe("a");
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "Filter items" });
  let first = dialog.getByRole("group", { name: "Filter 1" });
  await first.getByLabel("Filter by").selectOption("amount");
  await first.getByLabel("Quantity").fill("1");
  await first.getByLabel("Unit").selectOption("item");
  await dialog.getByRole("button", { name: "Apply" }).click();
  const chips = page.getByRole("region", { name: "Applied filters" });
  await expect(
    chips.getByRole("button", { name: "Edit Amount filter" }),
  ).toHaveText("Amount: 1 items");
  await chips.getByRole("button", { name: "Edit Amount filter" }).click();
  dialog = page.getByRole("dialog", { name: "Filter items" });
  first = dialog.getByRole("group", { name: "Filter 1" });
  await expect(first.getByLabel("Filter by")).toBeFocused();
  await first.getByLabel("Condition").selectOption("greaterThan");
  await expect(first.getByLabel("Unit")).toHaveValue("item");
  await expect(first.getByLabel("Quantity")).toHaveValue("1");
  await first.getByLabel("Quantity").fill("");
  await dialog.getByRole("button", { name: "Apply" }).click();
  await expect(first.getByRole("alert")).toHaveText("Enter a quantity.");
  await first.getByLabel("Quantity").fill("2");
  await dialog.getByRole("button", { name: "Apply" }).click();
  await expect(
    chips.getByRole("button", { name: "Edit Amount filter" }),
  ).toHaveText("Amount: > 2 items");
  await page.getByRole("button", { name: "Filter (1)" }).click();
  dialog = page.getByRole("dialog", { name: "Filter items" });
  await dialog.getByRole("button", { name: "Add another filter" }).click();
  await dialog.getByRole("button", { name: "Apply" }).click();
  await expect(
    dialog.getByRole("group", { name: "Filter 2" }).getByRole("alert"),
  ).toHaveText("Choose a field or remove this filter.");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await chips.getByRole("button", { name: "Clear all" }).click();
  await expect(chips).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Filter" })).toBeFocused();
  await expect.poll(() => api.queries.at(-1)?.get("filters")).toBe("{}");
  expect(api.queries.at(-1)?.get("search")).toBe("a");
  expect(api.queries.at(-1)?.get("sort")).toContain('"name"');
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
  await list.getByRole("button", { name: "Edit Milk" }).click();
  await expect(page.getByRole("dialog", { name: "Edit item" })).toBeVisible();
  await page
    .getByRole("dialog", { name: "Edit item" })
    .getByRole("button", { name: "Cancel" })
    .click();
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await list.getByRole("checkbox", { name: "Select Milk" }).check();
  await expect(
    page
      .getByRole("toolbar", { name: "Selected items" })
      .getByRole("button", { name: "Delete (1)" }),
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

test("mobile selection exits cleanly and keeps deletion contextual", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 500 });
  const api = await foodApi(page, [milk, rice]);
  await page.goto("/pantry");
  const list = page.getByRole("list", { name: "Food inventory" });
  await expect(page.getByText("2 items", { exact: true })).toBeVisible();
  const itemX = (await list.getByText("Milk", { exact: true }).boundingBox())
    ?.x;
  await page.getByRole("button", { name: "Select", exact: true }).click();
  expect((await list.getByText("Milk", { exact: true }).boundingBox())?.x).toBe(
    itemX,
  );
  await list.getByRole("checkbox", { name: "Select Milk" }).check();
  await expect(
    list.locator("..").getByText("1 selected", { exact: true }),
  ).toBeVisible();
  const actions = page.getByRole("toolbar", { name: "Selected items" });
  await expect(
    actions.getByRole("button", { name: "Delete (1)" }),
  ).toBeVisible();
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  const lastItem = await list.getByRole("listitem").last().boundingBox();
  const bar = await actions.boundingBox();
  expect((lastItem?.y ?? 0) + (lastItem?.height ?? 0)).toBeLessThanOrEqual(
    (bar?.y ?? 0) + 1,
  );
  await page.getByRole("button", { name: "Done selecting" }).click();
  await expect(list.getByRole("checkbox")).toHaveCount(0);
  await expect(actions).toHaveCount(0);
  expect(api.deleted).toEqual([]);

  await page.getByRole("button", { name: "Select", exact: true }).click();
  await actions.getByRole("button", { name: "Select all" }).click();
  await expect(
    list.getByRole("checkbox", { name: "Select Milk" }),
  ).toBeChecked();
  await expect(
    actions.getByRole("button", { name: "Delete (2)" }),
  ).toBeVisible();
  await actions.getByRole("button", { name: "Delete (2)" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete 2 items?" });
  await dialog.getByRole("button", { name: "Cancel" }).click();
  expect(api.deleted).toEqual([]);
  await actions.getByRole("button", { name: "Delete (2)" }).click();
  await dialog.getByRole("button", { name: "Confirm delete" }).click();
  await expect(list.getByRole("listitem")).toHaveCount(0);
  expect(api.deleted).toEqual([milk.id, rice.id]);
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
  await page.getByRole("button", { name: "Delete (2)" }).click();
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
  const api = await foodApi(page, manyItems.slice(0, 30));
  await page.goto("/pantry");
  await expect(nameCells(page)).toHaveCount(20);
  await chooseDesktopSort(page, "Name: A to Z");
  await page.getByRole("searchbox", { name: "Search food items" }).fill("Food");
  await expect.poll(() => api.queries.at(-1)?.get("search")).toBe("Food");
  await expect(nameCells(page)).toHaveCount(20);
  const scroller = page.getByTestId("desktop-inventory-scroll");
  await expect(scroller).toHaveAttribute("aria-busy", "false");
  const loadMore = scroller.getByRole("button", { name: "Load more" });
  await loadMore.click();
  await expect.poll(() => nameCells(page).count()).toBeGreaterThan(20);
  await scroller.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect
    .poll(() => scroller.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);

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
