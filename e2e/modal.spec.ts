import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const fixturePath = "/modal-fixture.html";

test("native dialog focus and independently configured dismissal work", async ({
  page,
}) => {
  await page.goto(fixturePath);
  const opener = page.getByRole("button", { name: "Open fixture" });
  await opener.click();
  const dialog = page.getByRole("dialog");
  const heading = dialog.getByRole("heading");
  await expect(dialog).toHaveAttribute("open", "");
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(heading).toBeFocused();
  expect(
    (await new AxeBuilder({ page }).include("dialog").analyze()).violations,
  ).toEqual([]);

  const headerAction = dialog.getByRole("button", {
    name: "Start pending operation",
  });
  await page.keyboard.press("Tab");
  await expect(headerAction).toBeFocused();
  expect(
    await headerAction.evaluate(
      (element) => getComputedStyle(element).outlineStyle,
    ),
  ).not.toBe("none");
  await page.keyboard.press("Shift+Tab");
  await expect(
    dialog.getByRole("button", { name: "Last detail action" }),
  ).toBeFocused();

  await page.mouse.click(2, 2);
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();

  await page.goto(`${fixturePath}?backdrop`);
  await page.getByRole("button", { name: "Open fixture" }).click();
  await page.mouse.click(2, 2);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.goto(`${fixturePath}?autofocus`);
  await page.getByRole("button", { name: "Open fixture" }).click();
  const autofocus = page.getByLabel("Intentional initial focus");
  await expect(autofocus).toBeFocused();
  await page.getByRole("button", { name: "Start pending operation" }).click();
  await expect(
    page.getByRole("button", { name: "Close modal" }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "End pending operation" }).click();
  await page.getByRole("button", { name: "Close modal" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("contained content remains reachable at a constrained height", async ({
  page,
}) => {
  await page.setViewportSize({ width: 700, height: 320 });
  await page.goto(fixturePath);
  await page.getByRole("button", { name: "Open fixture" }).click();
  const dialog = page.getByRole("dialog");
  const header = dialog.locator("[data-modal-header]");
  const headerAction = dialog.getByRole("button", {
    name: "Start pending operation",
  });
  const close = dialog.getByRole("button", { name: "Close modal" });
  const lastAction = dialog.getByRole("button", {
    name: "Last detail action",
  });
  const scrollRegion = dialog.locator("[data-modal-scroll-region]");
  const dialogBox = await dialog.boundingBox();
  const initialHeaderBox = await header.boundingBox();

  expect(dialogBox?.width).toBe(700);
  expect(dialogBox?.height).toBe(320);
  await expect(header).toBeVisible();
  await expect(close).toBeVisible();

  expect(
    await scrollRegion.evaluate(
      (element) => element.scrollHeight > element.clientHeight,
    ),
  ).toBe(true);
  await scrollRegion.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect
    .poll(() => scrollRegion.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  expect(await header.boundingBox()).toEqual(initialHeaderBox);
  await expect(close).toBeVisible();
  await expect(lastAction).toBeVisible();
  await lastAction.focus();
  await expect(lastAction).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(headerAction).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
});

for (const viewport of [
  { label: "320 CSS-pixel width", width: 320, height: 600 },
  { label: "200% desktop zoom equivalent", width: 640, height: 450 },
]) {
  test(`responsive presentation fills the ${viewport.label} viewport`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto(fixturePath);
    await page.getByRole("button", { name: "Open fixture" }).click();
    const dialog = page.getByRole("dialog");
    const box = await dialog.boundingBox();

    expect(box).not.toBeNull();
    expect(box?.x).toBe(0);
    expect(box?.y).toBe(0);
    expect(box?.width).toBe(viewport.width);
    expect(box?.height).toBe(viewport.height);
    await expect(dialog.getByRole("heading")).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Start pending operation" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}

test("responsive presentation returns to centered layout after live resizing", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 600 });
  await page.goto(fixturePath);
  await page.getByRole("button", { name: "Open fixture" }).click();
  const dialog = page.getByRole("dialog");
  await expect
    .poll(() =>
      dialog.evaluate((element) => getComputedStyle(element).borderRadius),
    )
    .toBe("0px");

  await page.setViewportSize({ width: 1000, height: 800 });
  await expect
    .poll(() =>
      dialog.evaluate((element) => getComputedStyle(element).borderRadius),
    )
    .not.toBe("0px");
  const box = await dialog.boundingBox();
  expect(box?.width).toBeLessThan(1000);
  expect(box?.height).toBeLessThan(800);
  expect(box?.x).toBeGreaterThan(0);
  expect(box?.y).toBeGreaterThan(0);
});
