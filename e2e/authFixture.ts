import type { Page } from "@playwright/test";

export async function signedIn(page: Page) {
  await page.route("**/api/v1/auth/get-session", (route) =>
    route.fulfill({
      json: {
        user: {
          id: "012345678901234567890123",
          firstName: "Alex",
          lastName: "Tester",
          email: "alex@example.com",
        },
        session: { expiresAt: "2099-01-01T00:00:00Z" },
      },
    }),
  );
}
