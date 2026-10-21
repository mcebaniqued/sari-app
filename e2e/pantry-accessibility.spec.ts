import { expect } from "@playwright/test";
import {
  expectAccessible,
  foodApi,
  milk,
  nameCells,
  rice,
  test,
} from "./fixtures/pantry";

test("table, filter dialog, editor, and confirmation are keyboard accessible", async ({
  page,
}) => {
  await foodApi(page, [milk]);
  await page.goto("/pantry");
  await expect(nameCells(page)).toHaveText(["Milk"]);
  await expectAccessible(page);
  await expect(
    page.getByRole("group", { name: "Pantry actions" }),
  ).toBeVisible();
  const sort = page.getByRole("button", { name: /Sort:/ });
  await sort.click();
  await expect(
    page
      .getByRole("menu", { name: "Sort pantry items" })
      .getByRole("menuitemradio", { name: "Added: Newest" }),
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
    page.getByRole("button", { name: /Edit A pantry item/ }),
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

test("desktop sort navigation waits for deliberate selection", async ({
  page,
}) => {
  const api = await foodApi(page, [milk]);
  await page.goto("/pantry");
  await expect(nameCells(page)).toHaveText(["Milk"]);
  const initialRequests = api.queries.length;
  const sort = page.getByRole("button", { name: /Sort:/ });
  await sort.focus();
  await page.keyboard.press("Enter");
  await expect(sort).toHaveAttribute("aria-expanded", "true");
  const menu = page.getByRole("menu", { name: "Sort pantry items" });
  const applied = menu.getByRole("menuitemradio", { name: "Added: Newest" });
  await expect(applied).toBeFocused();
  await expect(applied).toHaveAttribute("aria-checked", "true");

  for (const label of [
    "Added: Oldest",
    "Expiration: Soonest",
    "Expiration: Latest",
    "Name: A to Z",
    "Name: Z to A",
    "Quantity: Lowest",
    "Quantity: Highest",
  ]) {
    await page.keyboard.press("ArrowDown");
    await expect(
      menu.getByRole("menuitemradio", { name: label }),
    ).toBeFocused();
    await expect(menu).toBeVisible();
  }
  await expect(applied).toHaveAttribute("aria-checked", "true");
  expect(api.queries).toHaveLength(initialRequests);
  await page.keyboard.press("Enter");
  await expect(menu).toHaveCount(0);
  await expect(sort).toBeFocused();
  await expect(sort).toHaveAttribute("aria-expanded", "false");
  await expect(sort).toHaveAccessibleName("Sort: Quantity: Highest");
  await expect.poll(() => api.queries.length).toBe(initialRequests + 1);
  expect(api.queries.at(-1)?.get("sort")).toContain('"quantity"');

  await page.keyboard.press("Space");
  await expect(
    menu.getByRole("menuitemradio", { name: "Quantity: Highest" }),
  ).toBeFocused();
  await page.keyboard.press("Home");
  await expect(applied).toBeFocused();
  await page.keyboard.press("End");
  await expect(
    menu.getByRole("menuitemradio", { name: "Unit: Z to A" }),
  ).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(
    menu.getByRole("menuitemradio", { name: "Unit: A to Z" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(sort).toBeFocused();
  await expect(sort).toHaveAccessibleName("Sort: Quantity: Highest");
  expect(api.queries).toHaveLength(initialRequests + 1);

  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowUp");
  await expect(
    menu.getByRole("menuitemradio", { name: "Quantity: Lowest" }),
  ).toBeFocused();
  await page.keyboard.press("Space");
  await expect(menu).toHaveCount(0);
  await expect(sort).toBeFocused();
  await expect(sort).toHaveAccessibleName("Sort: Quantity: Lowest");
  await expect.poll(() => api.queries.length).toBe(initialRequests + 2);
});

test("desktop sort arrows do not commit or dismiss a choice", async ({
  page,
}) => {
  const api = await foodApi(page, [milk]);
  await page.goto("/pantry");
  await expect(nameCells(page)).toHaveText(["Milk"]);
  const initialRequests = api.queries.length;
  const sort = page.getByRole("button", { name: /Sort:/ });
  await sort.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  await expect(
    page
      .getByRole("radio", { name: "Added: Oldest" })
      .or(page.getByRole("menuitemradio", { name: "Added: Oldest" })),
  ).toBeFocused();
  await expect(sort).toHaveAttribute("aria-expanded", "true");
  await expect(sort).toHaveAccessibleName("Sort: Added: Newest");
  expect(api.queries).toHaveLength(initialRequests);
});

test("desktop sort supports pointer selection and natural Tab departure", async ({
  page,
}) => {
  const api = await foodApi(page, [milk]);
  await page.goto("/pantry");
  await expect(nameCells(page)).toHaveText(["Milk"]);
  const sort = page.getByRole("button", { name: /Sort:/ });
  const filter = page.getByRole("button", { name: "Filter", exact: true });
  const search = page.getByRole("searchbox", { name: "Search food items" });
  const menu = page.getByRole("menu", { name: "Sort pantry items" });
  const initialRequests = api.queries.length;

  await sort.click();
  await menu.getByRole("menuitemradio", { name: "Name: A to Z" }).click();
  await expect(sort).toBeFocused();
  await expect(sort).toHaveAccessibleName("Sort: Name: A to Z");
  await expect.poll(() => api.queries.length).toBe(initialRequests + 1);
  await sort.click();
  await menu.getByRole("menuitemradio", { name: "Name: A to Z" }).click();
  expect(api.queries).toHaveLength(initialRequests + 1);

  await sort.click();
  await page.keyboard.press("Tab");
  await expect(filter).toBeFocused();
  await expect(menu).toHaveCount(0);
  expect(api.queries).toHaveLength(initialRequests + 1);
  await sort.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("Shift+Tab");
  await expect(sort).toBeFocused();
  await expect(menu).toHaveCount(0);
  await page.keyboard.press("Shift+Tab");
  await expect(search).toBeFocused();

  await sort.click();
  await search.click();
  await expect(menu).toHaveCount(0);
  await expect(search).toBeFocused();
  expect(api.queries).toHaveLength(initialRequests + 1);
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

test("filter removal and dialog Apply restore focus to a surviving control", async ({
  page,
}) => {
  await foodApi(page, [milk]);
  await page.goto("/pantry");
  await expect(nameCells(page)).toHaveText(["Milk"]);
  const filter = page.getByRole("button", { name: /^Filter(?: \(\d+\))?$/ });
  await filter.click();
  const dialog = page.getByRole("dialog", { name: "Filter items" });
  const first = dialog.getByRole("group", { name: "Filter 1" });
  await first.getByLabel("Filter by").selectOption("expiresOn");
  await first.getByLabel("Condition").selectOption("blank");
  await dialog.getByRole("button", { name: "Add another filter" }).click();
  const second = dialog.getByRole("group", { name: "Filter 2" });
  await second.getByLabel("Filter by").selectOption("amount");
  await second.getByLabel("Quantity").fill("1");
  await second.getByLabel("Unit").selectOption("l");
  await dialog.getByRole("button", { name: "Apply" }).click();

  await expect(filter).toHaveAccessibleName("Filter (2)");
  await expect(filter).not.toHaveAttribute("aria-pressed");

  const chips = page.getByRole("region", { name: "Applied filters" });
  const amount = chips.getByRole("button", { name: "Edit Amount filter" });
  const removeExpiration = chips.getByRole("button", {
    name: "Remove Expiration date filter",
  });
  await removeExpiration.focus();
  await page.keyboard.press("Enter");
  await expect(amount).toBeFocused();

  await amount.click();
  await dialog.getByRole("button", { name: "Reset" }).click();
  await dialog.getByRole("button", { name: "Apply" }).click();
  await expect(chips).toHaveCount(0);
  await expect(filter).toBeFocused();
});

test("filter errors identify and focus the invalid control", async ({
  page,
}) => {
  await foodApi(page, [milk]);
  await page.goto("/pantry");
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Filter items" });
  await dialog.getByLabel("Filter by").selectOption("amount");
  await dialog.getByLabel("Quantity").fill("2");
  await dialog.getByRole("button", { name: "Apply" }).click();

  const unit = dialog.getByLabel("Unit");
  const quantity = dialog.getByLabel("Quantity");
  await expect(unit).toBeFocused();
  await expect(unit).toHaveAttribute("aria-invalid", "true");
  await expect(unit).toHaveAccessibleDescription("Choose a unit.");
  await expect(quantity).not.toHaveAttribute("aria-invalid");
  await expect(quantity).not.toHaveAttribute("aria-describedby");
  await expectAccessible(page);
});

test("mobile row actions close when focus leaves and restore focus on Escape", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await foodApi(page, [milk, rice]);
  await page.goto("/pantry");
  const actions = page.getByRole("button", { name: "Actions for Milk" });
  const nextActions = page.getByRole("button", { name: "Actions for Rice" });
  await actions.focus();
  await page.keyboard.press("Enter");
  await expect(actions).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Edit Milk" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Delete Milk" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(nextActions).toBeFocused();
  await expect(actions).toHaveAttribute("aria-expanded", "false");

  await actions.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Escape");
  await expect(actions).toBeFocused();
  await expect(actions).toHaveAttribute("aria-expanded", "false");
});

test("keyboard focus has a separated indicator on pantry controls", async ({
  page,
}) => {
  await foodApi(page, [milk]);
  await page.goto("/pantry");
  await expect(nameCells(page)).toHaveText(["Milk"]);
  await page.keyboard.press("Tab");

  async function expectIndicator(locator: ReturnType<typeof page.getByRole>) {
    await locator.focus();
    await expect(locator).toHaveCSS("outline-style", "solid");
    await expect(locator).toHaveCSS("outline-width", "2px");
    await expect(locator).toHaveCSS("outline-offset", "2px");
  }

  const logo = page.getByRole("link", { name: "Sari" });
  await expectIndicator(logo);
  await expect(logo).toHaveCSS("border-radius", "8px");
  await expectIndicator(
    page.getByRole("searchbox", { name: "Search food items" }),
  );
  await expectIndicator(page.getByRole("button", { name: "Add item" }));
  await expectIndicator(
    page.getByRole("checkbox", { name: "Select all loaded items" }),
  );
  await expectIndicator(page.getByRole("button", { name: /Sort:/ }));
  await expectIndicator(page.getByRole("button", { name: "Filter" }));

  await page.getByRole("button", { name: "Filter" }).click();
  const dialog = page.getByRole("dialog", { name: "Filter items" });
  await page.keyboard.press("Tab");
  await expectIndicator(dialog.getByLabel("Filter by"));
  await expectIndicator(dialog.getByRole("button", { name: "Reset" }));
  await expectIndicator(dialog.getByRole("button", { name: "Apply" }));
});
