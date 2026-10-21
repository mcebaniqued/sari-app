import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      // Import local source in these tests so coverage measures contracts, not dist.
      include: ["src/**/*.ts"],
    },
  },
});
