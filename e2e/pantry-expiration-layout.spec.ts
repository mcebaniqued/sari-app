import { expect, type Locator } from "@playwright/test";
import { foodApi, milk, rice, test } from "./fixtures/pantry";

test.use({ timezoneId: "America/Los_Angeles" });

const items = [
  { ...milk, name: "Old oats", expiresOn: "2026-09-28" },
  {
    ...milk,
    id: "112345678901234567890123",
    name: "A pantry item with an unusually long name that should keep its existing presentation",
    expiresOn: "2026-10-18",
  },
  {
    ...milk,
    id: "212345678901234567890123",
    name: "Yogurt",
    expiresOn: "2026-10-22",
  },
  {
    ...milk,
    id: "312345678901234567890123",
    name: "Bread",
    expiresOn: "2026-10-24",
  },
  { ...rice, id: "412345678901234567890123", name: "Rice" },
];

async function textLineCount(locator: Locator) {
  return locator.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    return range.getClientRects().length;
  });
}

for (const width of [800, 1024, 1280]) {
  const dateAddedCount = width >= 1024 ? 1 : 0;

  test(`desktop expiration cells fit one line at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.clock.setFixedTime(new Date("2026-10-21T20:00:00Z"));
    await foodApi(page, items);
    await page.goto("/pantry");

    const table = page.getByRole("table", { name: "Food inventory" });
    const rows = table.getByRole("row");
    await expect(rows).toHaveCount(items.length + 1);
    const headers = await table.getByRole("columnheader").all();
    const headerBoxes = await Promise.all(
      headers.map((header) => header.boundingBox()),
    );
    for (let index = 1; index < headerBoxes.length; index += 1) {
      const previous = headerBoxes[index - 1];
      const current = headerBoxes[index];
      expect((previous?.x ?? 0) + (previous?.width ?? 0)).toBeLessThanOrEqual(
        (current?.x ?? 0) + 1,
      );
    }
    expect(
      await table.evaluate(
        (element) => element.scrollWidth <= element.clientWidth + 1,
      ),
    ).toBe(true);

    for (const [name, status, date] of [
      ["Old oats", "23 days past date", "Sep 28, 2026"],
      ["A pantry item", "3 days past date", "Oct 18, 2026"],
      ["Yogurt", "Tomorrow", "Oct 22, 2026"],
      ["Bread", "In 3 days", "Oct 24, 2026"],
    ] as const) {
      const row = rows.filter({ hasText: name });
      const cell = row.getByRole("cell").filter({ hasText: status });
      const statusText = cell.getByText(status, { exact: true });
      const exactDate = cell.getByText(date, { exact: true });
      const [cellBox, statusBox, dateBox] = await Promise.all([
        cell.boundingBox(),
        statusText.boundingBox(),
        exactDate.boundingBox(),
      ]);

      expect(await textLineCount(statusText)).toBe(1);
      expect(await textLineCount(exactDate)).toBe(1);
      expect(statusBox && dateBox && cellBox).toBeTruthy();
      expect(Math.abs((statusBox?.y ?? 0) - (dateBox?.y ?? 0))).toBeLessThan(8);
      expect(statusBox?.x ?? 0).toBeLessThan(dateBox?.x ?? 0);
      expect((dateBox?.x ?? 0) + (dateBox?.width ?? 0)).toBeLessThanOrEqual(
        (cellBox?.x ?? 0) + (cellBox?.width ?? 0),
      );
    }

    await expect(rows.filter({ hasText: "Rice" })).toContainText("No date");
    await expect(rows.filter({ hasText: "Old oats" })).toContainText(
      "Oct 19, 2026",
    );
    await expect(
      table.getByRole("columnheader", { name: "Actions" }),
    ).toBeVisible();
    await expect(
      table.getByRole("columnheader", { name: "Date added" }),
    ).toHaveCount(dateAddedCount);
    await table.getByRole("checkbox", { name: "Select Old oats" }).check();
    await expect(
      table.getByRole("checkbox", { name: "Select Old oats" }),
    ).toBeChecked();
    await expect(
      table.getByRole("button", { name: "Edit Old oats" }),
    ).toBeVisible();
  });
}

for (const width of [320, 390, 440]) {
  test(`mobile badges stay on one line at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.clock.setFixedTime(new Date("2026-10-21T20:00:00Z"));
    await foodApi(page, items);
    await page.goto("/pantry");

    const list = page.getByRole("list", { name: "Food inventory" });
    const row = list.getByRole("listitem").filter({ hasText: "Old oats" });
    const content = row.getByText("Old oats", { exact: true }).locator("..");
    const badge = row.getByText("23 days past date", { exact: true });
    const action = row.getByRole("button", { name: "Actions for Old oats" });
    const [rowBox, contentBox, badgeBox, actionBox] = await Promise.all([
      row.boundingBox(),
      content.boundingBox(),
      badge.boundingBox(),
      action.boundingBox(),
    ]);

    expect(await textLineCount(badge)).toBe(1);
    expect((contentBox?.x ?? 0) + (contentBox?.width ?? 0)).toBeLessThanOrEqual(
      badgeBox?.x ?? 0,
    );
    expect((badgeBox?.x ?? 0) + (badgeBox?.width ?? 0)).toBeLessThanOrEqual(
      actionBox?.x ?? 0,
    );
    expect(Math.abs((badgeBox?.y ?? 0) - (actionBox?.y ?? 0))).toBeLessThan(8);
    expect(contentBox?.x ?? 0).toBeGreaterThanOrEqual(rowBox?.x ?? 0);
    expect(badgeBox?.x ?? 0).toBeGreaterThanOrEqual(rowBox?.x ?? 0);
    expect((actionBox?.x ?? 0) + (actionBox?.width ?? 0)).toBeLessThanOrEqual(
      (rowBox?.x ?? 0) + (rowBox?.width ?? 0),
    );
    expect(
      await row.evaluate(
        (element) => element.scrollWidth <= element.clientWidth + 1,
      ),
    ).toBe(true);
    await expect(row).toContainText("Sep 28, 2026");
    await expect(row).toContainText("2 l");
    await expect(
      list.getByRole("listitem").filter({ hasText: "A pantry item" }),
    ).toContainText("3 days past date");
    await expect(
      list
        .getByRole("listitem")
        .filter({ hasText: "Rice" })
        .getByText("No date"),
    ).toHaveCount(1);
    const otherBadge = list
      .getByRole("listitem")
      .filter({ hasText: "A pantry item" })
      .getByText("3 days past date", { exact: true });
    expect(
      await badge.evaluate((element) => {
        const style = getComputedStyle(element);
        return [style.color, style.backgroundColor, style.borderColor];
      }),
    ).toEqual(
      await otherBadge.evaluate((element) => {
        const style = getComputedStyle(element);
        return [style.color, style.backgroundColor, style.borderColor];
      }),
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await action.click();
    await expect(
      row.getByRole("button", { name: "Edit Old oats" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(action).toBeFocused();
    await page.getByRole("button", { name: "Select", exact: true }).click();
    await row.getByRole("checkbox", { name: "Select Old oats" }).check();
    await expect(
      row.getByRole("checkbox", { name: "Select Old oats" }),
    ).toBeChecked();
  });
}

for (const [width, textSize] of [
  [320, 200],
  [320, 250],
  [390, 200],
  [440, 200],
] as const) {
  test(`enlarged mobile text keeps the card content readable at ${width}px and ${textSize}%`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 800 });
    await page.clock.setFixedTime(new Date("2026-10-21T20:00:00Z"));
    await foodApi(page, items);
    await page.goto("/pantry");
    await page.evaluate((size) => {
      document.documentElement.style.fontSize = `${size}%`;
    }, textSize);

    const row = page
      .getByRole("list", { name: "Food inventory" })
      .getByRole("listitem")
      .filter({ hasText: "Old oats" });
    const content = row.getByText("Old oats", { exact: true }).locator("..");
    const badge = row.getByText("23 days past date", { exact: true });
    const action = row.getByRole("button", { name: "Actions for Old oats" });
    const [rowBox, contentBox, badgeBox, actionBox] = await Promise.all([
      row.boundingBox(),
      content.boundingBox(),
      badge.boundingBox(),
      action.boundingBox(),
    ]);

    expect(contentBox?.width ?? 0).toBeGreaterThanOrEqual(80);
    await expect(badge).toBeVisible();
    expect(
      (contentBox?.x ?? 0) + (contentBox?.width ?? 0) <= (badgeBox?.x ?? 0) ||
        (contentBox?.y ?? 0) + (contentBox?.height ?? 0) <=
          (badgeBox?.y ?? 0) ||
        (badgeBox?.y ?? 0) + (badgeBox?.height ?? 0) <= (contentBox?.y ?? 0),
    ).toBe(true);
    expect(
      (badgeBox?.x ?? 0) + (badgeBox?.width ?? 0) <= (actionBox?.x ?? 0) ||
        (badgeBox?.y ?? 0) + (badgeBox?.height ?? 0) <= (actionBox?.y ?? 0) ||
        (actionBox?.y ?? 0) + (actionBox?.height ?? 0) <= (badgeBox?.y ?? 0),
    ).toBe(true);
    expect((rowBox?.x ?? 0) + (rowBox?.width ?? 0)).toBeLessThanOrEqual(width);
    expect((badgeBox?.x ?? 0) + (badgeBox?.width ?? 0)).toBeLessThanOrEqual(
      (rowBox?.x ?? 0) + (rowBox?.width ?? 0),
    );
    expect((actionBox?.x ?? 0) + (actionBox?.width ?? 0)).toBeLessThanOrEqual(
      (rowBox?.x ?? 0) + (rowBox?.width ?? 0),
    );
    expect(
      await row.evaluate(
        (element) => element.scrollWidth <= element.clientWidth + 1,
      ),
    ).toBe(true);
    await expect(row).toContainText("Sep 28, 2026");
    await expect(row).toContainText("2 l");
    await page.screenshot({
      path: testInfo.outputPath("enlarged-page.png"),
      fullPage: true,
    });

    await action.click();
    await expect(
      row.getByRole("button", { name: "Edit Old oats" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(action).toBeFocused();
  });
}
