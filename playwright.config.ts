import { defineConfig, devices } from "@playwright/test";

const testDatabase = process.env.TEST_MONGODB_URI;
if (testDatabase && !/\/_?[\w-]+_test(?:\?|$)/.test(testDatabase)) {
  throw new Error(
    "TEST_MONGODB_URI must explicitly name a database ending in _test.",
  );
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:5273",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm run dev -w @sari/api",
      env: {
        PORT: "3101",
        // Explicitly override .env so browser tests cannot use a personal database.
        MONGODB_URI: testDatabase ?? "",
        BETTER_AUTH_SECRET: "browser-test-only-secret-at-least-32-characters",
        BETTER_AUTH_URL: "http://127.0.0.1:5273",
        AUTH_TRUSTED_ORIGINS: "",
      },
      url: "http://127.0.0.1:3101/api/v1/health",
      reuseExistingServer: false,
    },
    {
      command:
        "npm exec -w @sari/web -- vite --host 127.0.0.1 --port 5273 --strictPort",
      env: { API_PROXY_TARGET: "http://127.0.0.1:3101" },
      url: "http://127.0.0.1:5273",
      reuseExistingServer: false,
    },
  ],
});
