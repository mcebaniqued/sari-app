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
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  await expectAccessible(page);
  await page.keyboard.press("Escape");
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
