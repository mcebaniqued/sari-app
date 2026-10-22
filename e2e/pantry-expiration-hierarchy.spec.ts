import { expect } from "@playwright/test";
import { foodApi, milk, rice, test } from "./fixtures/pantry";

test.use({ timezoneId: "America/Los_Angeles" });

const items = [
  { ...milk, name: "Later", expiresOn: "2026-11-06" },
  {
    ...milk,
    id: "112345678901234567890123",
    name: "Past",
    expiresOn: "2026-10-18",
  },
  {
    ...milk,
    id: "212345678901234567890123",
    name: "Tomorrow",
    expiresOn: "2026-10-22",
  },
  {
    ...milk,
    id: "312345678901234567890123",
    name: "Upcoming",
    expiresOn: "2026-10-24",
  },
  { ...rice, id: "412345678901234567890123", name: "Undated" },
];

for (const width of [320, 390, 440]) {
  test(`undated mobile metadata and dated status layout at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 800 });
    await page.clock.setFixedTime(new Date("2026-10-21T20:00:00Z"));
    await foodApi(page, items);
    await page.goto("/pantry");

    const list = page.getByRole("list", { name: "Food inventory" });
    const undated = list.getByRole("listitem").filter({ hasText: "Undated" });
    const quantity = undated.getByText("1 kg", { exact: true });
    const noDate = undated.getByText("No date", { exact: true });
    const action = undated.getByRole("button", { name: "Actions for Undated" });
    const [quantityBox, noDateBox, actionBox] = await Promise.all([
      quantity.boundingBox(),
      noDate.boundingBox(),
      action.boundingBox(),
    ]);

    await expect(noDate).toHaveCount(1);
    expect(await noDate.evaluate((element) => element.tagName)).toBe("P");
    expect(
      await noDate.evaluate((element) => element.parentElement?.textContent),
    ).toContain("1 kg");
    expect(Math.abs((noDateBox?.x ?? 0) - (quantityBox?.x ?? 0))).toBeLessThan(
      2,
    );
    expect(noDateBox?.y ?? 0).toBeGreaterThan(
      (quantityBox?.y ?? 0) + (quantityBox?.height ?? 0),
    );
    expect(actionBox?.x ?? 0).toBeGreaterThan(noDateBox?.x ?? 0);

    const dated = list.getByRole("listitem").filter({ hasText: "Past" });
    const date = dated.getByText("Oct 18, 2026", { exact: true });
    const badge = dated.getByText("3 days past date", { exact: true });
    const [dateBox, badgeBox] = await Promise.all([
      date.boundingBox(),
      badge.boundingBox(),
    ]);
    expect(badgeBox?.x ?? 0).toBeGreaterThan(dateBox?.x ?? 0);
    await expect(dated).toContainText("2 l");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath("mobile-expiration-hierarchy.png"),
    });

    await action.click();
    await expect(
      undated.getByRole("button", { name: "Edit Undated" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(action).toBeFocused();
    await page.getByRole("button", { name: "Select", exact: true }).click();
    await undated.getByRole("checkbox", { name: "Select Undated" }).check();
    await expect(
      undated.getByRole("checkbox", { name: "Select Undated" }),
    ).toBeChecked();
  });
}

for (const width of [800, 1024, 1280]) {
  test(`desktop later date reads ahead of its exact date at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 800 });
    await page.clock.setFixedTime(new Date("2026-10-21T20:00:00Z"));
    await foodApi(page, items);
    await page.goto("/pantry");

    const table = page.getByRole("table", { name: "Food inventory" });
    const later = table.getByRole("row").filter({ hasText: "Later" });
    const status = later.getByText("In 16 days", { exact: true });
    const date = later.getByText("Nov 06, 2026", { exact: true });
    const [statusBox, dateBox] = await Promise.all([
      status.boundingBox(),
      date.boundingBox(),
    ]);
    const [statusStyle, dateStyle, nameStyle] = await Promise.all([
      status.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          color: style.color,
          weight: Number(style.fontWeight),
          background: style.backgroundColor,
          border: style.borderTopWidth,
        };
      }),
      date.evaluate((element) => {
        const style = getComputedStyle(element);
        return { color: style.color, size: Number.parseFloat(style.fontSize) };
      }),
      later
        .getByRole("rowheader")
        .evaluate((element) => getComputedStyle(element).color),
    ]);

    expect(statusStyle.color).toBe(nameStyle);
    expect(statusStyle.color).not.toBe(dateStyle.color);
    expect(statusStyle.weight).toBeGreaterThanOrEqual(500);
    expect(statusStyle.background).toBe("rgba(0, 0, 0, 0)");
    expect(statusStyle.border).toBe("0px");
    expect(
      (dateBox?.x ?? 0) - (statusBox?.x ?? 0) - (statusBox?.width ?? 0),
    ).toBeGreaterThanOrEqual(11);
    expect(Math.abs((statusBox?.y ?? 0) - (dateBox?.y ?? 0))).toBeLessThan(8);

    for (const [name, label, exactDate] of [
      ["Past", "3 days past date", "Oct 18, 2026"],
      ["Tomorrow", "Tomorrow", "Oct 22, 2026"],
      ["Upcoming", "In 3 days", "Oct 24, 2026"],
    ] as const) {
      const row = table.getByRole("row").filter({ hasText: name });
      const badge = row
        .getByRole("cell")
        .filter({ hasText: label })
        .getByText(label, { exact: true });
      const exact = row.getByText(exactDate, { exact: true });
      const [badgeBox, exactBox] = await Promise.all([
        badge.boundingBox(),
        exact.boundingBox(),
      ]);
      const background = await badge.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      );
      expect(background).not.toBe("rgba(0, 0, 0, 0)");
      expect(
        (exactBox?.x ?? 0) - (badgeBox?.x ?? 0) - (badgeBox?.width ?? 0),
      ).toBeGreaterThanOrEqual(11);
      expect(Math.abs((badgeBox?.y ?? 0) - (exactBox?.y ?? 0))).toBeLessThan(8);
    }

    await expect(
      table.getByRole("row").filter({ hasText: "Undated" }),
    ).toContainText("No date");
    expect(
      await table.evaluate(
        (element) => element.scrollWidth <= element.clientWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath("desktop-expiration-hierarchy.png"),
    });
  });
}
