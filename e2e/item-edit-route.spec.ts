import { expect } from "@playwright/test";
import type { FoodItem } from "@sari/contracts";
import { foodApi, milk, test } from "./fixtures/pantry";

test("Details Edit saves back to updated Details without reopening on Forward", async ({
  page,
}) => {
  await foodApi(page, [milk]);
  await page.goto("/pantry");
  await page
    .getByRole("table", { name: "Food inventory" })
    .getByRole("button", { name: milk.name, exact: true })
    .click();
  const details = page.getByRole("dialog", { name: milk.name });
  await details.getByRole("button", { name: "Edit" }).click();

  const editor = page.getByRole("dialog", { name: "Edit item" });
  await editor.getByLabel(/^Food name/).fill("Fresh milk");
  await editor.getByRole("button", { name: "Save changes" }).click();

  await expect(page).toHaveURL(`/pantry/items/${milk.id}`);
  const updatedDetails = page.getByRole("dialog", { name: "Fresh milk" });
  await expect(updatedDetails).toBeVisible();
  await expect(
    updatedDetails.getByRole("heading", { name: "Fresh milk" }),
  ).toBeFocused();
  await page.goForward();
  await expect(page).toHaveURL(`/pantry/items/${milk.id}`);
  await expect(page.getByRole("dialog", { name: "Fresh milk" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Edit item" })).toHaveCount(0);
});

test("seeded Pantry Edit opens immediately without an item-detail request", async ({
  page,
}) => {
  await foodApi(page, [milk]);
  let itemGets = 0;
  await page.route(`**/api/v1/food-items/${milk.id}`, async (route) => {
    itemGets++;
    await route.fallback();
  });
  await page.goto("/pantry");
  await page.getByRole("button", { name: "Edit Milk" }).click();

  await expect(page.getByLabel(/^Food name/)).toHaveValue("Milk");
  expect(itemGets).toBe(0);
});

test("Details Edit opens while background verification is pending", async ({
  page,
}) => {
  await foodApi(page, [milk]);
  let releaseItem: (() => void) | undefined;
  const itemReady = new Promise<void>((resolve) => {
    releaseItem = resolve;
  });
  let itemGets = 0;
  await page.route(`**/api/v1/food-items/${milk.id}`, async (route) => {
    itemGets++;
    await itemReady;
    await route.fallback();
  });
  await page.goto("/pantry");
  await page
    .getByRole("table", { name: "Food inventory" })
    .getByRole("button", { name: milk.name, exact: true })
    .click();
  const details = page.getByRole("dialog", { name: milk.name });
  const edit = details.getByRole("button", { name: "Edit" });

  await expect(edit).toBeEnabled();
  const readsBeforeEdit = itemGets;
  await edit.click();
  await expect(page.getByLabel(/^Food name/)).toHaveValue("Milk");
  expect(itemGets).toBe(readsBeforeEdit);
  releaseItem?.();
});

test("direct Edit refreshes independently and Cancel falls back to Details", async ({
  page,
}) => {
  await foodApi(page, [milk]);
  await page.goto(`/pantry/items/${milk.id}/edit`);

  const heading = page.getByRole("heading", { name: "Edit item" });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
  await expect(page.getByRole("dialog", { name: "Edit item" })).toHaveCount(0);
  await expect(page.getByLabel(/^Food name/)).toHaveValue(milk.name);
  await page.reload();
  await expect(page.getByLabel(/^Food name/)).toHaveValue(milk.name);

  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page).toHaveURL(`/pantry/items/${milk.id}`);
  await expect(page.getByRole("heading", { name: milk.name })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("direct Edit saves to updated standalone Details", async ({ page }) => {
  await foodApi(page, [milk]);
  await page.goto(`/pantry/items/${milk.id}/edit`);
  await page.getByLabel(/^Food name/).fill("Directly saved milk");
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page).toHaveURL(`/pantry/items/${milk.id}`);
  const heading = page.getByRole("heading", { name: "Directly saved milk" });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("direct Edit reports missing items and retries transient loading failures", async ({
  page,
}) => {
  let requests = 0;
  let allowSuccess = false;
  await page.route(`**/api/v1/food-items/${milk.id}`, async (route) => {
    requests++;
    if (!allowSuccess) {
      await route.fulfill({
        status: 503,
        json: {
          error: { code: "DATABASE_UNAVAILABLE", message: "Unavailable." },
        },
      });

      return;
    }

    await route.fulfill({ json: milk });
  });
  await page.goto(`/pantry/items/${milk.id}/edit`);
  await expect(
    page.getByRole("heading", { name: "Unable to edit item" }),
  ).toBeVisible();
  const requestsBeforeRetry = requests;
  allowSuccess = true;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByLabel(/^Food name/)).toHaveValue(milk.name);
  expect(requests).toBeGreaterThan(requestsBeforeRetry);

  await page.unroute(`**/api/v1/food-items/${milk.id}`);
  await foodApi(page, []);
  await page.goto(`/pantry/items/${milk.id}/edit`);
  await expect(
    page.getByRole("heading", { name: "Item unavailable" }),
  ).toBeFocused();
});

test("direct Edit shows its loading state and honors authorization failures", async ({
  page,
}) => {
  let releaseItem: (() => void) | undefined;
  const itemReady = new Promise<void>((resolve) => {
    releaseItem = resolve;
  });
  await page.route(`**/api/v1/food-items/${milk.id}`, async (route) => {
    await itemReady;
    await route.fulfill({ json: milk });
  });
  await page.goto(`/pantry/items/${milk.id}/edit`);
  await expect(page.getByText("Loading item for editing…")).toBeVisible();
  releaseItem?.();
  await expect(page.getByLabel(/^Food name/)).toHaveValue(milk.name);

  await page.unroute(`**/api/v1/food-items/${milk.id}`);
  await page.route(`**/api/v1/food-items/${milk.id}`, (route) =>
    route.fulfill({
      status: 403,
      json: { error: { code: "FORBIDDEN", message: "Access denied." } },
    }),
  );
  await page.goto(`/pantry/items/${milk.id}/edit`);
  await expect(page).toHaveURL(/\/access-denied$/);
  await expect(
    page.getByRole("heading", { name: "Access denied" }),
  ).toBeFocused();
});

test("mobile Edit scrolls naturally and keeps one draft through viewport changes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 500 });
  await foodApi(page, [milk]);
  await page.goto("/pantry");
  await page.getByRole("button", { name: "Actions for Milk" }).click();
  await page.getByRole("button", { name: "Edit Milk" }).click();

  const mobileEditor = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: "Edit item" }),
  });
  await expect(mobileEditor).toBeVisible();
  const bounds = await mobileEditor.boundingBox();
  expect(bounds).toMatchObject({ x: 0, y: 0, width: 390, height: 500 });
  await expect(page.getByRole("dialog", { name: "Edit item" })).toHaveCount(0);
  expect(
    await page
      .locator("[data-route-background]")
      .evaluate((element) =>
        element instanceof HTMLElement ? element.inert : false,
      ),
  ).toBe(true);
  expect(
    await page
      .locator("body")
      .evaluate((element) => element.classList.contains("overflow-hidden")),
  ).toBe(false);

  await mobileEditor.getByLabel(/^Food name/).fill("Viewport draft");
  await mobileEditor.getByLabel(/^Food name/).focus();
  await page.setViewportSize({ width: 1100, height: 700 });
  const desktopEditor = page.getByRole("dialog", { name: "Edit item" });
  await expect(desktopEditor.getByLabel(/^Food name/)).toHaveValue(
    "Viewport draft",
  );
  await expect(desktopEditor.getByLabel(/^Food name/)).toBeFocused();

  await page.setViewportSize({ width: 390, height: 500 });
  await expect(mobileEditor.getByLabel(/^Food name/)).toHaveValue(
    "Viewport draft",
  );
  await expect(mobileEditor.getByLabel(/^Food name/)).toBeFocused();
  const cancel = mobileEditor.getByRole("button", { name: "Cancel" });
  await cancel.scrollIntoViewIfNeeded();
  await expect(cancel).toBeInViewport();
  const overflow = await mobileEditor.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    scrollTop: element.scrollTop,
  }));
  expect(overflow.scrollHeight).toBeGreaterThan(overflow.clientHeight);
  expect(overflow.scrollTop).toBeGreaterThan(0);
});

test("fitting mobile Edit contains gestures and preserves Pantry scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const items: FoodItem[] = Array.from({ length: 20 }, (_, index) => ({
    ...milk,
    id: index.toString(16).padStart(24, "0"),
    name: index === 8 ? "Target milk" : `Pantry item ${index}`,
  }));
  await foodApi(page, items);
  await page.goto("/pantry");
  const actions = page.getByRole("button", { name: "Actions for Target milk" });
  await actions.scrollIntoViewIfNeeded();
  await actions.click();
  const pantryScroll = await page.evaluate(() => window.scrollY);
  await page.getByRole("button", { name: "Edit Target milk" }).click();
  const mobileEditor = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: "Edit item" }),
  });
  const fit = await mobileEditor.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));

  expect(fit.scrollHeight).toBeLessThanOrEqual(fit.clientHeight);
  await mobileEditor.hover();
  await page.mouse.wheel(0, 400);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBe(pantryScroll);
  expect(await mobileEditor.evaluate((element) => element.scrollTop)).toBe(0);

  await mobileEditor.getByRole("button", { name: "Cancel" }).click();
  await expect(actions).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(pantryScroll);
});
