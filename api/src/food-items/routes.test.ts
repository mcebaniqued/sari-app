import { apiErrorResponseSchema } from "@sari/contracts";
import type { RequestHandler } from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import app from "../app.js";

// These tests isolate request validation. Authentication is exercised separately.
vi.mock("../auth/requireSession.js", () => ({
  requireSession: ((_req, res, next) => {
    res.locals.userId = "validation-user";
    next();
  }) satisfies RequestHandler,
}));

afterEach(() => vi.unstubAllEnvs());

describe("food item validation", () => {
  it.each([
    { start: -1 },
    { start: "1.5" },
    { start: 1_000_001 },
    { limit: 0 },
    { limit: 101 },
    { search: "x".repeat(121) },
    { sort: "not JSON" },
    { filters: "not JSON" },
    { sort: JSON.stringify([{ colId: "$where", sort: "asc" }]) },
    {
      sort: JSON.stringify([
        { colId: "name", sort: "asc" },
        { colId: "name", sort: "desc" },
      ]),
    },
    {
      filters: JSON.stringify({
        name: { filterType: "text", type: "contains", filter: { $ne: null } },
      }),
    },
    {
      filters: JSON.stringify({
        quantity: {
          filterType: "number",
          type: "inRange",
          filter: 10,
          filterTo: 1,
        },
      }),
    },
    {
      filters: JSON.stringify({
        expiresOn: {
          filterType: "date",
          type: "equals",
          dateFrom: "2026-02-30",
        },
      }),
    },
    {
      filters: JSON.stringify({
        name: { filterType: "text", operator: "OR", conditions: [] },
      }),
    },
    { unknown: "value" },
  ])("rejects invalid list parameters before connecting: %j", async (query) => {
    vi.stubEnv("MONGODB_URI", "");
    const response = await request(app).get("/api/v1/food-items").query(query);
    expect(response.status).toBe(400);
    expect(apiErrorResponseSchema.parse(response.body).error.code).toBe(
      "VALIDATION_ERROR",
    );
  });
  const validId = "012345678901234567890123";

  it.each(["get", "patch", "delete"] as const)(
    "rejects malformed IDs for %s before connecting",
    async (method) => {
      vi.stubEnv("MONGODB_URI", "");
      const client = request(app);
      const response = await client[method](
        "/api/v1/food-items/not-an-id",
      ).send({ name: "Rice" });
      expect(response.status).toBe(400);
      expect(apiErrorResponseSchema.parse(response.body).error.code).toBe(
        "INVALID_ID",
      );
    },
  );

  it.each([
    {},
    { name: " " },
    { quantity: 0 },
    { quantity: "1" },
    { unit: "bucket" },
    { expiresOn: "2026-02-30" },
    { id: validId },
    { createdAt: "2026-10-19T00:00:00Z" },
    { updatedAt: "2026-10-19T00:00:00Z" },
    { $set: { name: "Rice" } },
  ])("rejects invalid updates: %j", async (body) => {
    vi.stubEnv("MONGODB_URI", "");
    const response = await request(app)
      .patch(`/api/v1/food-items/${validId}`)
      .send(body);
    expect(response.status).toBe(400);
    expect(apiErrorResponseSchema.parse(response.body).error.code).toBe(
      "VALIDATION_ERROR",
    );
  });

  it.each(["get", "patch", "delete"] as const)(
    "returns a safe connection error for item %s",
    async (method) => {
      vi.stubEnv("MONGODB_URI", "");
      const client = request(app);
      const response = await client[method](
        `/api/v1/food-items/${validId}`,
      ).send({ name: "Rice" });
      expect(response.status).toBe(503);
      expect(apiErrorResponseSchema.parse(response.body).error.code).toBe(
        "DATABASE_UNAVAILABLE",
      );
    },
  );

  it.each([
    {},
    { name: "   " },
    { name: "x".repeat(121) },
    { name: "Rice", quantity: 0 },
    { name: "Rice", quantity: -1 },
    { name: "Rice", quantity: "2" },
    { name: "Rice", quantity: 1_000_001 },
    { name: "Rice", unit: "bucket" },
    { name: "Rice", expiresOn: "2026-02-30" },
    { name: "Rice", expiresOn: "2026-10-19T00:00:00Z" },
    { name: "Rice", id: "012345678901234567890123" },
    { name: "Rice", createdAt: "2026-10-19T00:00:00Z" },
    { name: "Rice", $set: { quantity: 2 } },
  ])(
    "rejects invalid input before attempting persistence: %j",
    async (body) => {
      vi.stubEnv("MONGODB_URI", "");
      const response = await request(app).post("/api/v1/food-items").send(body);
      expect(response.status).toBe(400);
      expect(apiErrorResponseSchema.parse(response.body).error.code).toBe(
        "VALIDATION_ERROR",
      );
    },
  );

  it.each(["get", "post"] as const)(
    "returns a safe database error for %s",
    async (method) => {
      vi.stubEnv("MONGODB_URI", "");
      const client = request(app);
      const response = await client[method]("/api/v1/food-items").send({
        name: "Rice",
      });
      expect(response.status).toBe(503);
      expect(apiErrorResponseSchema.parse(response.body).error).toEqual({
        code: "DATABASE_UNAVAILABLE",
        message: "Cannot reach your pantry. Please try again shortly.",
      });
    },
  );
});
