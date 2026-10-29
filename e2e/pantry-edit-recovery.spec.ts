import { expect, type Page } from "@playwright/test";
import type { FoodItem, FoodProduct } from "@sari/contracts";
import { foodApi, milk, test, usdaOats } from "./fixtures/pantry";

const newerProduct: FoodProduct = {
  ...usdaOats,
  id: "512345678901234567890123",
  barcode: "00000096385074",
  name: "Server oats",
  externalId: "67890",
  sourceUrl: "https://fdc.nal.usda.gov/food-details/67890/nutrients",
};

const linkedMilk: FoodItem = {
  ...milk,
  productId: usdaOats.id,
  barcode: usdaOats.barcode,
};

const newerMilk: FoodItem = {
  ...linkedMilk,
  name: "Server milk",
  quantity: 3,
  expiresOn: "2028-03-15",
  productId: newerProduct.id,
  barcode: newerProduct.barcode,
  revision: 1,
  updatedAt: "2026-10-19T00:01:00Z",
};

async function productApi(page: Page) {
  await page.route("**/api/v1/food-products/*", async (route) => {
    await route.fulfill({
      json: route.request().url().endsWith(newerProduct.id)
        ? newerProduct
        : usdaOats,
    });
  });
}

async function conflictingEditApi(page: Page, conflictAfterReview = false) {
  await foodApi(page, [linkedMilk]);
  await productApi(page);
  let current = newerMilk;
  const patches: Array<{
    expectedRevision: number;
    changes: Partial<FoodItem>;
  }> = [];
  await page.route(`**/api/v1/food-items/${linkedMilk.id}`, async (route) => {
    const request = route.request();
    if (request.method() === "PATCH") {
      const body = request.postDataJSON() as (typeof patches)[number];
      patches.push(body);
      if (patches.length === 1 || conflictAfterReview) {
        await route.fulfill({
          status: 409,
          json: {
            error: {
              code: "FOOD_ITEM_REVISION_CONFLICT",
              message: "This pantry item changed since it was loaded.",
            },
          },
        });

        return;
      }

      await route.fulfill({
        json: {
          ...current,
          ...body.changes,
          revision: current.revision + 1,
        },
      });

      return;
    }

    await route.fulfill({ json: current });
  });

  return {
    patches,
    get current() {
      return current;
    },
    updateCurrent(next: FoodItem) {
      current = next;
    },
  };
}

test("dirty Edit blocks in-app navigation", async ({ page }) => {
  await foodApi(page, [milk]);
  await page.goto("/pantry");
  await page.getByRole("button", { name: "Edit Milk" }).click();
  const edit = page.getByRole("dialog", { name: "Edit item" });
  const name = edit.getByLabel(/^Food name/);
  await name.fill("Oat milk");

  await page.getByRole("link", { name: "Sari" }).evaluate((link) => {
    (link as HTMLElement).click();
  });
  const confirmation = page.getByRole("dialog", { name: "Discard changes?" });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "Continue editing" }).click();
  await expect(name).toHaveValue("Oat milk");
  await expect(page).toHaveURL(/\/pantry$/);
});

test("dirty Edit blocks browser Back navigation", async ({ page }) => {
  await foodApi(page, [milk]);
  await page.goto("/missing");
  await page.evaluate(() => {
    const state = history.state as { idx?: number } | null;
    const nextState = { ...state, idx: (state?.idx ?? 0) + 1 };
    history.pushState(nextState, "", "/pantry");
    window.dispatchEvent(new PopStateEvent("popstate", { state: nextState }));
  });
  await expect(page).toHaveURL(/\/pantry$/);
  await expect(page.getByRole("heading", { name: "My Pantry" })).toBeVisible();
  await page.getByRole("button", { name: "Edit Milk" }).click();
  await page
    .getByRole("dialog", { name: "Edit item" })
    .getByLabel(/^Food name/)
    .fill("Oat milk");

  await page.evaluate(() => history.back());
  const confirmation = page.getByRole("dialog", { name: "Discard changes?" });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "Discard changes" }).click();
  await expect(page).toHaveURL(/\/missing$/);
});

test("dirty Edit blocks browser Forward navigation", async ({ page }) => {
  await foodApi(page, [milk]);
  await page.goto("/pantry");
  await page.evaluate(() => {
    const state = history.state as { idx?: number } | null;
    const nextState = { ...state, idx: (state?.idx ?? 0) + 1 };
    history.pushState(nextState, "", "/missing");
    window.dispatchEvent(new PopStateEvent("popstate", { state: nextState }));
  });
  await expect(page).toHaveURL(/\/missing$/);
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
  await page.evaluate(() => {
    history.back();
  });
  await expect(page).toHaveURL(/\/pantry$/);
  await expect(page.getByRole("heading", { name: "My Pantry" })).toBeVisible();
  await page.getByRole("button", { name: "Edit Milk" }).click();
  await page
    .getByRole("dialog", { name: "Edit item" })
    .getByLabel(/^Food name/)
    .fill("Oat milk");

  await page.evaluate(() => history.forward());
  const confirmation = page.getByRole("dialog", { name: "Discard changes?" });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "Discard changes" }).click();
  await expect(page).toHaveURL(/\/missing$/);
});

