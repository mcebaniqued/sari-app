import { expect } from "@playwright/test";
import { expectAccessible, foodApi, milk, rice, test } from "./fixtures/pantry";

test.use({ timezoneId: "America/Los_Angeles" });

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
  await opener.scrollIntoViewIfNeeded();
  const scrollBefore = await scroller.evaluate((element) => element.scrollTop);
  expect(scrollBefore).toBeGreaterThan(0);
  await opener.click();

  await expect(page).toHaveURL(`/pantry/items/${target.id}`);
  const dialog = page.getByRole("dialog", { name: target.name });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("No date")).toBeVisible();
  await expect(dialog.locator("[data-modal-header-supporting]")).toHaveCount(0);
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
  const warning = dialog.getByRole("alert");
  expect(
    await warning.evaluate((element) => {
      const details = element.parentElement?.querySelector(
        'dl[aria-label="Item details"]',
      );

      return details
        ? (element.compareDocumentPosition(details) &
            Node.DOCUMENT_POSITION_FOLLOWING) !==
            0
        : false;
    }),
  ).toBe(true);
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
  const metadata = page.locator('dl[aria-label="Item details"]');
  await expect(metadata.locator("dt")).toHaveText([
    "Quantity",
    "Expiration date",
    "Added",
    "Updated",
  ]);
  expect((await metadata.boundingBox())?.width ?? 0).toBeLessThanOrEqual(480);
  await expect(page.getByText("Feb 29, 2028")).toHaveCount(1);
  await expect(page.getByText("Oct 18, 2026, 5:00 PM PDT")).toHaveCount(2);
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
    .getByRole("button")
    .filter({ hasText: milk.name });
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
  await list.getByText(milk.name, { exact: true }).click();
  await expect(page).toHaveURL("/pantry");
  await expect(
    list.getByRole("checkbox", { name: `Select ${milk.name}` }),
  ).toBeChecked();
});

for (const viewport of [
  { width: 320, height: 450 },
  { width: 640, height: 360 },
]) {
  test(`long details header remains usable at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const longItem = {
      ...milk,
      name: "A very long pantry item name that wraps naturally beside Close and keeps saved information reachable below",
    };
    await foodApi(page, [longItem]);
    await page.goto("/pantry");
    const list = page.getByRole("list", { name: "Food inventory" });
    await list.getByRole("button").filter({ hasText: longItem.name }).click();

    const dialog = page.getByRole("dialog", { name: longItem.name });
    const header = dialog.locator("[data-modal-header]");
    const heading = dialog.getByRole("heading", { name: longItem.name });
    const close = dialog.getByRole("button", { name: "Close modal" });
    const supporting = header.locator("[data-modal-header-supporting]");
    const scrollRegion = dialog.locator("[data-modal-scroll-region]");
    const [headerBox, headingBox, closeBox, scrollBox] = await Promise.all([
      header.boundingBox(),
      heading.boundingBox(),
      close.boundingBox(),
      scrollRegion.boundingBox(),
    ]);

    expect(headerBox?.height ?? Infinity).toBeLessThanOrEqual(
      viewport.height / 2 + 1,
    );
    expect((headingBox?.x ?? 0) + (headingBox?.width ?? 0)).toBeLessThanOrEqual(
      closeBox?.x ?? 0,
    );
    expect(closeBox?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(closeBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(scrollBox?.height ?? 0).toBeGreaterThan(0);
    await expect(close).toBeVisible();
    await heading.locator("..").evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect(supporting).toBeVisible();
    await expect(close).toBeVisible();
    await expect(dialog.locator('dl[aria-label="Item details"]')).toBeVisible();
    expect(
      await dialog.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    await expectAccessible(page);
  });
}
