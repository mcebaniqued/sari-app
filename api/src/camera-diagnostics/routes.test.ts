import { apiErrorResponseSchema } from "@sari/contracts";
import type { RequestHandler } from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import app from "../app.js";

vi.mock("../auth/requireSession.js", () => ({
  requireSession: ((_req, res, next) => {
    res.locals.userId = "diagnostic-user";
    next();
  }) satisfies RequestHandler,
}));

afterEach(() => vi.restoreAllMocks());

describe("camera diagnostic ingestion", () => {
  it("emits one correlated JSON log for a valid batch without user data", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const response = await request(app)
      .post("/api/v1/camera-diagnostics")
      .send({
        sessionId: "4f6e81ef-6c60-4704-b686-3dd389120246",
        events: [
          {
            type: "session-started",
            sequence: 1,
            elapsedMs: 0,
            captureStrategy: "baseline",
            cameraSource: "default",
          },
          {
            type: "decode-summary",
            sequence: 2,
            elapsedMs: 1000,
            attempts: 4,
            noResult: 3,
            invalid: 0,
            valid: 1,
          },
        ],
      });

    expect(response.status).toBe(204);
    expect(info).toHaveBeenCalledOnce();
    const entry = JSON.parse(String(info.mock.calls[0]?.[0])) as Record<
      string,
      unknown
    >;
    expect(entry).toMatchObject({
      kind: "sari.camera-diagnostics",
      sessionId: "4f6e81ef-6c60-4704-b686-3dd389120246",
    });
    expect(entry).not.toHaveProperty("userId");
    expect(JSON.stringify(entry)).not.toContain("barcode");
  });

  it("rejects unknown diagnostic fields without logging them", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const response = await request(app)
      .post("/api/v1/camera-diagnostics")
      .send({
        sessionId: "4f6e81ef-6c60-4704-b686-3dd389120246",
        events: [
          {
            type: "first-valid-read",
            sequence: 1,
            elapsedMs: 100,
            attempt: 1,
            format: "UPC_A",
            barcode: "012345678905",
          },
        ],
      });

    expect(response.status).toBe(400);
    expect(apiErrorResponseSchema.parse(response.body).error.code).toBe(
      "VALIDATION_ERROR",
    );
    expect(info).not.toHaveBeenCalled();
  });
});
