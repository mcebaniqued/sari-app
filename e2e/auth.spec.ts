import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { MongoClient } from "mongodb";

import { signedIn } from "./authFixture";

const createdEmails = new Set<string>();

test.afterEach(async () => {
  if (!createdEmails.size) {
    return;
  }
  const uri = process.env.TEST_MONGODB_URI;
  if (!uri || !/\/_?[\w-]+_test(?:\?|$)/.test(uri)) {
    throw new Error("Cleanup requires an explicitly named _test database.");
  }
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    const users = await db
      .collection("user")
      .find({ email: { $in: [...createdEmails] } })
      .project({ _id: 1 })
      .toArray();
    const ids = users.map((user) => user._id);
    await db
      .collection("fooditems")
      .deleteMany({ userId: { $in: ids.map((id) => id.toHexString()) } });
    await db.collection("session").deleteMany({ userId: { $in: ids } });
    await db.collection("account").deleteMany({ userId: { $in: ids } });
    await db.collection("user").deleteMany({ _id: { $in: ids } });
  } finally {
    await client.close();
    createdEmails.clear();
  }
});

test("signed-out routes lead to login and auth forms work on mobile and keyboard", async ({
  page,
}, testInfo) => {
  await page.goto("/pantry");
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Log in", exact: true }),
  ).toBeFocused();
  await expect(page.getByLabel("Email", { exact: true })).toHaveAttribute(
    "autocomplete",
    "email",
  );
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page.getByRole("button", { name: "Hide password" }).click();
  await page.screenshot({
    path: testInfo.outputPath("login-desktop.png"),
    fullPage: true,
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(
    page.getByRole("heading", { name: "Create an account" }),
  ).toBeFocused();
  await expect(page.getByLabel("First name")).toHaveAttribute(
    "autocomplete",
    "given-name",
  );
  await expect(page.getByLabel("Last name")).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("register-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "Log in" }).click();
  await page.screenshot({
    path: testInfo.outputPath("login-mobile.png"),
    fullPage: true,
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.goto("/not-a-page");
  await expect(page).toHaveURL(/\/login$/);
});

test("user menu supports keyboard dismissal, outside clicks, and logout failure", async ({
  page,
}) => {
  await signedIn(page);
  await page.route("**/api/v1/food-items**", (route) =>
    route.fulfill({ json: { items: [], total: 0, start: 0, limit: 20 } }),
  );
  await page.route("**/api/v1/auth/sign-out", (route) =>
    route.fulfill({ status: 503, json: {} }),
  );
  await page.goto("/pantry");
  const trigger = page.getByRole("button", { name: "User menu for Alex" });
  await trigger.focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: "Log out" })).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await trigger.click();
  await page.getByRole("heading", { name: "My Pantry", exact: true }).click();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await trigger.click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Could not log out. Please try again.",
  );
  await expect(page).toHaveURL(/\/pantry$/);
});

test("an expired session during a pantry request returns to login", async ({
  page,
}) => {
  await signedIn(page);
  await page.route("**/api/v1/food-items**", (route) =>
    route.fulfill({
      status: 401,
      json: { error: { code: "UNAUTHORIZED", message: "Please log in." } },
    }),
  );
  await page.goto("/pantry");
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Log in", exact: true }),
  ).toBeVisible();
});

test("registration displays the server's specific rejection reason", async ({
  page,
}) => {
  await page.route("**/api/v1/auth/sign-up/email", (route) =>
    route.fulfill({
      status: 422,
      json: {
        code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
        message: "User already exists. Use another email.",
      },
    }),
  );
  await page.goto("/register");
  await page.getByLabel("First name").fill("Alex");
  await page.getByLabel("Last name").fill("Tester");
  await page.getByLabel("Email", { exact: true }).fill("alex@example.com");
  await page.getByLabel("Password", { exact: true }).fill("pantry rice!");
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await expect(page.getByRole("alert")).toHaveText(
    "An account with this email already exists. Log in instead.",
  );
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(
    "alex@example.com",
  );
});

test("real registration, private pantry, reload, logout, and login", async ({
  page,
  context,
  browser,
}) => {
  // eslint-disable-next-line playwright/no-skipped-test -- Real persistence requires the explicit disposable database runner.
  test.skip(
    !process.env.TEST_MONGODB_URI,
    "Run npm run test:integration for an isolated MongoDB.",
  );
  const email = `browser-${crypto.randomUUID()}@example.com`;
  createdEmails.add(email);
  createdEmails.add(`other-${email}`);
  const password = "pantry rice!";
  await page.goto("http://localhost:5273/register");
  await page.getByLabel("First name").fill("Jamie");
  await page.getByLabel("Last name").fill("Tester");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/pantry$/);
  await expect(
    page.getByRole("button", { name: "User menu for Jamie" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/^Food name/).fill("Jamie's rice");
  await dialog.getByRole("button", { name: "Add item", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit Jamie's rice" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Edit Jamie's rice" }),
  ).toBeVisible();
  const other = await browser.newContext();
  try {
    const stranger = await other.newPage();
    await stranger.goto("http://127.0.0.1:5273/register");
    await stranger.getByLabel("First name").fill("Taylor");
    await stranger.getByLabel("Last name").fill("Tester");
    await stranger.getByLabel("Email", { exact: true }).fill(`other-${email}`);
    await stranger.getByLabel("Password", { exact: true }).fill(password);
    await stranger
      .getByRole("button", { name: "Create an account", exact: true })
      .click();
    await expect(stranger).toHaveURL(/\/pantry$/);
    await expect(
      stranger.getByText("Add your first item to start your pantry.", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(
      stranger.getByRole("button", { name: "Edit Jamie's rice" }),
    ).toHaveCount(0);
  } finally {
    await other.close();
  }
  const cookies = await context.cookies();
  expect(
    cookies.find((cookie) => cookie.name === "sari.session_token")?.httpOnly,
  ).toBe(true);
  await page.getByRole("button", { name: "User menu for Jamie" }).click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(
    (
      await context.request.get("http://localhost:5273/api/v1/food-items")
    ).status(),
  ).toBe(401);
  await page.goto("http://localhost:5273/pantry");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("This is the wrong password");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Invalid email or password.",
  );
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/pantry$/);
  await expect(
    page.getByRole("button", { name: "Edit Jamie's rice" }),
  ).toBeVisible();
});
