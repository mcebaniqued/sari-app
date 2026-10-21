import {
  apiErrorResponseSchema,
  healthResponseSchema,
  notReadyResponseSchema,
} from "@sari/contracts";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import app from "./app.js";

afterEach(() => vi.unstubAllEnvs());

describe("API infrastructure", () => {
  it("keeps liveness available and readiness unavailable during maintenance", async () => {
    vi.stubEnv("MAINTENANCE_MODE", "true");
    vi.stubEnv("MONGODB_URI", "");
    expect((await request(app).get("/api/v1/health")).status).toBe(200);
    const response = await request(app).get("/api/v1/ready");
    expect(response.status).toBe(503);
    expect(notReadyResponseSchema.parse(response.body).status).toBe(
      "not_ready",
    );
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it.each([
    "/api/v1/auth/sign-up/email",
    "/api/v1/food-items",
    "/api/v1/food-products/lookup",
  ])(
    "blocks %s before any auth or database writes during maintenance",
    async (path) => {
      vi.stubEnv("MAINTENANCE_MODE", "true");
      const response = await request(app).post(path).send({});
      expect(response.status).toBe(503);
      expect(apiErrorResponseSchema.parse(response.body).error.code).toBe(
        "MAINTENANCE",
      );
      expect(response.headers["retry-after"]).toBe("60");
    },
  );

  it("reports liveness without MongoDB or credentials", async () => {
    vi.stubEnv("MONGODB_URI", "");
    const response = await request(app).get("/api/v1/health");
    expect(response.status).toBe(200);
    expect(healthResponseSchema.parse(response.body)).toEqual({ status: "ok" });
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });

  it("does not report readiness when MongoDB is unconfigured", async () => {
    vi.stubEnv("MONGODB_URI", "");
    const response = await request(app).get("/api/v1/ready");
    expect(response.status).toBe(503);
    expect(notReadyResponseSchema.parse(response.body)).toEqual({
      status: "not_ready",
    });
  });

  it("returns a consistent JSON error for unknown endpoints", async () => {
    const response = await request(app).get("/api/v1/missing");
    expect(response.status).toBe(404);
    expect(apiErrorResponseSchema.parse(response.body).error.code).toBe(
      "NOT_FOUND",
    );
  });

  it("returns a safe JSON error for malformed request bodies", async () => {
    const response = await request(app)
      .post("/api/v1/missing")
      .set("Content-Type", "application/json")
      .send("{");
    expect(response.status).toBe(400);
    expect(apiErrorResponseSchema.parse(response.body).error).toEqual({
      code: "INVALID_JSON",
      message: "Invalid JSON body.",
    });
  });

  it("rejects oversized request bodies", async () => {
    const response = await request(app)
      .post("/api/v1/missing")
      .send({ name: "x".repeat(17 * 1024) });
    expect(response.status).toBe(413);
    expect(apiErrorResponseSchema.parse(response.body).error.code).toBe(
      "PAYLOAD_TOO_LARGE",
    );
  });
});
