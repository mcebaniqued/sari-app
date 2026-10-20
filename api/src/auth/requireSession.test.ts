import type { ApiErrorResponse } from "@sari/contracts";
import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import type * as AuthModule from "./auth.js";
import { getAuth } from "./auth.js";
import { requireSession } from "./requireSession.js";

vi.mock("./auth.js", async (original) => {
  const actual = await original<typeof AuthModule>();
  return { ...actual, getAuth: vi.fn() };
});

const app = express();
app.use(requireSession);
app.use((_req, res) => {
  res.json({ userId: res.locals.userId });
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("session enforcement", () => {
  it.each(["get", "post", "patch", "delete"] as const)(
    "rejects anonymous %s before loading authentication",
    async (method) => {
      const response = await request(app)[method]("/");
      expect(response.status).toBe(401);
      expect((response.body as ApiErrorResponse).error.code).toBe(
        "UNAUTHORIZED",
      );
      expect(getAuth).not.toHaveBeenCalled();
      expect(response.headers["cache-control"]).toBe("no-store");
    },
  );

  it("fails closed when session services are unavailable", async () => {
    vi.mocked(getAuth).mockRejectedValueOnce(
      new Error("private database details"),
    );
    const response = await request(app)
      .get("/")
      .set("Cookie", "sari.session_token=invalid");
    expect(response.status).toBe(503);
    expect(response.text).not.toContain("private database details");
  });
});
