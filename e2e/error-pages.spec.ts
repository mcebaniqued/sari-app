import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, type Route, test } from "@playwright/test";
import type { FoodItem } from "@sari/contracts";

import { signedIn } from "./authFixture";

test.beforeEach(async ({ page }) => {
  await signedIn(page);
});

const item: FoodItem = {
  id: "012345678901234567890123",
  name: "Milk",
  quantity: 1,
  unit: "l",
  expiresOn: null,
  createdAt: "2026-10-19T00:00:00Z",
  updatedAt: "2026-10-19T00:00:00Z",
};

async function pantry(page: Page) {
  await page.route("**/api/v1/food-items**", (route) =>
    route.fulfill({
      json: { items: [item], total: 1, start: 0, limit: 20 },
    }),
  );
}

for (const { path, code, title } of [
  { path: "/does-not-exist", code: "404", title: "Page not found" },
  { path: "/access-denied", code: "403", title: "Access denied" },
]) {
  test(`${code} recovery works on direct visits, keyboard, and mobile`, async ({
    page,
  }, testInfo) => {
    await pantry(page);
    await page.goto(path);
    const heading = page.getByRole("heading", { name: title, exact: true });
    await expect(heading).toBeFocused();
    await expect(page).toHaveTitle(`${title} | Sari`);
    await expect(
      page.getByRole("navigation", { name: "Main navigation" }),
    ).toHaveCount(0);
    const desktopAxe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"])
      .analyze();
    expect(desktopAxe.violations).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`${code}-desktop.png`),
      fullPage: true,
    });

    await page.setViewportSize({ width: 375, height: 812 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const mobileAxe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"])
      .analyze();
    expect(mobileAxe.violations).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`${code}-mobile.png`),
      fullPage: true,
    });
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Back to pantry", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "Go back", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/pantry$/);
    await expect(
      page.getByRole("heading", { name: "My Pantry", exact: true }),
    ).toBeVisible();
    await expect(page).not.toHaveTitle(`${title} | Sari`);

    await page.goto(path);
    await page
      .getByRole("link", { name: "Back to pantry", exact: true })
      .click();
    await expect(page).toHaveURL(/\/pantry$/);
  });
}

test("Go back returns to the previous app page after a forbidden request", async ({
  page,
}) => {
  await page.route("**/api/v1/food-items**", (route) =>
    route.fulfill({
      status: 403,
      json: { error: { code: "FORBIDDEN", message: "Access denied." } },
    }),
  );
  await page.goto("/missing");
  await page.getByRole("link", { name: "Sari", exact: true }).click();
  await expect(page).toHaveURL(/\/access-denied$/);
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(page).toHaveURL(/\/missing$/);
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeFocused();
});

async function rejectMethod(page: Page, method: string) {
  let requests = 0;
  const handler = async (route: Route) => {
    if (route.request().method() !== method) {
      await route.fallback();
      return;
    }
    requests++;
    await route.fulfill({
      status: 403,
      json: { error: { code: "FORBIDDEN", message: "Access denied." } },
    });
  };
  await page.route("**/api/v1/food-items**", handler);
  return {
    count: () => requests,
    restore: () => page.unroute("**/api/v1/food-items**", handler),
  };
}
async function submitEditor(page: Page, open: string, submit: string) {
  await page.getByRole("button", { name: open, exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/^Food name/).fill("Oat milk");
  await dialog.getByRole("button", { name: submit, exact: true }).click();
}
const forbiddenScenarios = [
  { method: "GET", perform: () => Promise.resolve() },
  {
    method: "POST",
    perform: (page: Page) => submitEditor(page, "Add item", "Add item"),
  },
  {
    method: "PATCH",
    perform: (page: Page) => submitEditor(page, "Edit Milk", "Save changes"),
  },
  {
    method: "DELETE",
    perform: async (page: Page) => {
      await page
        .getByRole("button", { name: "Delete Milk", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Confirm delete", exact: true })
        .click();
    },
  },
];
for (const { method, perform } of forbiddenScenarios) {
  test(`forbidden ${method} requests open Access denied without retrying`, async ({
    page,
  }) => {
    await pantry(page);
    const denied = await rejectMethod(page, method);
    await page.goto("/pantry");
    await perform(page);
    await expect(page).toHaveURL(/\/access-denied$/);
    await expect(
      page.getByRole("heading", { name: "Access denied", exact: true }),
    ).toBeFocused();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(denied.count()).toBe(1);
    await denied.restore();
    await page
      .getByRole("link", { name: "Back to pantry", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Edit Milk", exact: true }),
    ).toBeVisible();
  });
}
