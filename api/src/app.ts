import type {
  ApiErrorResponse,
  HealthResponse,
  NotReadyResponse,
  ReadyResponse,
} from "@sari/contracts";
import express, { type ErrorRequestHandler, type Response } from "express";

import { requireSession } from "./auth/requireSession.js";
import { authRouter } from "./auth/routes.js";
import { connectDatabase } from "./db.js";
import { foodItemsRouter } from "./food-items/routes.js";
import { foodProductsRouter } from "./food-products/routes.js";

const app = express();
app.disable("x-powered-by");
// Freeze reads and writes before authentication or database work during a migration.
app.use((req, res, next) => {
  if (
    process.env.MAINTENANCE_MODE !== "true" ||
    req.path === "/api/v1/health"
  ) {
    next();
    return;
  }
  res.set({ "Cache-Control": "no-store", "Retry-After": "60" });
  if (req.path === "/api/v1/ready") {
    res.status(503).json({ status: "not_ready" } satisfies NotReadyResponse);
    return;
  }
  res.status(503).json({
    error: {
      code: "MAINTENANCE",
      message: "Sari is undergoing maintenance. Please try again shortly.",
    },
  } satisfies ApiErrorResponse);
});
app.use("/api/v1/auth", authRouter);
app.use(express.json({ limit: "16kb" }));

// Liveness is independent of database availability.
app.get("/api/v1/health", (_req, res: Response<HealthResponse>) => {
  res.json({ status: "ok" });
});

// Readiness actually connects to MongoDB; it never reports an untested connection.
app.get(
  "/api/v1/ready",
  async (_req, res: Response<ReadyResponse | NotReadyResponse>) => {
    try {
      await connectDatabase();
      res.json({ status: "ready" });
    } catch {
      res.status(503).json({ status: "not_ready" });
    }
  },
);

app.use("/api/v1/food-items", requireSession, foodItemsRouter);
app.use("/api/v1/food-products", requireSession, foodProductsRouter);

app.use((_req, res: Response<ApiErrorResponse>) => {
  res
    .status(404)
    .json({ error: { code: "NOT_FOUND", message: "Route not found." } });
});

const handleError: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? error.status
      : undefined;

  if (status === 400 || status === 413) {
    res.status(status).json({
      error: {
        code: status === 413 ? "PAYLOAD_TOO_LARGE" : "INVALID_JSON",
        message:
          status === 413 ? "Request body is too large." : "Invalid JSON body.",
      },
    } satisfies ApiErrorResponse);
    return;
  }

  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
  } satisfies ApiErrorResponse);
};

app.use(handleError);

// Vercel imports this app; only server.ts opens a port locally.
export default app;
