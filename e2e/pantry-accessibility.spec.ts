import { expect } from "@playwright/test";
import {
  expectAccessible,
  foodApi,
  milk,
  nameCells,
  test,
} from "./fixtures/pantry";

test("table, filter dialog, editor, and confirmation are keyboard accessible", async ({
  page,
}) => {
  await foodApi(page, [milk]);
  await page.goto("/pantry");
  await expect(nameCells(page)).toHaveText(["Milk"]);
  await expectAccessible(page);
  const sort = page.getByRole("button", { name: "Sort: Added: Newest" });
  await sort.click();
  await expect(
    page
      .getByRole("group", { name: "Sort pantry items" })
      .getByRole("radio", { name: "Added: Newest" }),
  ).toBeFocused();
  await expectAccessible(page);
  await page.keyboard.press("Escape");
  await expect(sort).toBeFocused();
  await expect(sort).toHaveAttribute("aria-expanded", "false");
  const filter = page.getByRole("button", { name: "Filter", exact: true });
  await filter.click();
  await expectAccessible(page);
  await page.keyboard.press("Escape");
  await expect(filter).toBeFocused();
  await page.getByRole("button", { name: "Edit Milk" }).click();
  await expect(
    page.getByRole("dialog", { name: "Edit item" }).getByLabel(/^Food name/),
  ).toBeFocused();
  await expectAccessible(page);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Delete Milk" }).click();
  await expectAccessible(page);
});

test("mobile list and action menu fit a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 600 });
  await foodApi(page, [
    {
      ...milk,
      name: "A pantry item with a very long name that must wrap cleanly on a narrow phone",
    },
  ]);
  await page.goto("/pantry");
  await expect(
    page.getByRole("list", { name: "Food inventory" }).getByRole("listitem"),
  ).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expectAccessible(page);
  await page.getByRole("button", { name: /Actions for A pantry item/ }).click();
  await expect(
    page.getByRole("button", { name: "Edit", exact: true }),
  ).toBeVisible();
  await expectAccessible(page);
  await page.keyboard.press("Escape");
  const sort = page.getByRole("button", { name: "Sort", exact: true });
  await sort.click();
  await expectAccessible(page);
  await page.keyboard.press("Escape");
  await expect(sort).toBeFocused();
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await page.getByRole("checkbox", { name: /Select A pantry item/ }).check();
  await expectAccessible(page);
});

test("empty state and recovery pages remain accessible", async ({ page }) => {
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
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expectAccessible(page);
  }
});

for (const { width, sortName, actionOrder } of [
  {
    width: 1280,
    sortName: "Sort: Added: Newest",
    actionOrder: ["sort", "filter", "add"],
  },
  { width: 390, sortName: "Sort", actionOrder: ["add", "sort", "filter"] },
] as const) {
  test(`pantry toolbar follows the visible keyboard order at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await foodApi(page, [milk]);
    await page.goto("/pantry");
    await expect(nameCells(page)).toHaveText(["Milk"]);

    const search = page.getByRole("searchbox", { name: "Search food items" });
    const clear = page.getByRole("button", { name: "Clear search" });
    const add = page.getByRole("button", { name: "Add item" });
    const sort = page.getByRole("button", { name: sortName, exact: true });
    const filter = page.getByRole("button", { name: "Filter", exact: true });
    const actions = actionOrder.map(
      (action) => ({ sort, filter, add })[action],
    );

    await expect(add).toHaveCount(1);
    await search.focus();
    for (const action of actions) {
      await page.keyboard.press("Tab");
      await expect(action).toBeFocused();
    }
    for (const action of [search, ...actions.slice(0, -1)].reverse()) {
      await page.keyboard.press("Shift+Tab");
      await expect(action).toBeFocused();
    }

    await search.fill("mi");
    await expect(clear).toBeVisible();
    await search.focus();
    await page.keyboard.press("Tab");
    await expect(clear).toBeFocused();
    for (const action of actions) {
      await page.keyboard.press("Tab");
      await expect(action).toBeFocused();
    }
    for (const action of [clear, ...actions.slice(0, -1)].reverse()) {
      await page.keyboard.press("Shift+Tab");
      await expect(action).toBeFocused();
    }
    await page.keyboard.press("Shift+Tab");
    await expect(search).toBeFocused();
  });
}
