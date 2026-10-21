import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // This entry opens a listener and installs process-exit handlers. Playwright
      // starts it as the API server; unit tests import app.ts without owning a port.
      exclude: ["src/server.ts"],
    },
  },
});
