import { expect, type Route } from "@playwright/test";

import {
  bananas,
  expectAccessible,
  foodApi,
  milk,
  nameCells,
  requireGeometry,
  rice,
  test,
} from "./fixtures/pantry";

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
