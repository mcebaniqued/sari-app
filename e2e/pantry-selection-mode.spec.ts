import { expect, type Page } from "@playwright/test";
import {
  bananas,
  expectAccessible,
  foodApi,
  milk,
  rice,
  test,
} from "./fixtures/pantry";

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

async function verifyMobileSelectionMode(page: Page, width: number) {
  await page.setViewportSize({ width, height: 700 });
  const api = await foodApi(page, [milk, rice, bananas]);
  await page.goto("/pantry");
  const list = page.getByRole("list", { name: "Food inventory" });
  await expect(list.getByRole("listitem")).toHaveCount(3);
  const heading = page.getByRole("heading", { level: 1, name: "My Pantry" });
  const select = page.getByRole("button", { name: "Select", exact: true });
  const count = page.getByText("3 items", { exact: true });
  await expect(heading).toBeVisible();
  await expect(select).toBeVisible();
  await expect(count).toBeVisible();
  const headingBounds = await heading.boundingBox();
  const selectBounds = await select.boundingBox();
  expect(
    Math.abs(
      (headingBounds?.y ?? 0) +
        (headingBounds?.height ?? 0) / 2 -
        (selectBounds?.y ?? 0) -
        (selectBounds?.height ?? 0) / 2,
    ),
  ).toBeLessThan(3);
  expect(selectBounds?.width).toBeGreaterThanOrEqual(44);
  expect(selectBounds?.height).toBeGreaterThanOrEqual(44);
  const inventory = page.getByRole("region", { name: "Food inventory" });
  await expect(
    inventory.getByRole("button", { name: "Select", exact: true }),
  ).toHaveCount(0);
  const initialRequests = api.queries.length;
  await select.focus();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("searchbox", { name: "Search food items" }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(select).toBeFocused();
  await page.keyboard.press("Enter");
  const selectedHeading = page.getByRole("heading", {
    level: 1,
    name: "0 selected",
  });
  const done = page.getByRole("button", { name: "Done selecting" });
  const actions = page.getByRole("toolbar", { name: "Selected items" });
  await expect(selectedHeading).toBeVisible();
  await expect(selectedHeading).toHaveAttribute("aria-live", "polite");
  await expect(done).toBeFocused();
  await expect(done).toHaveCSS("outline-width", "2px");
  await expect(page.getByRole("heading", { name: "My Pantry" })).toHaveCount(0);
  await expect(
    page.getByRole("searchbox", { name: "Search food items" }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add item" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Sort/ })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Filter", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("0 selected", { exact: true })).toHaveCount(1);
  await expect(count).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Sari" })).toBeVisible();
  await expect(actions).toBeVisible();
  const buttons = await actions.getByRole("button").all();
  const bounds = await Promise.all(
    buttons.map((button) => button.boundingBox()),
  );
  expect(bounds.every((box) => (box?.height ?? 0) >= 44)).toBe(true);
  expect(
    bounds.every(
      (box, index) =>
        index === 0 ||
        (bounds[index - 1]?.x ?? 0) + (bounds[index - 1]?.width ?? 0) <=
          (box?.x ?? 0),
    ),
  ).toBe(true);
  await done.focus();
  await page.keyboard.press("Tab");
  await expect(
    list.getByRole("checkbox", { name: "Select Milk" }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(done).toBeFocused();
  expect(api.queries).toHaveLength(initialRequests);
  await list.getByRole("checkbox", { name: "Select Milk" }).focus();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("heading", { level: 1, name: "1 selected" }),
  ).toBeVisible();
  await expect(
    list.getByRole("checkbox", { name: "Select Milk" }),
  ).toBeChecked();
  await actions.getByRole("button", { name: "Clear" }).click();
  await expect(selectedHeading).toBeVisible();
  await expect(
    actions.getByRole("button", { name: "Select all" }),
  ).toBeFocused();
  await expect(
    actions.getByRole("button", { name: "Delete (0)" }),
  ).toBeDisabled();
  await expect(
    list.getByRole("checkbox", { name: "Select Milk" }),
  ).not.toBeChecked();
  await done.click();
  await expect(select).toBeFocused();
  await expect(heading).toBeVisible();
  await expect(count).toBeVisible();
  await expect(actions).toHaveCount(0);
  await expect(list.getByRole("checkbox")).toHaveCount(0);
  await expect(
    list.getByRole("button", { name: "Actions for Milk" }),
  ).toBeVisible();
  expect(api.queries).toHaveLength(initialRequests);
  await expectNoHorizontalOverflow(page);
}

for (const width of [320, 375, 390, 440]) {
  test(`mobile contextual selection replaces Pantry controls at ${width}px`, async ({
    page,
  }) => {
    await verifyMobileSelectionMode(page, width);
    await expect(
      page.getByRole("heading", { level: 1, name: "My Pantry" }),
    ).toBeVisible();
  });
}

test("mobile contextual selection has no automated accessibility violations", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await foodApi(page, [milk]);
  await page.goto("/pantry");
  await expect(
    page.getByRole("list", { name: "Food inventory" }).getByRole("listitem"),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await expectAccessible(page);
  await page.getByRole("checkbox", { name: "Select Milk" }).check();
  await expectAccessible(page);
});

test("mobile contextual header and bottom actions stay usable during long scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 500 });
  const items = Array.from({ length: 40 }, (_, index) => ({
    ...milk,
    id: index.toString(16).padStart(24, "0"),
    name: `Food ${index + 1}`,
  }));
  const api = await foodApi(page, items);
  await page.goto("/pantry");
  const list = page.getByRole("list", { name: "Food inventory" });
  await expect(list.getByRole("listitem")).toHaveCount(20);
  await page.getByRole("button", { name: "Select", exact: true }).click();
  const done = page.getByRole("button", { name: "Done selecting" });
  const actions = page.getByRole("toolbar", { name: "Selected items" });
  const selectLoaded = actions.getByRole("button", { name: "Select loaded" });
  await expect(selectLoaded).toBeVisible();
  await selectLoaded.click();
  await expect(
    page.getByRole("heading", { level: 1, name: "20 selected" }),
  ).toBeVisible();
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  await expect(list.getByRole("listitem")).toHaveCount(40);
  await expect(
    page.getByRole("heading", { level: 1, name: "20 selected" }),
  ).toBeVisible();
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  const globalHeader = page.locator("header").first();
  const barBounds = await actions.boundingBox();
  const lastItemBounds = await list.getByRole("listitem").last().boundingBox();
  await expect
    .poll(async () => {
      const globalBounds = await globalHeader.boundingBox();
      const contextualBounds = await done.locator("..").boundingBox();
      return (
        (contextualBounds?.y ?? 0) -
        Math.max(0, (globalBounds?.y ?? 0) + (globalBounds?.height ?? 0))
      );
    })
    .toBeGreaterThanOrEqual(-1);
  await expect(done).toBeInViewport();
  await expect(actions).toBeInViewport();
  expect(
    (lastItemBounds?.y ?? 0) + (lastItemBounds?.height ?? 0),
  ).toBeLessThanOrEqual((barBounds?.y ?? 0) + 1);
  await actions.getByRole("button", { name: "Select all" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "40 selected" }),
  ).toBeVisible();
  const beforeDone = await page.evaluate(() => ({
    y: scrollY,
    max: document.documentElement.scrollHeight - innerHeight,
  }));
  await done.click();
  await expect(
    page.getByRole("button", { name: "Select", exact: true }),
  ).toBeFocused();
  const afterDone = await page.evaluate(() => ({
    y: scrollY,
    max: document.documentElement.scrollHeight - innerHeight,
  }));
  expect(
    Math.abs(afterDone.y - beforeDone.y),
    JSON.stringify({ beforeDone, afterDone }),
  ).toBeLessThan(100);
  expect(api.queries).toHaveLength(2);
  await expectNoHorizontalOverflow(page);
});

test("mobile bulk deletion restores focus to contextual controls, including an empty pantry", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 700 });
  const api = await foodApi(page, [milk, rice]);
  await page.goto("/pantry");
  await expect(
    page.getByRole("list", { name: "Food inventory" }).getByRole("listitem"),
  ).toHaveCount(2);
  await page.getByRole("button", { name: "Select", exact: true }).click();
  const done = page.getByRole("button", { name: "Done selecting" });
  const actions = page.getByRole("toolbar", { name: "Selected items" });
  await actions.getByRole("button", { name: "Select all" }).click();
  await actions.getByRole("button", { name: "Delete (2)" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete 2 items?" });
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(
    actions.getByRole("button", { name: "Delete (2)" }),
  ).toBeFocused();
  await actions.getByRole("button", { name: "Delete (2)" }).click();
  await dialog.getByRole("button", { name: "Confirm delete" }).click();
  await expect(
    page.getByRole("list", { name: "Food inventory" }).getByRole("listitem"),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 1, name: "0 selected" }),
  ).toBeVisible();
  await expect(done).toBeFocused();
  await done.click();
  await expect(
    page.getByRole("button", { name: "Select", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add item" })).toBeFocused();
  expect(api.deleted).toEqual([milk.id, rice.id]);
});

test("mobile partial bulk deletion keeps dialog focus and restores Done after cancellation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 700 });
  const api = await foodApi(page, [milk, rice], rice.id);
  await page.goto("/pantry");
  await expect(
    page.getByRole("list", { name: "Food inventory" }).getByRole("listitem"),
  ).toHaveCount(2);
  await page.getByRole("button", { name: "Select", exact: true }).click();
  const done = page.getByRole("button", { name: "Done selecting" });
  const actions = page.getByRole("toolbar", { name: "Selected items" });
  await actions.getByRole("button", { name: "Select all" }).click();
  await actions.getByRole("button", { name: "Delete (2)" }).click();
  await page
    .getByRole("dialog", { name: "Delete 2 items?" })
    .getByRole("button", { name: "Confirm delete" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Delete item?" });
  await expect(dialog.getByRole("alert")).toContainText(
    "1 item could not be deleted",
  );
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "0 selected" }),
  ).toBeVisible();
  await expect(done).toBeFocused();
  await expect(
    page.getByRole("list", { name: "Food inventory" }).getByRole("listitem"),
  ).toHaveCount(1);
  expect(api.deleted).toEqual([milk.id, rice.id]);
});