test("conflict review identifies both products and explicitly overwrites with the draft", async ({
  page,
}) => {
  const { patches } = await conflictingEditApi(page);
  await page.goto("/pantry");
  await page.getByRole("button", { name: "Edit Milk" }).click();
  const edit = page.getByRole("dialog", { name: "Edit item" });
  await edit.getByLabel(/^Food name/).fill("My oat milk");
  await edit.getByLabel(/^Quantity/).fill("4");
  await edit.getByRole("button", { name: "Save changes" }).click();
  await edit.getByRole("button", { name: "Review changes" }).click();

  const recovery = page.getByRole("dialog", { name: "Review changes" });
  await expect(recovery).toBeVisible();
  await expect(
    recovery.getByRole("heading", { name: "Review changes" }),
  ).toBeFocused();
  await page.mouse.click(5, 5);
  await expect(recovery).toBeVisible();
  await expect(recovery).toContainText(`Barcode ${usdaOats.barcode}`);
  await expect(recovery).toContainText(`Product ID ${usdaOats.id}`);
  await expect(recovery).toContainText(`Barcode ${newerProduct.barcode}`);
  await expect(recovery).toContainText(`Product ID ${newerProduct.id}`);
  await expect(recovery).toContainText(
    "Overwriting replaces all saved item values with your draft, not just the fields you changed",
  );

  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const overwrite = recovery.getByRole("button", { name: "Overwrite saved" });
  await expect(overwrite).toBeFocused();
  expect(
    await overwrite.evaluate((element) => element.matches(":focus-visible")),
  ).toBe(true);
  await expect(overwrite).toHaveCSS("outline-style", "solid");
  await expect(overwrite).toHaveCSS("outline-width", "3px");
  await expect(overwrite).toHaveCSS("outline-offset", "2px");
  await page.keyboard.press("Enter");
  await expect(edit).toHaveCount(0);

  expect(patches).toHaveLength(2);
  expect(patches[1]).toEqual({
    expectedRevision: newerMilk.revision,
    changes: {
      name: "My oat milk",
      quantity: 4,
      unit: linkedMilk.unit,
      expiresOn: linkedMilk.expiresOn,
      productId: usdaOats.id,
      barcode: usdaOats.barcode,
    },
  });
});

test("Keep saved and close accepts the reviewed version without another PATCH", async ({
  page,
}) => {
  const { patches } = await conflictingEditApi(page);
  await page.goto("/pantry");
  await page.getByRole("button", { name: "Edit Milk" }).click();
  const edit = page.getByRole("dialog", { name: "Edit item" });
  await edit.getByLabel(/^Food name/).fill("My oat milk");
  await edit.getByRole("button", { name: "Save changes" }).click();
  await edit.getByRole("button", { name: "Review changes" }).click();
  await page
    .getByRole("dialog", { name: "Review changes" })
    .getByRole("button", { name: "Keep saved & close" })
    .click();

  await expect(edit).toHaveCount(0);
  await expect(
    page.getByRole("dialog", { name: "Discard changes?" }),
  ).toHaveCount(0);
  expect(patches).toHaveLength(1);
});

test("conflict review uses the stacked full-page layout on a narrow viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await conflictingEditApi(page);
  await page.goto("/pantry");
  await page.getByRole("button", { name: "Actions for Milk" }).click();
  await page.getByRole("button", { name: "Edit Milk" }).click();
  const edit = page.getByRole("dialog", { name: "Edit item" });
  await edit.getByLabel(/^Food name/).fill("My oat milk");
  await edit.getByRole("button", { name: "Save changes" }).click();
  await edit.getByRole("button", { name: "Review changes" }).click();

  const review = page.getByRole("dialog", { name: "Review changes" });
  const bounds = await review.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds?.x).toBe(0);
  expect(bounds?.y).toBe(0);
  expect(bounds?.width).toBe(390);
  expect(bounds?.height).toBe(844);
  await expect(review.getByRole("table")).toBeHidden();
  await expect(
    review.getByRole("button", { name: "Overwrite saved" }),
  ).toBeVisible();
  expect(
    await review.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
});

