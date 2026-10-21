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

test("add and row edit use accessible modals and changes survive refresh", async ({
  page,
}, testInfo) => {
  await foodApi(page, []);
  await page.goto("/");
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "Add item", exact: true });
  await expect(dialog.getByLabel(/^Food name/)).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    dialog.getByRole("button", { name: "Close modal" }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    dialog.getByRole("button", { name: "Add item", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Add item", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Add item", exact: true });
  await dialog.getByLabel(/^Food name/).fill("Rice");
  await dialog.getByLabel(/^Quantity/).fill("0.5");
  await dialog.getByLabel("Unit", { exact: true }).selectOption("lb");
  await expect(dialog.getByLabel(/Expiration date/)).toHaveAttribute(
    "type",
    "date",
  );
  await dialog.getByLabel(/Expiration date/).fill("2028-02-29");
  await dialog.getByRole("button", { name: "Add item", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(nameCells(page)).toHaveText(["Rice"]);
  await expect(page.locator('.ag-row [col-id="expiresOn"]')).toHaveText(
    "Feb 29, 2028",
  );
  await expect(page.locator('.ag-row [col-id="createdAt"]')).toHaveText(
    "Oct 19, 2026",
  );
  await expect(page.locator('.ag-row [col-id="unit"]')).toHaveText("lb");
  await page.reload();
  await expect(nameCells(page)).toHaveText(["Rice"]);
  await page.getByRole("button", { name: "Edit Rice", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Edit item", exact: true });
  await expect(dialog.getByLabel(/^Food name/)).toHaveValue("Rice");
  await expect(dialog.getByLabel(/Expiration date/)).toHaveValue("2028-02-29");
  await expect(dialog.getByLabel("Unit", { exact: true })).toHaveValue("lb");
  await dialog.getByLabel(/^Food name/).fill("Brown rice");
  await dialog.getByLabel(/^Quantity/).fill("1.25");
  await dialog.getByLabel("Unit", { exact: true }).selectOption("oz");
  await dialog.getByLabel(/Expiration date/).fill("");
  await page.screenshot({
    path: testInfo.outputPath("edit-modal-desktop.png"),
    fullPage: true,
  });
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Brown rice updated.")).toBeVisible();
  await page.reload();
  await expect(nameCells(page)).toHaveText(["Brown rice"]);
  await expect(page.locator('.ag-row [col-id="quantity"]')).toHaveText("1.25");
  await expect(page.locator('.ag-row [col-id="unit"]')).toHaveText("oz");
  await expect(page.locator('.ag-row [col-id="expiresOn"]')).toHaveText(
    "No expiration date",
  );
  await page
    .getByRole("button", { name: "Delete Brown rice", exact: true })
    .click();
  dialog = page.getByRole("dialog", { name: "Delete item?", exact: true });
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(nameCells(page)).toHaveText(["Brown rice"]);
  await page
    .getByRole("button", { name: "Delete Brown rice", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Confirm delete" }).click();
  await expect(
    page.getByText("Brown rice deleted from your pantry."),
  ).toBeVisible();
  await page.reload();
  await expect(nameCells(page)).toHaveCount(0);
});

test("grid sorts, filters, and selects only filtered rows", async ({
  page,
}, testInfo) => {
  const api = await foodApi(page, [milk, rice, bananas]);
  await page.goto("/");
  await expect(nameCells(page)).toHaveText(["Milk", "Rice", "Bananas"]);
  await page
    .locator('.ag-header-cell[col-id="name"] .ag-header-cell-text')
    .click();
  await expect(nameCells(page)).toHaveText(["Bananas", "Milk", "Rice"]);
  await page
    .locator('.ag-header-cell[col-id="quantity"] .ag-header-cell-text')
    .click();
  await expect(nameCells(page)).toHaveText(["Rice", "Milk", "Bananas"]);
  await page
    .locator('.ag-header-cell[col-id="name"] .ag-header-cell-filter-button')
    .click();
  await page
    .getByRole("textbox", { name: "Filter Value", exact: true })
    .fill("Milk");
  await expect(nameCells(page)).toHaveText(["Milk"]);
  await page.keyboard.press("Escape");
  await page
    .getByRole("checkbox", { name: "Select current page", exact: true })
    .check();
  await expect(
    page.getByRole("button", { name: "Delete selected (1)", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(nameCells(page)).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: /Delete selected/ }),
  ).toHaveCount(0);
  await page
    .locator('.ag-header-cell[col-id="name"] .ag-header-cell-filter-button')
    .click();
  await page
    .getByRole("textbox", { name: "Filter Value", exact: true })
    .fill("Rice");
  await expect(nameCells(page)).toHaveText(["Rice"]);
  await page.keyboard.press("Escape");
  await page
    .getByRole("checkbox", { name: "Select current page", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Delete selected (1)", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Delete item?",
    exact: true,
  });
  await expect(dialog.getByText("Rice", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Milk", { exact: true })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Confirm delete" }).click();
  await expect(dialog).toHaveCount(0);
  expect(api.deleted).toEqual([rice.id]);
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(nameCells(page)).toHaveText(["Milk", "Bananas"]);
  await page.screenshot({
    path: testInfo.outputPath("pantry-table-desktop.png"),
    fullPage: true,
  });
  await page.evaluate(() => window.scrollTo(0, 300));
  await expect
    .poll(async () => (await page.locator("header").boundingBox())?.y)
    .toBe(0);
});

test("bulk deletion keeps failed rows and retries only those rows", async ({
  page,
}) => {
  const api = await foodApi(page, [milk, rice, bananas], rice.id);
  await page.goto("/");
  await expect(nameCells(page)).toHaveCount(3);
  await selectRow(page, milk.id);
  await selectRow(page, rice.id);
  await page
    .getByRole("button", { name: "Delete selected (2)", exact: true })
    .click();
  let dialog = page.getByRole("dialog", {
    name: "Delete 2 items?",
    exact: true,
  });
  await expect(dialog.getByText("Milk", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Rice", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Bananas", { exact: true })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Confirm delete" }).click();
  dialog = page.getByRole("dialog", { name: "Delete item?", exact: true });
  await expect(dialog.getByRole("alert")).toContainText(
    "1 item could not be deleted",
  );
  await expect(dialog.getByText("Milk", { exact: true })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Confirm delete" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(nameCells(page)).toHaveText(["Bananas"]);
  expect(api.deleted).toEqual([milk.id, rice.id, rice.id]);
  await page.reload();
  await expect(nameCells(page)).toHaveText(["Bananas"]);
});

test("loading hides placeholder counts until the server confirms the result", async ({
  page,
}) => {
  const pending: Route[] = [];
  await page.route("**/api/v1/food-items?**", (route) => {
    pending.push(route);
  });
  await page.goto("/pantry");
  const pagination = page.locator(".ag-paging-panel");
  const status = page
    .getByRole("status")
    .filter({ hasText: /Loading items|matching items/ });
  await expect(status).toHaveText("Loading items…");
  await expect(pagination).toBeHidden();
  await expect(page.locator(".ag-row:visible")).toHaveCount(0);
  await expect(
    page.getByText("No expiration date", { exact: true }),
  ).toBeHidden();
  await expect(
    page.getByRole("region", { name: "No items found", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("No Rows To Show", { exact: true })).toBeHidden();
  await expect.poll(() => pending.length).toBe(1);
  await pending[0]?.fulfill({
    json: { items: [], total: 0, start: 0, limit: 20 },
  });
  await expect(status).toHaveText("0 matching items.");
  await expect(
    page.getByRole("region", { name: "No items found", exact: true }),
  ).toBeVisible();
  await expect(pagination).toBeVisible();
  await expect(page.locator(".ag-paging-row-summary-panel")).toHaveText(
    "0 to 0 of 0",
  );

  await page.getByRole("searchbox", { name: "Search food items" }).fill("milk");
  await expect.poll(() => pending.length).toBe(2);
  await expect(status).toHaveText("Loading items…");
  await expect(pagination).toBeHidden();
  await expect(page.locator(".ag-row:visible")).toHaveCount(0);
  await pending[1]?.fulfill({
    json: { items: [milk], total: 1, start: 0, limit: 20 },
  });
  await expect(status).toHaveText("1 matching items.");
  await expect(pagination).toBeVisible();
  await expect(nameCells(page)).toHaveText(["Milk"]);
});

test("server pagination, debounced search, and selection reset work across pages", async ({
  page,
}) => {
  const initial = Array.from({ length: 45 }, (_, index) => ({
    ...milk,
    id: index.toString(16).padStart(24, "0"),
    name: `Food ${String(index + 1).padStart(2, "0")}`,
  }));
  const api = await foodApi(page, initial);
  await page.goto("/pantry");
  await expect(nameCells(page)).toHaveCount(20);
  expect(api.queries[0]?.get("start")).toBe("0");
  expect(api.queries[0]?.get("limit")).toBe("20");
  await page
    .getByRole("checkbox", { name: "Select current page", exact: true })
    .check();
  await expect(
    page.getByRole("button", { name: "Delete selected (20)", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next Page", exact: true }).click();
  await expect(nameCells(page).first()).toHaveText("Food 21");
  expect(api.queries.at(-1)?.get("start")).toBe("20");
  await expect(
    page.getByRole("button", { name: /Delete selected/ }),
  ).toHaveCount(0);
  const search = page.getByRole("searchbox", { name: "Search food items" });
  await search.fill("Food 4");
  await search.fill("Food 45");
  await expect(nameCells(page)).toHaveText(["Food 45"]);
  expect(api.queries.filter((query) => query.get("search"))).toHaveLength(1);
  expect(api.queries.at(-1)?.get("start")).toBe("0");
  const searchBounds = await search.boundingBox();
  const addBounds = await page
    .getByRole("button", { name: "Add item", exact: true })
    .boundingBox();
  expect(searchBounds?.x).toBeLessThan(addBounds?.x ?? 0);
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(nameCells(page).first()).toHaveText("Food 01");
});

test("date filters use native date inputs and send ISO dates to the server", async ({
  page,
}) => {
  const api = await foodApi(page, [milk, rice]);
  await page.goto("/pantry");
  await expect(nameCells(page)).toHaveCount(2);
  await page
    .locator(
      '.ag-header-cell[col-id="expiresOn"] .ag-header-cell-filter-button',
    )
    .click();
  await page
    .locator('.ag-filter input[type="date"]')
    .first()
    .fill("2028-02-29");
  await expect(nameCells(page)).toHaveText(["Milk"]);
  expect(api.queries.at(-1)?.get("filters")).toContain("2028-02-29");
  await expectAccessible(page);
});

test("load failures retry safely, expose recovery and error toasts, and remain accessible", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/api/v1/food-items?**", async (route) => {
    requests++;
    await route.fulfill({
      status: 503,
      json: {
        error: {
          code: "DATABASE_UNAVAILABLE",
          message: "Database temporarily unavailable.",
        },
      },
    });
  });
  await page.goto("/pantry");
  await expect(
    page.getByRole("button", { name: "Try again", exact: true }),
  ).toBeVisible();
  expect(requests).toBe(3);
  await expect(page.getByRole("alert")).toContainText(
    "Database temporarily unavailable.",
  );
  await expectAccessible(page);
  await page.unroute("**/api/v1/food-items?**");
  await foodApi(page, [milk]);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(nameCells(page)).toHaveText(["Milk"]);
});

test("empty pantry prompts creation and filtered results explain no matches", async ({
  page,
}, testInfo) => {
  await foodApi(page, []);
  await page.goto("/pantry");
  await expect(
    page.getByRole("heading", { name: "My Pantry", exact: true }),
  ).toBeVisible();
  await expect(page.locator("h1 svg")).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "User navigation" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toHaveCount(0);
  const empty = page.getByRole("region", {
    name: "No items found",
    exact: true,
  });
  await expect(empty).toContainText(
    "Add your first item to start your pantry.",
  );
  await expectAccessible(page);
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("pantry-empty-mobile.png"),
    fullPage: true,
  });
  await empty.getByRole("button", { name: "Add an item", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add item", exact: true });
  await expect(dialog.getByLabel(/^Food name/)).toBeFocused();
  await dialog.getByLabel(/^Food name/).fill("Eggs");
  await dialog.getByRole("button", { name: "Add item", exact: true }).click();
  await expect(nameCells(page)).toHaveText(["Eggs"]);
  await expect(empty).toHaveCount(0);
  await page.getByRole("searchbox", { name: "Search food items" }).fill("milk");
  await expect(empty).toContainText(
    "Try a different search or filter, or add an item.",
  );
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await expect(nameCells(page)).toHaveText(["Eggs"]);
  await expect(empty).toHaveCount(0);
});