for (const width of [768, 1280]) {
  test(`desktop selection keeps its heading and toolbar at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 700 });
    await foodApi(page, [milk]);
    await page.goto("/pantry");
    await expect(
      page.getByRole("table", { name: "Food inventory" }),
    ).toBeVisible();
    await page.getByRole("checkbox", { name: "Select Milk" }).check();
    await expect(
      page.getByRole("heading", { level: 1, name: "My Pantry" }),
    ).toBeVisible();
    await expect(
      page.getByRole("searchbox", { name: "Search food items" }),
    ).toBeVisible();
    await expect(
      page.getByRole("toolbar", { name: "Selected items" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Done selecting" }),
    ).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });
}

test("selection focus stays on a visible control when switching between desktop and mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 700 });
  await foodApi(page, [milk]);
  await page.goto("/pantry");
  const desktopCheckbox = page.getByRole("checkbox", { name: "Select Milk" });
  await desktopCheckbox.check();
  await expect(desktopCheckbox).toBeFocused();
  await page.setViewportSize({ width: 390, height: 700 });
  const done = page.getByRole("button", { name: "Done selecting" });
  await expect(done).toBeFocused();
  await expect(
    page.getByRole("heading", { level: 1, name: "1 selected" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 768, height: 700 });
  await expect(
    page.getByRole("checkbox", { name: "Select all loaded items" }),
  ).toBeFocused();
  await expect(
    page.getByRole("heading", { level: 1, name: "My Pantry" }),
  ).toBeVisible();
});

test.describe("touch input", () => {
  test.use({ hasTouch: true });

  test("can enter, select, clear, and exit mobile selection", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await foodApi(page, [milk]);
    await page.goto("/pantry");
    await expect(
      page.getByRole("list", { name: "Food inventory" }).getByRole("listitem"),
    ).toHaveCount(1);
    await page.getByRole("button", { name: "Select", exact: true }).tap();
    await page.getByRole("checkbox", { name: "Select Milk" }).tap();
    await expect(
      page.getByRole("heading", { level: 1, name: "1 selected" }),
    ).toBeVisible();
    await page
      .getByRole("toolbar", { name: "Selected items" })
      .getByRole("button", { name: "Clear" })
      .tap();
    await expect(
      page.getByRole("heading", { level: 1, name: "0 selected" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Done selecting" }).tap();
    await expect(
      page.getByRole("heading", { level: 1, name: "My Pantry" }),
    ).toBeVisible();
  });
});
