import { expect } from "@playwright/test";
import {
  expectAccessible,
  foodApi,
  milk,
  nameCells,
  test,
} from "./fixtures/pantry";

const sortLabels = [
  "Added: Newest",
  "Added: Oldest",
  "Expiration: Soonest",
  "Expiration: Latest",
  "Name: A to Z",
  "Name: Z to A",
  "Quantity: Lowest",
  "Quantity: Highest",
  "Unit: A to Z",
  "Unit: Z to A",
];

for (const width of [1280, 390, 320]) {
  test(`filter and sort rendered states at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 1200 });
    await foodApi(page, [milk]);
    await page.goto("/pantry");
    await page.getByRole("button", { name: "Filter", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Filter items" });
    const first = dialog.getByRole("group", { name: "Filter 1" });
    const capture = async (state: string) => {
      expect(
        await dialog.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
      ).toBe(true);
      await dialog.screenshot({
        path: testInfo.outputPath(`${width}-${state}.png`),
      });
    };
    await expect(first.getByLabel("Filter by")).toBeVisible();
    await expect(first.getByLabel("Filter by")).toBeFocused();
    await expect(
      dialog.getByRole("button", { name: "Add another filter" }),
    ).toHaveCount(0);
    await capture("zero");
    await dialog.getByRole("button", { name: "Apply" }).click();
    await expect(dialog).toHaveCount(0);
    await page.getByRole("button", { name: "Filter", exact: true }).click();
    await first.getByLabel("Filter by").selectOption("amount");
    await first.getByLabel("Quantity").fill("5");
    await first.getByLabel("Unit").selectOption("item");
    await expect(dialog.getByLabel("Filter by")).toHaveCount(1);
    await capture("amount-equals");
    await first.getByLabel("Condition").selectOption("inRange");
    await expect(first.getByLabel("From")).toHaveValue("5");
    await first.getByLabel("From").fill("2");
    await first.getByLabel("To").fill("5");
    await first.getByLabel("Unit").selectOption("kg");
    await capture("amount-between");
    await expectAccessible(page);
    await first.getByLabel("Filter by").selectOption("expiresOn");
    await expect(first.getByLabel("Condition")).toHaveValue("equals");
    await expect(first.getByLabel("Unit")).toHaveCount(0);
    await expect(first.getByLabel("Date", { exact: true })).toHaveValue("");
    await first.getByLabel("Date", { exact: true }).fill("2026-10-21");
    await first.getByLabel("Condition").selectOption("blank");
    await expect(first.locator("input")).toHaveCount(0);
    await capture("expiration-no-date");
    await first.getByLabel("Condition").selectOption("inRange");
    await expect(first.getByLabel("From")).toHaveValue("");
    await first.getByLabel("From").fill("2026-10-01");
    await first.getByLabel("To").fill("2026-10-31");
    await capture("expiration-between");
    await dialog.getByRole("button", { name: "Add another filter" }).click();
    const second = dialog.getByRole("group", { name: "Filter 2" });
    await expect(second.getByLabel("Filter by")).toBeFocused();
    await second.getByLabel("Filter by").selectOption("amount");
    await second.getByLabel("Quantity").fill("5");
    await second.getByLabel("Unit").selectOption("item");
    await capture("two-filters");
    await expectAccessible(page);
    await dialog
      .getByRole("button", { name: "Remove Expiration date filter" })
      .click();
    await expect(first.getByLabel("Filter by")).toHaveValue("amount");
    await dialog.getByRole("button", { name: "Remove Amount filter" }).click();
    await expect(first.getByLabel("Filter by")).toHaveValue("");
    await expect(first.getByLabel("Filter by")).toBeFocused();
    await dialog.getByRole("button", { name: "Cancel" }).click();

    await page
      .getByRole("button", {
        name: width >= 768 ? /^Sort:/ : /^Sort by:/,
      })
      .click();
    const sort = page
      .getByRole("menu", { name: "Sort pantry items" })
      .or(page.getByRole("group", { name: "Sort pantry items" }));
    const choices = sort.getByRole("menuitemradio").or(sort.getByRole("radio"));
    await expect(choices).toHaveCount(10);
    await expect(sort.locator("label, [role=menuitemradio]")).toHaveText(
      sortLabels,
    );
    await expect(
      sort
        .getByRole("menuitemradio", { name: "Expiration: Soonest" })
        .or(sort.getByRole("radio", { name: "Expiration: Soonest" })),
    ).toBeChecked();
    await expect(
      sort
        .getByRole("menuitemradio", { checked: true })
        .or(sort.getByRole("radio", { checked: true })),
    ).toHaveCount(1);
    await expect(
      sort.locator("hr, [role=separator], optgroup, h2, h3"),
    ).toHaveCount(0);
    const rows = await sort
      .locator("label, [role=menuitemradio]")
      .evaluateAll((elements) =>
        elements.map((element) => ({
          top: element.getBoundingClientRect().top,
          height: element.getBoundingClientRect().height,
        })),
      );
    expect(new Set(rows.map((row) => row.height)).size).toBe(1);
    const gaps = rows
      .slice(1)
      .map((row, index) => Math.round(row.top - (rows[index]?.top ?? 0)));
    expect(new Set(gaps).size).toBe(1);
    await page.screenshot({ path: testInfo.outputPath(`${width}-sort.png`) });
    await expectAccessible(page);
  });
}

test("Amount uses exact stored units and inclusive range boundaries without conversion", async ({
  page,
}) => {
  const initial = [
    {
      ...milk,
      id: "000000000000000000000001",
      name: "Three items",
      quantity: 3,
      unit: "item" as const,
    },
    {
      ...milk,
      id: "000000000000000000000002",
      name: "Three kg",
      quantity: 3,
      unit: "kg" as const,
    },
    {
      ...milk,
      id: "000000000000000000000003",
      name: "500 g",
      quantity: 500,
      unit: "g" as const,
    },
    {
      ...milk,
      id: "000000000000000000000004",
      name: "One kg",
      quantity: 1,
      unit: "kg" as const,
    },
    ...[1, 2, 5, 6].map((quantity) => ({
      ...milk,
      id: String(quantity + 4).padStart(24, "0"),
      name: `${quantity} oz`,
      quantity,
      unit: "oz" as const,
    })),
    {
      ...milk,
      id: "000000000000000000000011",
      name: "Three lb",
      quantity: 3,
      unit: "lb" as const,
    },
  ];
  const api = await foodApi(page, initial);
  await page.goto("/pantry");
  await expect(nameCells(page)).toHaveCount(initial.length);
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Filter items" });
  await dialog.getByLabel("Filter by").selectOption("amount");
  await dialog.getByLabel("Condition").selectOption("lessThan");
  await dialog.getByLabel("Quantity").fill("5");
  await dialog.getByLabel("Unit").selectOption("item");
  await dialog.getByRole("button", { name: "Apply" }).click();
  await expect(nameCells(page)).toHaveText(["Three items"]);
  expect(JSON.parse(api.queries.at(-1)?.get("filters") ?? "{}")).toEqual({
    quantity: { filterType: "number", type: "lessThan", filter: 5 },
    unit: { filterType: "text", type: "equals", filter: "item" },
  });
  await expect(page.getByRole("button", { name: "Filter (1)" })).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Applied filters" })
      .getByRole("button", { name: /^Edit/ }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Edit Amount filter" }).click();
  await expect(dialog.getByLabel("Filter by")).toBeFocused();
  await dialog.getByLabel("Condition").selectOption("greaterThanOrEqual");
  await dialog.getByLabel("Quantity").fill("500");
  await dialog.getByLabel("Unit").selectOption("g");
  await dialog.getByRole("button", { name: "Apply" }).click();
  await expect(nameCells(page)).toHaveText(["500 g"]);
  await page.getByRole("button", { name: "Edit Amount filter" }).click();
  await dialog.getByLabel("Condition").selectOption("inRange");
  await dialog.getByLabel("From").fill("2");
  await dialog.getByLabel("To").fill("5");
  await dialog.getByLabel("Unit").selectOption("oz");
  await dialog.getByRole("button", { name: "Apply" }).click();
  await expect(nameCells(page)).toHaveText(["2 oz", "5 oz"]);
  await expect(
    page.getByRole("button", { name: "Edit Amount filter" }),
  ).toHaveText("Amount: 2–5 oz");
  await page.getByRole("button", { name: "Remove Amount filter" }).click();
  await expect(nameCells(page)).toHaveCount(initial.length);
  expect(api.queries.at(-1)?.get("filters")).toBe("{}");
  expect(api.queries.at(-1)?.get("start")).toBe("0");
});

test("date transitions validate ranges and submit no hidden date values", async ({
  page,
}) => {
  const api = await foodApi(page, [
    milk,
    {
      ...milk,
      id: "000000000000000000000003",
      name: "Undated",
      expiresOn: null,
    },
  ]);
  await page.goto("/pantry");
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Filter items" });
  await dialog.getByLabel("Filter by").selectOption("expiresOn");
  await dialog.getByLabel("Condition").selectOption("inRange");
  await dialog.getByLabel("From").fill("2028-03-01");
  await dialog.getByLabel("To").fill("2028-02-29");
  await dialog.getByRole("button", { name: "Apply" }).click();
  await expect(dialog.getByRole("alert")).toContainText("ordered date range");
  await dialog.getByLabel("Condition").selectOption("blank");
  await expect(dialog.locator("input")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Apply" }).click();
  await expect(nameCells(page)).toHaveText(["Undated"]);
  expect(JSON.parse(api.queries.at(-1)?.get("filters") ?? "{}")).toEqual({
    expiresOn: { filterType: "date", type: "blank" },
  });
  await page
    .getByRole("button", { name: "Edit Expiration date filter" })
    .click();
  await dialog.getByLabel("Condition").selectOption("notBlank");
  await dialog.getByRole("button", { name: "Apply" }).click();
  await expect(nameCells(page)).toHaveText(["Milk"]);
  await page
    .getByRole("button", { name: "Edit Expiration date filter" })
    .click();
  await dialog.getByLabel("Condition").selectOption("equals");
  await expect(dialog.getByLabel("Date", { exact: true })).toHaveValue("");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await page
    .getByRole("button", { name: "Edit Expiration date filter" })
    .click();
  await expect(dialog.getByLabel("Condition")).toHaveValue("notBlank");
});

test("filter controls remain usable at a 200% desktop zoom equivalent", async ({
  page,
}, testInfo) => {
  // A 1280×1000 display at 200% zoom exposes a 640×500 CSS viewport.
  await page.setViewportSize({ width: 640, height: 500 });
  await foodApi(page, [milk]);
  await page.goto("/pantry");
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Filter items" });
  await dialog.getByLabel("Filter by").selectOption("amount");
  await dialog.getByLabel("Condition").selectOption("inRange");
  await dialog.getByLabel("From").fill("2");
  await dialog.getByLabel("To").fill("5");
  await dialog.getByLabel("Unit").selectOption("item");
  await dialog.getByLabel("Unit").focus();
  await expect(dialog.getByLabel("Unit")).toBeInViewport();
  await expect(dialog.getByRole("button", { name: "Apply" })).toBeInViewport();
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  await dialog.screenshot({ path: testInfo.outputPath("zoom-equivalent.png") });
  await dialog.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByRole("button", { name: "Filter (1)" })).toBeVisible();
});
