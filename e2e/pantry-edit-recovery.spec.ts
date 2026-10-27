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

async function conflictingEditApi(page: Page) {
  await foodApi(page, [linkedMilk]);
  await productApi(page);
  const patches: Array<{
    expectedRevision: number;
    changes: Partial<FoodItem>;
  }> = [];
  await page.route(`**/api/v1/food-items/${linkedMilk.id}`, async (route) => {
    const request = route.request();
    if (request.method() === "PATCH") {
      const body = request.postDataJSON() as (typeof patches)[number];
      patches.push(body);
      if (patches.length === 1) {
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
          ...newerMilk,
          ...body.changes,
          revision: newerMilk.revision + 1,
        },
      });

      return;
    }

    await route.fulfill({ json: newerMilk });
  });

  return patches;
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
  const patches = await conflictingEditApi(page);
  await page.goto("/pantry");
  await page.getByRole("button", { name: "Edit Milk" }).click();
  const edit = page.getByRole("dialog", { name: "Edit item" });
  await edit.getByLabel(/^Food name/).fill("My oat milk");
  await edit.getByLabel(/^Quantity/).fill("4");
  await edit.getByRole("button", { name: "Save changes" }).click();
  await edit.getByRole("button", { name: "Review newer data" }).click();

  const recovery = edit.getByRole("alert");
  await expect(
    recovery.getByRole("heading", { name: "Your draft" }),
  ).toBeVisible();
  await expect(recovery).toContainText(`Barcode ${usdaOats.barcode}`);
  await expect(recovery).toContainText(`Product ID ${usdaOats.id}`);
  await expect(recovery).toContainText(`Barcode ${newerProduct.barcode}`);
  await expect(recovery).toContainText(`Product ID ${newerProduct.id}`);
  await expect(recovery).toContainText(
    "the next Save changes will replace every newer saved value",
  );

  await recovery
    .getByRole("button", { name: "Overwrite saved version with my draft" })
    .click();
  const save = edit.getByRole("button", { name: "Save changes" });
  await expect(save).toBeFocused();
  await expect(edit.getByLabel(/^Food name/)).toHaveValue("My oat milk");
  await expect(edit.getByLabel(/^Quantity/)).toHaveValue("4");
  await save.click();
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

test("Use newer version replaces the draft and restores field focus", async ({
  page,
}) => {
  const patches = await conflictingEditApi(page);
  await page.goto("/pantry");
  await page.getByRole("button", { name: "Edit Milk" }).click();
  const edit = page.getByRole("dialog", { name: "Edit item" });
  await edit.getByLabel(/^Food name/).fill("My oat milk");
  await edit.getByRole("button", { name: "Save changes" }).click();
  await edit.getByRole("button", { name: "Review newer data" }).click();
  await edit.getByRole("button", { name: "Use newer saved version" }).click();

  await expect(edit.getByLabel(/^Food name/)).toHaveValue("Server milk");
  await expect(edit.getByLabel(/^Food name/)).toBeFocused();
  await expect(edit.getByLabel(/^Quantity/)).toHaveValue("3");
  await expect(edit).toContainText(`Barcode: ${newerProduct.barcode}`);
  await edit.getByRole("button", { name: "Cancel" }).click();
  await expect(edit).toHaveCount(0);
  expect(patches).toHaveLength(1);
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

  await expect(edit.getByRole("alert")).toContainText(
    "The save outcome is unknown",
  );
  expect(patchCount).toBe(1);
  await edit
    .getByRole("button", { name: "Overwrite saved version with my draft" })
    .click();
  const save = edit.getByRole("button", { name: "Save changes" });
  await expect(save).toBeFocused();
  expect(patchCount).toBe(1);
  await save.click();
  await expect(edit).toHaveCount(0);
  expect(patchCount).toBe(2);
});
