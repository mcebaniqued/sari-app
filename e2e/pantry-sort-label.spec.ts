import { expect, type Locator, type Page } from "@playwright/test";
import { foodApi, milk, nameCells, test } from "./fixtures/pantry";

const choices = [
  { label: "Added: Newest", sort: [] },
  { label: "Added: Oldest", sort: [{ colId: "createdAt", sort: "asc" }] },
  { label: "Expiration: Soonest", sort: [{ colId: "expiresOn", sort: "asc" }] },
  { label: "Expiration: Latest", sort: [{ colId: "expiresOn", sort: "desc" }] },
  { label: "Name: A to Z", sort: [{ colId: "name", sort: "asc" }] },
  { label: "Name: Z to A", sort: [{ colId: "name", sort: "desc" }] },
  { label: "Quantity: Lowest", sort: [{ colId: "quantity", sort: "asc" }] },
  { label: "Quantity: Highest", sort: [{ colId: "quantity", sort: "desc" }] },
  { label: "Unit: A to Z", sort: [{ colId: "unit", sort: "asc" }] },
  { label: "Unit: Z to A", sort: [{ colId: "unit", sort: "desc" }] },
] as const;

async function expectSortLabel(sort: Locator, label: string, desktop: boolean) {
  await expect(sort).toHaveText(label);
  await expect(sort).toHaveAccessibleName(
    desktop ? `Sort: ${label}` : `Sort by: ${label}`,
  );
}

async function expectSortLayout(page: Page, sort: Locator, filter: Locator) {
  const geometry = await sort.evaluate((button) => {
    const bounds = button.getBoundingClientRect();
    const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
    const textRects: DOMRect[] = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.textContent?.trim()) {
        continue;
      }
      const range = document.createRange();
      range.selectNodeContents(node);
      textRects.push(range.getBoundingClientRect());
    }
    return {
      button: {
        left: bounds.left,
        right: bounds.right,
        top: bounds.top,
        bottom: bounds.bottom,
        height: bounds.height,
      },
      text: textRects.map((rect) => ({
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
      })),
      scrollWidth: button.scrollWidth,
      clientWidth: button.clientWidth,
    };
  });
  const filterBounds = await filter.boundingBox();
  expect(filterBounds).not.toBeNull();
  expect(geometry.button.height).toBe(44);
  expect(geometry.text).not.toHaveLength(0);
  expect(
    Math.max(...geometry.text.map((rect) => rect.bottom)) -
      Math.min(...geometry.text.map((rect) => rect.top)),
  ).toBeLessThan(25);
  expect(
    geometry.text.every(
      (rect) =>
        rect.left >= geometry.button.left &&
        rect.right <= geometry.button.right,
    ),
  ).toBe(true);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
  expect(geometry.button.right).toBeLessThanOrEqual(filterBounds!.x);
  expect(Math.abs(geometry.button.top - filterBounds!.y)).toBeLessThan(2);
  expect(Math.abs(geometry.button.height - filterBounds!.height)).toBeLessThan(
    2,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test("desktop Sort shows only the applied choice while navigating and dismissing", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const api = await foodApi(page, [milk]);
  await page.goto("/pantry");
  await expect(nameCells(page)).toHaveText(["Milk"]);
  const sort = page.getByRole("button", { name: /^Sort:/ });
  const menu = page.getByRole("menu", { name: "Sort pantry items" });
  await expectSortLabel(sort, "Added: Newest", true);
  expect(JSON.parse(api.queries.at(-1)?.get("sort") ?? "null")).toEqual([]);
  const initialRequests = api.queries.length;
  await sort.focus();
  await page.keyboard.press("Enter");
  await expect(sort).toHaveAttribute("aria-expanded", "true");
  await expectSortLabel(sort, "Added: Newest", true);
  await page.keyboard.press("ArrowDown");
  await expect(
    menu.getByRole("menuitemradio", { name: "Added: Oldest" }),
  ).toBeFocused();
  await expectSortLabel(sort, "Added: Newest", true);
  expect(api.queries).toHaveLength(initialRequests);
  await page.keyboard.press("Escape");
  await expect(sort).toBeFocused();
  await expect(sort).toHaveAttribute("aria-expanded", "false");
  await expectSortLabel(sort, "Added: Newest", true);
  expect(api.queries).toHaveLength(initialRequests);
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Space");
  await expect(sort).toBeFocused();
  await expectSortLabel(sort, "Added: Oldest", true);
  await expect.poll(() => api.queries.length).toBe(initialRequests + 1);
  expect(JSON.parse(api.queries.at(-1)?.get("sort") ?? "null")).toEqual(
    choices[1].sort,
  );
});