test("a change after review conflicts instead of overwriting the newer item", async ({
  page,
}) => {
  const conflict = await conflictingEditApi(page, true);
  await page.goto("/pantry");
  await page.getByRole("button", { name: "Edit Milk" }).click();
  const edit = page.getByRole("dialog", { name: "Edit item" });
  await edit.getByLabel(/^Food name/).fill("My oat milk");
  await edit.getByRole("button", { name: "Save changes" }).click();
  await edit.getByRole("button", { name: "Review changes" }).click();
  conflict.updateCurrent({
    ...newerMilk,
    name: "Second server update",
    revision: 2,
  });
  await page
    .getByRole("dialog", { name: "Review changes" })
    .getByRole("button", { name: "Overwrite saved" })
    .click();

  await expect(
    edit.getByRole("heading", { name: "A newer version is available" }),
  ).toBeFocused();
  await expect(edit.getByLabel(/^Food name/)).toHaveValue("My oat milk");
  expect(conflict.patches).toHaveLength(2);
  expect(conflict.patches[1]?.expectedRevision).toBe(newerMilk.revision);
  expect(conflict.current).toMatchObject({
    name: "Second server update",
    revision: 2,
  });
});

test("an uncertain save is not repeated until an explicit guarded retry", async ({
  page,
}) => {
  await foodApi(page, [milk]);
  let patchCount = 0;
  await page.route(`**/api/v1/food-items/${milk.id}`, async (route) => {
    if (route.request().method() === "PATCH") {
      patchCount++;
      if (patchCount === 1) {
        await route.fulfill({
          status: 503,
          json: {
            error: { code: "DATABASE_UNAVAILABLE", message: "Unavailable." },
          },
        });
      } else {
        const body = route.request().postDataJSON() as {
          changes: Partial<FoodItem>;
        };
        await route.fulfill({
          json: { ...milk, ...body.changes, revision: milk.revision + 1 },
        });
      }

      return;
    }

    await route.fulfill({ json: milk });
  });
  await page.goto("/pantry");
  await page.getByRole("button", { name: "Edit Milk" }).click();
  const edit = page.getByRole("dialog", { name: "Edit item" });
  await edit.getByLabel(/^Food name/).fill("Oat milk");
  await edit.getByRole("button", { name: "Save changes" }).click();

  await expect(
    edit.getByRole("heading", { name: "We couldn't confirm your save" }),
  ).toBeFocused();
  expect(patchCount).toBe(1);
  await edit.getByRole("button", { name: "Check saved version" }).click();
  const review = page.getByRole("dialog", { name: "Review saved version" });
  await expect(
    review.getByRole("heading", { name: "Review saved version" }),
  ).toBeFocused();
  await review.getByRole("button", { name: "Overwrite saved" }).click();
  await expect(edit).toHaveCount(0);
  expect(patchCount).toBe(2);
});

test("unavailable actions stay balanced with single-line copy feedback", async ({
  page,
}) => {
  await foodApi(page, [milk]);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.resolve() },
    });
  });
  await page.route(`**/api/v1/food-items/${milk.id}`, async (route) => {
    if (route.request().method() === "PATCH") {
      await route.fulfill({
        status: 404,
        json: {
          error: {
            code: "FOOD_ITEM_NOT_FOUND",
            message: "Food item not found.",
          },
        },
      });

      return;
    }

    await route.fallback();
  });
  await page.goto("/pantry");
  await page.getByRole("button", { name: "Edit Milk" }).click();
  const edit = page.getByRole("dialog", { name: "Edit item" });
  await edit.getByLabel(/^Food name/).fill("Oat milk");
  await edit.getByRole("button", { name: "Save changes" }).click();

  const unavailable = page.getByRole("dialog", { name: "Item unavailable" });
  const copy = unavailable.getByRole("button", { name: "Copy details" });
  const discard = unavailable.getByRole("button", {
    name: "Discard and close",
  });
  const copyBox = await copy.boundingBox();
  const discardBox = await discard.boundingBox();
  expect(copyBox).not.toBeNull();
  expect(discardBox).not.toBeNull();
  expect(
    Math.abs((copyBox?.width ?? 0) - (discardBox?.width ?? 0)),
  ).toBeLessThanOrEqual(2);
  expect(
    Math.abs((copyBox?.height ?? 0) - (discardBox?.height ?? 0)),
  ).toBeLessThanOrEqual(1);
  await expect(copy).toHaveCSS("white-space", "nowrap");
  await expect(discard).toHaveCSS("white-space", "nowrap");

  await copy.click();
  const copied = unavailable.getByRole("button", { name: "Copied" });
  const copiedBox = await copied.boundingBox();
  expect(copiedBox?.width).toBe(copyBox?.width);
  expect(copiedBox?.height).toBe(copyBox?.height);
  await expect(copied).toHaveCSS("white-space", "nowrap");

  await discard.click();
  await expect(unavailable).toHaveCount(0);
});
