import { afterEach, describe, expect, it, vi } from "vitest";
import { appOrigins } from "./auth.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("trusted application origins", () => {
  it.each(["localhost", "127.0.0.1"])(
    "supports the matching local alias for %s in development",
    (host) => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("BETTER_AUTH_URL", `http://${host}:5173`);
      vi.stubEnv("AUTH_TRUSTED_ORIGINS", "");
      expect(appOrigins()).toEqual(
        expect.arrayContaining([
          "http://localhost:5173",
          "http://127.0.0.1:5173",
        ]),
      );
      expect(appOrigins()).not.toContain("http://localhost:5273");
    },
  );

  it("uses only explicitly configured production origins", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BETTER_AUTH_URL", "https://sari.example");
    vi.stubEnv("AUTH_TRUSTED_ORIGINS", "https://preview.sari.example");
    expect(appOrigins()).toEqual([
      "https://sari.example",
      "https://preview.sari.example",
    ]);
  });
});