test("mobile Sort displays the applied choice while radio changes remain drafts", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  const api = await foodApi(page, [milk]);
  await page.goto("/pantry");
  await expect(
    page.getByRole("list", { name: "Food inventory" }),
  ).toBeVisible();
  const sort = page.getByRole("button", { name: /^Sort by:/ });
  const dialog = page.getByRole("dialog", { name: "Sort items" });
  await expectSortLabel(sort, "Added: Newest", false);
  const initialRequests = api.queries.length;
  await sort.click();
  await expect(sort).toHaveAttribute("aria-expanded", "true");
  await dialog.getByRole("radio", { name: "Added: Newest" }).focus();
  for (let index = 0; index < 6; index++) {
    await page.keyboard.press("ArrowDown");
  }
  await expect(
    dialog.getByRole("radio", { name: "Quantity: Lowest" }),
  ).toBeChecked();
  await expectSortLabel(sort, "Added: Newest", false);
  expect(api.queries).toHaveLength(initialRequests);
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(sort).toBeFocused();
  await expectSortLabel(sort, "Added: Newest", false);
  expect(api.queries).toHaveLength(initialRequests);
  await sort.click();
  await dialog.getByRole("radio", { name: "Quantity: Lowest" }).check();
  await page.keyboard.press("Escape");
  await expect(sort).toBeFocused();
  await expectSortLabel(sort, "Added: Newest", false);
  expect(api.queries).toHaveLength(initialRequests);
  await sort.click();
  await dialog.getByRole("radio", { name: "Quantity: Lowest" }).check();
  await dialog.getByRole("button", { name: "Apply" }).click();
  await expect(sort).toBeFocused();
  await expectSortLabel(sort, "Quantity: Lowest", false);
  await expect.poll(() => api.queries.length).toBe(initialRequests + 1);
  expect(JSON.parse(api.queries.at(-1)?.get("sort") ?? "null")).toEqual(
    choices[6].sort,
  );
  await sort.click();
  await dialog.getByRole("radio", { name: "Added: Newest" }).check();
  await dialog.getByRole("button", { name: "Apply" }).click();
  await expectSortLabel(sort, "Added: Newest", false);
  await expect.poll(() => api.queries.length).toBe(initialRequests + 2);
  expect(JSON.parse(api.queries.at(-1)?.get("sort") ?? "null")).toEqual([]);
  await sort.click();
  await dialog.getByRole("button", { name: "Apply" }).click();
  await expect(sort).toBeFocused();
  await expectSortLabel(sort, "Added: Newest", false);
  expect(api.queries).toHaveLength(initialRequests + 2);
});

async function verifyResponsiveSortLabels(page: Page, width: number) {
  const desktop = width >= 768;
  await page.setViewportSize({ width, height: 800 });
  const api = await foodApi(page, [milk]);
  await page.goto("/pantry");
  if (desktop) {
    await expect(nameCells(page)).toHaveText(["Milk"]);
  } else {
    await expect(
      page.getByRole("list", { name: "Food inventory" }),
    ).toBeVisible();
  }
  const sort = page.getByRole("button", {
    name: desktop ? /^Sort:/ : /^Sort by:/,
  });
  const filter = page.getByRole("button", { name: "Filter", exact: true });
  const search = page.getByRole("searchbox", { name: "Search food items" });
  const add = page.getByRole("button", { name: "Add item" });
  const menu = page.getByRole("menu", { name: "Sort pantry items" });
  const dialog = page.getByRole("dialog", { name: "Sort items" });
  await expectSortLabel(sort, choices[0].label, desktop);
  await expect(sort.locator("svg").first()).toBeVisible();
  await expectSortLayout(page, sort, filter);
  const order = desktop ? [sort, filter, add] : [add, sort, filter];
  await search.focus();
  for (const control of order) {
    await page.keyboard.press("Tab");
    await expect(control).toBeFocused();
  }
  for (const control of [search, ...order.slice(0, -1)].reverse()) {
    await page.keyboard.press("Shift+Tab");
    await expect(control).toBeFocused();
  }
  for (const choice of choices.slice(1)) {
    await sort.click();
    if (desktop) {
      await menu
        .getByRole("menuitemradio", { name: choice.label, exact: true })
        .click();
    } else {
      await dialog
        .getByRole("radio", { name: choice.label, exact: true })
        .check();
      await dialog.getByRole("button", { name: "Apply" }).click();
    }
    await expectSortLabel(sort, choice.label, desktop);
    await expect
      .poll(() => JSON.parse(api.queries.at(-1)?.get("sort") ?? "null"))
      .toEqual(choice.sort);
    await expectSortLayout(page, sort, filter);
  }
}

for (const width of [320, 375, 390, 440, 768, 1280]) {
  test(`all applied Sort labels fit the toolbar at ${width}px`, async ({
    page,
  }) => {
    await verifyResponsiveSortLabels(page, width);
    await expect(
      page.getByRole("button", { name: /^Sort(?: by)?: Unit: Z to A$/ }),
    ).toBeVisible();
  });
}
