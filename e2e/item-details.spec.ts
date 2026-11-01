import { expect } from "@playwright/test";
import { foodApi, milk, rice, test } from "./fixtures/pantry";

const additionalItems = Array.from({ length: 24 }, (_, index) => ({
  ...rice,
  id: (index + 10).toString(16).padStart(24, "0"),
  name: `Pantry item ${index + 1}`,
}));

test("contextual details preserve Pantry state through Back and Forward", async ({
  page,
}) => {
  const api = await foodApi(page, [milk, rice, ...additionalItems]);
  await page.goto("/pantry");
  const target = additionalItems[10]!;
  const table = page.getByRole("table", { name: "Food inventory" });
  const search = page.getByRole("searchbox", { name: "Search food items" });
  await search.fill("Pantry");
  const opener = table.getByRole("button", {
    name: target.name,
    exact: true,
  });
  const selected = table.getByRole("checkbox", {
    name: `Select ${target.name}`,
  });
  const scroller = page.getByTestId("desktop-inventory-scroll");
  await expect.poll(() => api.queries.at(-1)?.get("search")).toBe("Pantry");
  await scroller.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(
    table.getByRole("button", { name: "Pantry item 24", exact: true }),
  ).toBeVisible();
  await selected.check();
  await scroller.evaluate((element) => {
    element.scrollTop = 160;
  });
  const scrollBefore = await scroller.evaluate((element) => element.scrollTop);
  expect(scrollBefore).toBeGreaterThan(0);
  await opener.click();

  await expect(page).toHaveURL(`/pantry/items/${target.id}`);
  const dialog = page.getByRole("dialog", { name: target.name });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("No date").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "My Pantry" })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL("/pantry");
  await expect(dialog).toHaveCount(0);
  await expect(selected).toBeChecked();
  await expect(opener).toBeFocused();
  await expect(search).toHaveValue("Pantry");
  await expect(
    table.getByRole("button", { name: "Pantry item 24", exact: true }),
  ).toBeVisible();
  expect(await scroller.evaluate((element) => element.scrollTop)).toBe(
    scrollBefore,
  );

  await page.goForward();
  await expect(page.getByRole("dialog", { name: target.name })).toBeVisible();
  await page.goBack();
});

test("cached details remain visible through verification failure and Retry", async ({
  page,
}) => {
  await foodApi(page, [milk]);
  let failVerification = true;
  await page.route(`**/api/v1/food-items/${milk.id}`, async (route) => {
    if (failVerification) {
      await route.fulfill({
        status: 422,
        json: {
          error: {
            code: "DATABASE_UNAVAILABLE",
            message: "Verification is temporarily unavailable.",
          },
        },
      });

      return;
    }
    await route.fulfill({
      json: { ...milk, name: "Fresh milk", revision: milk.revision + 1 },
    });
  });
  await page.goto("/pantry");
  await page
    .getByRole("table", { name: "Food inventory" })
    .getByRole("button", { name: milk.name, exact: true })
    .click();

  const dialog = page.getByRole("dialog", { name: milk.name });
  await expect(
    dialog.getByText("Showing saved Pantry data.", { exact: false }),
  ).toBeVisible();
  await expect(dialog.getByText("Feb 29, 2028")).toBeVisible();
  failVerification = false;
  await dialog.getByRole("button", { name: "Retry verification" }).click();
  await expect(page.getByRole("dialog", { name: "Fresh milk" })).toBeVisible();
});

test("direct navigation and refresh render standalone safe states", async ({
  page,
}) => {
  await foodApi(page, [milk]);
  await page.goto(`/pantry/items/${milk.id}`);

  const heading = page.getByRole("heading", { name: milk.name });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Back to pantry" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: milk.name })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.goto("/pantry/items/not-an-id");
  await expect(page.getByText("This item link is invalid.")).toBeVisible();
  await page.goto("/pantry/items/ffffffffffffffffffffffff");
  await expect(
    page.getByRole("heading", { name: "Item unavailable" }),
  ).toBeVisible();
});

test("mobile details are full-screen while selection mode remains independent", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await foodApi(page, [milk, rice]);
  await page.goto("/pantry");
  const list = page.getByRole("list", { name: "Food inventory" });
  const milkCard = list
    .getByRole("listitem")
    .filter({ hasText: milk.name })
    .getByRole("button", { name: `View details for ${milk.name}` });
  await milkCard.click();

  const dialog = page.getByRole("dialog", { name: milk.name });
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box?.x).toBe(0);
  expect(box?.y).toBe(0);
  expect(box?.width).toBe(390);
  expect(box?.height).toBe(700);
  await page.goBack();

  await page.getByRole("button", { name: "Select" }).click();
  await list
    .getByRole("button", { name: `Toggle selection for ${milk.name}` })
    .click();
  await expect(page).toHaveURL("/pantry");
  await expect(
    list.getByRole("checkbox", { name: `Select ${milk.name}` }),
  ).toBeChecked();
});
