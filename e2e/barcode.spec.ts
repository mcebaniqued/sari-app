import AxeBuilder from "@axe-core/playwright";
import { expect } from "@playwright/test";

import { foodApi, nameCells, test, usdaOats } from "./fixtures/pantry";

test("camera decodes a UPC from video and looks up the item once", async ({
  page,
}) => {
  // UPC-A 853807005033: left digit patterns, center guard, then inverted
  // right digit patterns. A canvas stream exercises the actual ZXing decoder.
  const patterns = [
    "0001101",
    "0011001",
    "0010011",
    "0111101",
    "0100011",
    "0110001",
    "0101111",
    "0111011",
    "0110111",
    "0001011",
  ];
  const upc = "853807005033";
  const left = [...upc.slice(0, 6)]
    .map((digit) => patterns[Number(digit)])
    .join("");
  const right = [...upc.slice(6)]
    .map((digit) => patterns[Number(digit)])
    .join("")
    .replace(/[01]/g, (bit) => (bit === "0" ? "1" : "0"));
  const bars = `101${left}01010${right}101`;
  await page.addInitScript((bars) => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        const canvas = document.createElement("canvas");
        canvas.id = "test-camera-source";
        canvas.hidden = true;
        canvas.width = 640;
        canvas.height = 360;
        const context = canvas.getContext("2d")!;
        context.fillStyle = "white";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = "black";
        [...bars].forEach((bar, index) => {
          if (bar === "1") {
            context.fillRect(130 + index * 4, 60, 4, 240);
          }
        });
        document.body.append(canvas);
        const stream = canvas.captureStream(10);
        Object.defineProperty(canvas, "cameraStream", { value: stream });

        return stream;
      },
    });
  }, bars);
  await foodApi(page, []);
  const lookups: string[] = [];
  await page.route("**/api/v1/food-products/barcode/*", (route) => {
    lookups.push(new URL(route.request().url()).pathname);

    return route.fulfill({
      json: {
        product: {
          ...usdaOats,
          barcode: "00853807005033",
          name: "Test cooking oil",
        },
        stale: false,
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add item", exact: true });
  await dialog.getByRole("button", { name: "Input barcode instead" }).click();
  await dialog.getByRole("button", { name: "Scan with camera" }).click();
  await expect(dialog.getByLabel(/^Food name/)).toHaveValue("Test cooking oil");
  expect(lookups).toEqual(["/api/v1/food-products/barcode/00853807005033"]);
  await expect(dialog.getByLabel("Barcode camera preview")).toHaveCount(0);
  expect(
    await page
      .locator("#test-camera-source")
      .evaluate((canvas) =>
        (
          canvas as HTMLCanvasElement & { cameraStream: MediaStream }
        ).cameraStream
          .getTracks()
          .every((track) => track.readyState === "ended"),
      ),
  ).toBe(true);
  await expect(
    dialog.getByRole("button", { name: "Add item", exact: true }),
  ).toBeEnabled();
});

test("barcode suggestions are reviewed, privately renamed, saved, and unlinked", async ({
  page,
}) => {
  await foodApi(page, []);
  await page.route("**/api/v1/food-products/barcode/*", (route) =>
    route.fulfill({ json: { product: usdaOats, stale: false } }),
  );
  await page.route(`**/api/v1/food-products/${usdaOats.id}`, (route) =>
    route.fulfill({ json: usdaOats }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add item", exact: true });
  await expect(dialog.getByLabel(/^Food name/)).toBeFocused();
  await dialog.getByRole("button", { name: "Input barcode instead" }).click();
  await dialog.getByLabel("Barcode number").fill("012345678905");
  await dialog.getByRole("button", { name: "Find item", exact: true }).click();
  await expect(dialog.getByText("USDA oats", { exact: true })).toBeVisible();
  await expect(dialog.getByLabel("Barcode number")).toHaveCount(0);
  await expect(dialog.getByLabel(/^Quantity/)).toHaveValue("500");
  await dialog.getByLabel(/^Food name/).fill("My breakfast oats");
  await expect(dialog.getByText("USDA oats", { exact: true })).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
  await dialog.getByRole("button", { name: "Add item", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(nameCells(page)).toHaveText(["My breakfast oats"]);
  await page.reload();
  await page
    .getByRole("button", { name: "Edit My breakfast oats", exact: true })
    .click();
  const edit = page.getByRole("dialog", { name: "Edit item", exact: true });
  await expect(edit.getByText("USDA oats", { exact: true })).toBeVisible();
  await edit.getByRole("button", { name: "Remove product link" }).click();
  await expect(edit.getByLabel(/^Food name/)).toHaveValue("My breakfast oats");
  await expect(edit.getByLabel(/^Quantity/)).toHaveValue("500");
  await edit.getByRole("button", { name: "Save changes" }).click();
  await page
    .getByRole("button", { name: "Edit My breakfast oats", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Remove product link" }),
  ).toHaveCount(0);
});

test("barcode not found preserves manual entry and records no product link", async ({
  page,
}) => {
  await foodApi(page, []);
  await page.route("**/api/v1/food-products/barcode/*", (route) =>
    route.fulfill({
      status: 404,
      json: {
        error: {
          code: "PRODUCT_NOT_FOUND",
          message: "Product not found in USDA. Enter details manually.",
        },
      },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add item", exact: true });
  await dialog.getByRole("button", { name: "Input barcode instead" }).click();
  await dialog.getByLabel("Barcode number").fill("012345678905");
  await dialog.getByRole("button", { name: "Find item", exact: true }).click();
  await expect(
    dialog.getByText("Barcode not found. Enter the item details manually."),
  ).toBeVisible();
  await expect(dialog.getByText(/No USDA product linked/)).toHaveCount(0);
  await dialog.getByRole("button", { name: "Enter details manually" }).click();
  await expect(dialog.getByLabel(/^Food name/)).toBeFocused();
  await dialog.getByLabel(/^Food name/).fill("Local cereal");
  await dialog.getByRole("button", { name: "Add item", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(nameCells(page)).toHaveText(["Local cereal"]);
});

test("barcode entry preserves drafts and fits a phone screen", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await foodApi(page, []);
  await page.route("**/api/v1/food-products/barcode/*", (route) =>
    route.fulfill({ json: { product: usdaOats, stale: false } }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add item", exact: true });
  await dialog.getByLabel(/^Food name/).fill("My breakfast");
  await dialog.getByLabel(/Expiration date/).fill("2028-02-29");
  await dialog.getByRole("button", { name: "Input barcode instead" }).click();
  await expect(dialog.getByLabel("Barcode number")).toBeFocused();
  await expect(dialog.getByLabel(/^Food name/)).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: "Add item", exact: true }),
  ).toHaveCount(0);
  await dialog.getByLabel("Barcode number").fill("012345678905");
  await page.screenshot({
    path: testInfo.outputPath("barcode-phone.png"),
    fullPage: true,
  });
  await expect(dialog).toHaveJSProperty(
    "scrollWidth",
    await dialog.evaluate((element) => element.clientWidth),
  );
  await dialog.getByRole("button", { name: "Enter details manually" }).click();
  await expect(dialog.getByLabel(/^Food name/)).toHaveValue("My breakfast");
  await expect(dialog.getByLabel(/Expiration date/)).toHaveValue("2028-02-29");
  await dialog.getByRole("button", { name: "Input barcode instead" }).click();
  await expect(dialog.getByLabel("Barcode number")).toHaveValue("012345678905");
  await dialog.getByLabel("Barcode number").press("Enter");
  await expect(dialog.getByText("USDA oats", { exact: true })).toBeVisible();
  await expect(dialog.getByLabel(/^Food name/)).toHaveValue("My breakfast");
  await expect(dialog.getByLabel(/^Quantity/)).toHaveValue("500");
  await dialog.getByRole("button", { name: "Keep my entries" }).click();
  await expect(dialog.getByText(/^Barcode:/)).toBeHidden();
  await page.screenshot({
    path: testInfo.outputPath("matched-product-phone.png"),
    fullPage: true,
  });
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
  await expect(dialog).toHaveJSProperty(
    "scrollWidth",
    await dialog.evaluate((element) => element.clientWidth),
  );
  await dialog.getByText("More product details", { exact: true }).click();
  await expect(dialog.getByText(`Barcode: ${usdaOats.barcode}`)).toBeVisible();
});
