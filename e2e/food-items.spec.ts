import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, type Route, test } from "@playwright/test";
import {
  createFoodItemSchema,
  type FoodItem,
  foodItemQuerySchema,
  type FoodProduct,
} from "@sari/contracts";
import type { AxeResults } from "axe-core";

import { signedIn } from "./authFixture";

test.beforeEach(async ({ page }) => {
  await signedIn(page);
});

const milk: FoodItem = {
  id: "012345678901234567890123",
  name: "Milk",
  quantity: 2,
  unit: "l",
  expiresOn: "2028-02-29",
  createdAt: "2026-10-19T00:00:00Z",
  updatedAt: "2026-10-19T00:00:00Z",
};
const rice: FoodItem = {
  ...milk,
  id: "112345678901234567890123",
  name: "Rice",
  quantity: 1,
  unit: "kg",
  expiresOn: null,
};
const bananas: FoodItem = {
  ...milk,
  id: "212345678901234567890123",
  name: "Bananas",
  quantity: 12,
  unit: "item",
  expiresOn: null,
};

const usdaOats: FoodProduct = {
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

test("camera decodes a UPC from video and looks up the item once", async ({
  page,
}) => {
  // UPC-A 853807005033: left digit patterns, center guard, then inverted
  // right digit patterns. A canvas stream exercises the actual ZXing decoder.
  const patterns = [
    "0001101",
    "0011001",
    "0010011",
    "0111101",
    "0100011",
    "0110001",
    "0101111",
    "0111011",
    "0110111",
    "0001011",
  ];
  const upc = "853807005033";
  const left = [...upc.slice(0, 6)]
    .map((digit) => patterns[Number(digit)])
    .join("");
  const right = [...upc.slice(6)]
    .map((digit) => patterns[Number(digit)])
    .join("")
    .replace(/[01]/g, (bit) => (bit === "0" ? "1" : "0"));
  const bars = `101${left}01010${right}101`;
  await page.addInitScript((bars) => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        const canvas = document.createElement("canvas");
        canvas.id = "test-camera-source";
        canvas.hidden = true;
        canvas.width = 640;
        canvas.height = 360;
        const context = canvas.getContext("2d")!;
        context.fillStyle = "white";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = "black";
        [...bars].forEach((bar, index) => {
          if (bar === "1") {
            context.fillRect(130 + index * 4, 60, 4, 240);
          }
        });
        document.body.append(canvas);
        const stream = canvas.captureStream(10);
        Object.defineProperty(canvas, "cameraStream", { value: stream });
        return stream;
      },
    });
  }, bars);
  await foodApi(page, []);
  const lookups: string[] = [];
  await page.route("**/api/v1/food-products/barcode/*", (route) => {
    lookups.push(new URL(route.request().url()).pathname);
    return route.fulfill({
      json: {
        product: {
          ...usdaOats,
          barcode: "00853807005033",
          name: "Test cooking oil",
        },
        stale: false,
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add item", exact: true });
  await dialog.getByRole("button", { name: "Input barcode instead" }).click();
  await dialog.getByRole("button", { name: "Scan with camera" }).click();
  await expect(dialog.getByLabel(/^Food name/)).toHaveValue("Test cooking oil");
  expect(lookups).toEqual(["/api/v1/food-products/barcode/00853807005033"]);
  await expect(dialog.getByLabel("Barcode camera preview")).toHaveCount(0);
  expect(
    await page
      .locator("#test-camera-source")
      .evaluate((canvas) =>
        (
          canvas as HTMLCanvasElement & { cameraStream: MediaStream }
        ).cameraStream
          .getTracks()
          .every((track) => track.readyState === "ended"),
      ),
  ).toBe(true);
  await expect(
    dialog.getByRole("button", { name: "Add item", exact: true }),
  ).toBeEnabled();
});

test("barcode suggestions are reviewed, privately renamed, saved, and unlinked", async ({
  page,
}) => {
  await foodApi(page, []);
  await page.route("**/api/v1/food-products/barcode/*", (route) =>
    route.fulfill({ json: { product: usdaOats, stale: false } }),
  );
  await page.route(`**/api/v1/food-products/${usdaOats.id}`, (route) =>
    route.fulfill({ json: usdaOats }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add item", exact: true });
  await expect(dialog.getByLabel(/^Food name/)).toBeFocused();
  await dialog.getByRole("button", { name: "Input barcode instead" }).click();
  await dialog.getByLabel("Barcode number").fill("012345678905");
  await dialog.getByRole("button", { name: "Find item", exact: true }).click();
  await expect(dialog.getByText("USDA oats", { exact: true })).toBeVisible();
  await expect(dialog.getByLabel("Barcode number")).toHaveCount(0);
  await expect(dialog.getByLabel(/^Quantity/)).toHaveValue("500");
  await dialog.getByLabel(/^Food name/).fill("My breakfast oats");
  await expect(dialog.getByText("USDA oats", { exact: true })).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
  await dialog.getByRole("button", { name: "Add item", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(nameCells(page)).toHaveText(["My breakfast oats"]);
  await page.reload();
  await page
    .getByRole("button", { name: "Edit My breakfast oats", exact: true })
    .click();
  const edit = page.getByRole("dialog", { name: "Edit item", exact: true });
  await expect(edit.getByText("USDA oats", { exact: true })).toBeVisible();
  await edit.getByRole("button", { name: "Remove product link" }).click();
  await expect(edit.getByLabel(/^Food name/)).toHaveValue("My breakfast oats");
  await expect(edit.getByLabel(/^Quantity/)).toHaveValue("500");
  await edit.getByRole("button", { name: "Save changes" }).click();
  await page
    .getByRole("button", { name: "Edit My breakfast oats", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Remove product link" }),
  ).toHaveCount(0);
});

test("barcode not found preserves manual entry and records no product link", async ({
  page,
}) => {
  await foodApi(page, []);
  await page.route("**/api/v1/food-products/barcode/*", (route) =>
    route.fulfill({
      status: 404,
      json: {
        error: {
          code: "PRODUCT_NOT_FOUND",
          message: "Product not found in USDA. Enter details manually.",
        },
      },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add item", exact: true });
  await dialog.getByRole("button", { name: "Input barcode instead" }).click();
  await dialog.getByLabel("Barcode number").fill("012345678905");
  await dialog.getByRole("button", { name: "Find item", exact: true }).click();
  await expect(
    dialog.getByText("Barcode not found. Enter the item details manually."),
  ).toBeVisible();
  await expect(dialog.getByText(/No USDA product linked/)).toHaveCount(0);
  await dialog.getByRole("button", { name: "Enter details manually" }).click();
  await expect(dialog.getByLabel(/^Food name/)).toBeFocused();
  await dialog.getByLabel(/^Food name/).fill("Local cereal");
  await dialog.getByRole("button", { name: "Add item", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(nameCells(page)).toHaveText(["Local cereal"]);
});

test("barcode entry preserves drafts and fits a phone screen", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await foodApi(page, []);
  await page.route("**/api/v1/food-products/barcode/*", (route) =>
    route.fulfill({ json: { product: usdaOats, stale: false } }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add item", exact: true });
  await dialog.getByLabel(/^Food name/).fill("My breakfast");
  await dialog.getByLabel(/Expiration date/).fill("2028-02-29");
  await dialog.getByRole("button", { name: "Input barcode instead" }).click();
  await expect(dialog.getByLabel("Barcode number")).toBeFocused();
  await expect(dialog.getByLabel(/^Food name/)).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: "Add item", exact: true }),
  ).toHaveCount(0);
  await dialog.getByLabel("Barcode number").fill("012345678905");
  await page.screenshot({
    path: testInfo.outputPath("barcode-phone.png"),
    fullPage: true,
  });
  await expect(dialog).toHaveJSProperty(
    "scrollWidth",
    await dialog.evaluate((element) => element.clientWidth),
  );
  await dialog.getByRole("button", { name: "Enter details manually" }).click();
  await expect(dialog.getByLabel(/^Food name/)).toHaveValue("My breakfast");
  await expect(dialog.getByLabel(/Expiration date/)).toHaveValue("2028-02-29");
  await dialog.getByRole("button", { name: "Input barcode instead" }).click();
  await expect(dialog.getByLabel("Barcode number")).toHaveValue("012345678905");
  await dialog.getByLabel("Barcode number").press("Enter");
  await expect(dialog.getByText("USDA oats", { exact: true })).toBeVisible();
  await expect(dialog.getByLabel(/^Food name/)).toHaveValue("My breakfast");
  await expect(dialog.getByLabel(/^Quantity/)).toHaveValue("500");
  await dialog.getByRole("button", { name: "Keep my entries" }).click();
  await expect(dialog.getByText(/^Barcode:/)).toBeHidden();
  await page.screenshot({
    path: testInfo.outputPath("matched-product-phone.png"),
    fullPage: true,
  });
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
  await expect(dialog).toHaveJSProperty(
    "scrollWidth",
    await dialog.evaluate((element) => element.clientWidth),
  );
  await dialog.getByText("More product details", { exact: true }).click();
  await expect(dialog.getByText(`Barcode: ${usdaOats.barcode}`)).toBeVisible();
});

async function foodApi(page: Page, initial: FoodItem[], failOnceId?: string) {
  let items = initial.map((item) => ({ ...item }));
  let failurePending = Boolean(failOnceId);
  const deleted: string[] = [];
  const queries: URLSearchParams[] = [];
  await page.route("**/api/v1/food-items**", async (route) => {
    const request = route.request();
    const id = new URL(request.url()).pathname.split("/").pop();
    if (request.method() === "POST") {
      const item: FoodItem = {
        ...createFoodItemSchema.parse(request.postDataJSON()),
        id: "312345678901234567890123",
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
      Object.assign(item, request.postDataJSON(), {
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
          status: 503,
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
    } else {
      const parameters = new URL(request.url()).searchParams;
      queries.push(parameters);
      const query = foodItemQuerySchema.parse(Object.fromEntries(parameters));
      let matching = items.filter((item) =>
        item.name.toLowerCase().includes(query.search.toLowerCase()),
      );
      if (query.filters.name?.filter) {
        matching = matching.filter((item) =>
          item.name
            .toLowerCase()
            .includes(query.filters.name?.filter?.toLowerCase() ?? ""),
        );
      }
      if (query.filters.expiresOn?.dateFrom) {
        matching = matching.filter(
          (item) => item.expiresOn === query.filters.expiresOn?.dateFrom,
        );
      }
      if (query.filters.quantity?.filter !== undefined) {
        matching = matching.filter(
          (item) => item.quantity > (query.filters.quantity?.filter ?? 0),
        );
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

const nameCells = (page: Page) =>
  page.locator('.ag-row [col-id="name"]').filter({ hasText: /\S/ });
async function selectRow(page: Page, id: string) {
  const checkbox = page.locator(
    `.ag-row[row-id="${id}"] input[type="checkbox"]`,
  );
  await checkbox.click();
  await expect(checkbox).toBeChecked();
}

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

test("table and modal fit a phone viewport", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await foodApi(page, [milk, rice, bananas]);
  await page.goto("/");
  await expect(nameCells(page)).toHaveCount(3);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("pantry-table-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Edit Milk", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Edit item", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel(/^Food name/)).toBeFocused();
  const bounds = await dialog.boundingBox();
  expect(bounds?.width).toBeLessThanOrEqual(375);
  await page.screenshot({
    path: testInfo.outputPath("edit-modal-mobile.png"),
    fullPage: true,
  });
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toHaveCount(0);
});

async function expectAccessible(page: Page) {
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

test("page, filter popup, forms, confirmation, and notifications pass axe checks", async ({
  page,
}) => {
  await foodApi(page, [milk, rice, bananas]);
  await page.goto("/pantry");
  await expect(nameCells(page)).toHaveCount(3);
  await expectAccessible(page);
  await page
    .locator('.ag-header-cell[col-id="name"] .ag-header-cell-filter-button')
    .click();
  await expect(
    page.getByRole("textbox", { name: "Filter Value", exact: true }),
  ).toBeVisible();
  await expectAccessible(page);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await expectAccessible(page);
  const add = page.getByRole("dialog", { name: "Add item", exact: true });
  await add.getByLabel(/^Food name/).fill("Oats");
  await add.getByRole("button", { name: "Add item", exact: true }).click();
  await expect(page.getByText("Oats added to your pantry.")).toBeVisible();
  await page.getByText("Oats added to your pantry.").hover();
  await expectAccessible(page);
  await page.getByRole("button", { name: "Dismiss notification" }).click();
  await expect(page.getByText("Oats added to your pantry.")).toHaveCount(0);
  await page.getByRole("button", { name: "Edit Milk", exact: true }).click();
  await expectAccessible(page);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Delete Milk", exact: true }).click();
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

test("empty state and recovery pages are accessible and root redirects to pantry", async ({
  page,
}) => {
  await foodApi(page, []);
  await page.goto("/");
  await expect(page).toHaveURL(/\/pantry$/);
  await expect(
    page.getByRole("status").filter({ hasText: "0 matching items." }),
  ).toBeAttached();
  await expectAccessible(page);
  for (const [path, title] of [
    ["/missing", "Page not found"],
    ["/access-denied", "Access denied"],
  ] as const) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await expectAccessible(page);
    await page.getByRole("link", { name: "Back to pantry" }).click();
    await expect(page).toHaveURL(/\/pantry$/);
  }
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

function requireGeometry<T>(value: T | null): T {
  if (value === null) {
    throw new Error("Expected element geometry.");
  }
  return value;
}

test("notifications are centered below the CTA and auto-dismiss after a hover pause", async ({
  page,
}, testInfo) => {
  await foodApi(page, [milk]);
  await page.goto("/pantry");
  await expect(nameCells(page)).toHaveText(["Milk"]);
  await page.clock.install();
  await page.getByRole("button", { name: "Edit Milk", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Edit item", exact: true });
  await dialog.getByLabel(/^Food name/).fill("Oat milk");
  await dialog
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  const notification = page
    .getByRole("status")
    .filter({ hasText: "Oat milk updated." });
  await expect(notification).toBeVisible();
  const bounds = requireGeometry(await notification.boundingBox());
  const add = requireGeometry(
    await page
      .getByRole("button", { name: "Add item", exact: true })
      .boundingBox(),
  );
  const icon = requireGeometry(
    await notification.locator("svg").first().boundingBox(),
  );
  const message = requireGeometry(
    await notification
      .getByText("Oat milk updated.", { exact: true })
      .boundingBox(),
  );
  const close = requireGeometry(
    await notification
      .getByRole("button", { name: "Dismiss notification" })
      .boundingBox(),
  );
  expect(
    Math.abs(
      bounds.x + bounds.width / 2 - (page.viewportSize()?.width ?? 0) / 2,
    ),
  ).toBeLessThan(1);
  expect(bounds.y).toBeGreaterThan(add.y + add.height);
  expect(
    Math.abs(icon.y + icon.height / 2 - message.y - message.height / 2),
  ).toBeLessThan(1);
  expect(
    Math.abs(close.y + close.height / 2 - message.y - message.height / 2),
  ).toBeLessThan(1);
  await page.screenshot({
    path: testInfo.outputPath("pantry-bottom-toast.png"),
    fullPage: true,
  });
  await page.clock.fastForward(4000);
  await expect(notification).toBeVisible();
  await notification.hover();
  await page.clock.fastForward(10000);
  await expect(notification).toBeVisible();
  await page.mouse.move(0, 0);
  await page.clock.fastForward(1100);
  await expect(notification).toHaveCount(0);
});

test("controls use pointer and disabled cursors, and quantity filters align right", async ({
  page,
}) => {
  await foodApi(page, [milk]);
  await page.goto("/pantry");
  await expect(nameCells(page)).toHaveText(["Milk"]);
  await expect(page.getByRole("link", { name: "Sari", exact: true })).toHaveCSS(
    "cursor",
    "pointer",
  );
  await expect(
    page.getByRole("button", { name: "Add item", exact: true }),
  ).toHaveCSS("cursor", "pointer");
  await expect(
    page.getByRole("searchbox", { name: "Search food items" }),
  ).toHaveCSS("cursor", "pointer");
  await expect(
    page.getByRole("button", { name: "First Page", exact: true }),
  ).toHaveCSS("cursor", "not-allowed");
  await expect(
    page.getByRole("checkbox", { name: "Select current page", exact: true }),
  ).toHaveCSS("cursor", "pointer");
  const header = page.locator('.ag-header-cell[col-id="quantity"]');
  const label = requireGeometry(
    await header.locator(".ag-header-cell-text").boundingBox(),
  );
  const filter = requireGeometry(
    await header.locator(".ag-header-cell-filter-button").boundingBox(),
  );
  expect(filter.x).toBeGreaterThan(label.x + label.width);
  await page.getByRole("button", { name: "Edit Milk", exact: true }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Cancel", exact: true }),
  ).toHaveCSS("cursor", "pointer");
  await expect(page.getByLabel("Unit", { exact: true })).toHaveCSS(
    "cursor",
    "pointer",
  );
  const pending: Route[] = [];
  await page.route(`**/api/v1/food-items/${milk.id}`, (route) => {
    pending.push(route);
  });
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  const saving = page.getByRole("button", { name: "Saving…", exact: true });
  await expect(saving).toBeDisabled();
  await expect(saving).toHaveCSS("cursor", "not-allowed");
  await expect(page.getByLabel(/^Food name/)).toHaveCSS(
    "cursor",
    "not-allowed",
  );
  await expect(page.getByLabel("Unit", { exact: true })).toHaveCSS(
    "cursor",
    "not-allowed",
  );
  await expect.poll(() => pending.length).toBe(1);
  await pending[0]?.fulfill({ json: milk });
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
