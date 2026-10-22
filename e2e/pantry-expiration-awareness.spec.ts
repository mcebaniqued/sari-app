import { expect } from "@playwright/test";
import { expectAccessible, foodApi, milk, rice, test } from "./fixtures/pantry";

test.use({ timezoneId: "America/Los_Angeles" });

for (const width of [320, 1280]) {
  const inventoryRole = width < 768 ? "list" : "table";
  const rowRole = width < 768 ? "listitem" : "row";

  test(`expiration status and exact dates fit the ${width}px inventory`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.clock.setFixedTime(new Date("2026-10-22T06:30:00Z"));
    await foodApi(page, [
      { ...milk, name: "Past", expiresOn: "2026-10-19" },
      {
        ...milk,
        id: "112345678901234567890123",
        name: "Today",
        expiresOn: "2026-10-21",
      },
      {
        ...milk,
        id: "212345678901234567890123",
        name: "Seven days",
        expiresOn: "2026-10-28",
      },
      {
        ...milk,
        id: "312345678901234567890123",
        name: "Later",
        expiresOn: "2026-10-29",
      },
      { ...rice, id: "412345678901234567890123", name: "Undated" },
    ]);
    await page.goto("/pantry");

    const inventory = page.getByRole(inventoryRole, { name: "Food inventory" });
    const row = (name: string) =>
      inventory.getByRole(rowRole).filter({ hasText: name });

    await expect(row("Past")).toContainText("2 days past date");
    await expect(row("Past")).toContainText("Oct 19, 2026");
    await expect(row("Today")).toContainText("Today");
    await expect(row("Today")).toContainText("Oct 21, 2026");
    await expect(row("Seven days")).toContainText("In 7 days");
    await expect(row("Later")).toContainText("In 8 days");
    await expect(row("Undated")).toContainText("No date");
    await expect(row("Undated").getByText("No date")).toHaveCount(1);
    await expect(row("Past").getByText("2 days past date")).toHaveClass(
      /bg-danger-subtle/,
    );
    await expect(
      row("Today").locator("span").filter({ hasText: "Today" }),
    ).toHaveClass(/bg-warning-subtle/);
    await expect(row("Later").getByText("In 8 days")).not.toHaveClass(/\bbg-/);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expectAccessible(page);
  });
}

test("expiration status refreshes at midnight and when the pantry regains focus", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-22T06:59:00Z") });
  await foodApi(page, [{ ...milk, expiresOn: "2026-10-22" }]);
  await page.goto("/pantry");
  const row = page.getByRole("row", { name: /Milk/ });
  await expect(row).toContainText("Tomorrow");

  await page.clock.fastForward("02:00");
  await expect(row).toContainText("Today");

  await page.clock.setFixedTime(new Date("2026-10-23T20:00:00Z"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(row).toContainText("1 day past date");
});
