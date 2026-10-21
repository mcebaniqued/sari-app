import { expect } from "@playwright/test";
import {
  foodApi,
  milk,
  nameCells,
  requireGeometry,
  test,
} from "./fixtures/pantry";

test("notifications are centered below the CTA and auto-dismiss after a hover pause", async ({
  page,
}, testInfo) => {
  await foodApi(page, [milk]);
  await page.goto("/pantry");
  await expect(nameCells(page)).toHaveText(["Milk"]);
  await page.clock.install();
  await page.getByRole("button", { name: "Edit Milk", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Edit item", exact: true });
  await dialog.getByLabel(/^Food name/).fill("Oat milk");
  await dialog
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  const notification = page
    .getByRole("status")
    .filter({ hasText: "Oat milk updated." });
  await expect(notification).toBeVisible();
  const bounds = requireGeometry(await notification.boundingBox());
  const add = requireGeometry(
    await page
      .getByRole("button", { name: "Add item", exact: true })
      .boundingBox(),
  );
  const icon = requireGeometry(
    await notification.locator("svg").first().boundingBox(),
  );
  const message = requireGeometry(
    await notification
      .getByText("Oat milk updated.", { exact: true })
      .boundingBox(),
  );
  const close = requireGeometry(
    await notification
      .getByRole("button", { name: "Dismiss notification" })
      .boundingBox(),
  );
  expect(
    Math.abs(
      bounds.x + bounds.width / 2 - (page.viewportSize()?.width ?? 0) / 2,
    ),
  ).toBeLessThan(1);
  expect(bounds.y).toBeGreaterThan(add.y + add.height);
  expect(
    Math.abs(icon.y + icon.height / 2 - message.y - message.height / 2),
  ).toBeLessThan(1);
  expect(
    Math.abs(close.y + close.height / 2 - message.y - message.height / 2),
  ).toBeLessThan(1);
  await page.screenshot({
    path: testInfo.outputPath("pantry-bottom-toast.png"),
    fullPage: true,
  });
  await page.clock.fastForward(4000);
  await expect(notification).toBeVisible();
  await notification.hover();
  await page.clock.fastForward(10000);
  await expect(notification).toBeVisible();
  await page.mouse.move(0, 0);
  await page.clock.fastForward(1100);
  await expect(notification).toHaveCount(0);
});
