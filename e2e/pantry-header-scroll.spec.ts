import { expect } from "@playwright/test";
import { foodApi, milk, test } from "./fixtures/pantry";

function longInventory() {
  return Array.from({ length: 40 }, (_, index) => ({
    ...milk,
    id: index.toString(16).padStart(24, "0"),
    name: `Food ${index + 1}`,
  }));
}

for (const width of [320, 390]) {
  test(`mobile Pantry heading and controls remain sticky at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 600 });
    await foodApi(page, longInventory());
    await page.goto("/pantry");
    await expect(
      page.getByRole("list", { name: "Food inventory" }).getByRole("listitem"),
    ).toHaveCount(20);

    const header = page.locator("header").first();
    const heading = page.getByRole("heading", { name: "My Pantry" });
    const sticky = heading.locator("../../..");
    const select = page.getByRole("button", { name: "Select", exact: true });
    const search = page.getByRole("searchbox", { name: "Search food items" });
    const add = page.getByRole("button", { name: "Add item" });
    const sort = page.getByRole("button", { name: /^Sort by:/ });
    const filter = page.getByRole("button", { name: "Filter", exact: true });

    await expect(header).toHaveCSS("position", "relative");
    await expect(sticky).toHaveCSS("position", "sticky");
    await page.mouse.wheel(0, 1_200);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(800);

    await expect
      .poll(async () => {
        const rect = await header.boundingBox();
        return (rect?.y ?? 0) + (rect?.height ?? 0);
      })
      .toBeLessThanOrEqual(1);
    await expect
      .poll(async () => (await sticky.boundingBox())?.y ?? -1)
      .toBeGreaterThanOrEqual(-1);
    await expect
      .poll(async () => (await sticky.boundingBox())?.y ?? 100)
      .toBeLessThanOrEqual(1);
    for (const control of [heading, select, search, add, sort, filter]) {
      await expect(control).toBeInViewport();
    }

    // Scrolling upward in the middle must not reveal the global header.
    await page.mouse.wheel(0, -250);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(72);
    await expect
      .poll(async () => {
        const rect = await header.boundingBox();
        return (rect?.y ?? 0) + (rect?.height ?? 0);
      })
      .toBeLessThanOrEqual(1);
    await expect(heading).toBeInViewport();
    await expect(select).toBeInViewport();

    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    await expect
      .poll(async () => (await header.boundingBox())?.y ?? -1)
      .toBeGreaterThanOrEqual(-1);
    const globalBounds = await header.boundingBox();
    const pantryBounds = await sticky.boundingBox();
    expect(pantryBounds?.y ?? 0).toBeGreaterThanOrEqual(
      (globalBounds?.y ?? 0) + (globalBounds?.height ?? 0) - 1,
    );
  });
}

test("desktop retains its sticky global header", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await foodApi(page, [milk]);
  await page.goto("/pantry");
  await expect(page.locator("header").first()).toHaveCSS("position", "sticky");
  await expect(page.getByRole("heading", { name: "My Pantry" })).toBeVisible();
});
