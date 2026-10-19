import { expect, test } from "@playwright/test";

test("frontend loads and its same-origin proxy reaches the API", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /your kitchen, a little clearer/i }),
  ).toBeVisible();

  const response = await request.get("/api/v1/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
});

test("a direct visit to an unknown SPA route can navigate home", async ({
  page,
}) => {
  await page.goto("/missing");
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to Sari" }).click();
  await expect(
    page.getByRole("heading", { name: /your kitchen, a little clearer/i }),
  ).toBeVisible();
});
