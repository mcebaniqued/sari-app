import { expect, test } from "@playwright/test";

test("frontend loads and its same-origin proxy reaches the API", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "My Pantry", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/pantry$/);

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
  await page.getByRole("link", { name: "Back to pantry" }).click();
  await expect(
    page.getByRole("heading", { name: "My Pantry", exact: true }),
  ).toBeVisible();
});
