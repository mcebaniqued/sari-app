import {
  type ApiErrorResponse,
  cameraDiagnosticBatchSchema,
} from "@sari/contracts";
import { Router } from "express";

export const cameraDiagnosticsRouter = Router();

cameraDiagnosticsRouter.post("/", (req, res) => {
  const result = cameraDiagnosticBatchSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid camera diagnostic batch.",
      },
    } satisfies ApiErrorResponse);

    return;
  }

  console.info(
    JSON.stringify({
      kind: "sari.camera-diagnostics",
      receivedAt: new Date().toISOString(),
      sessionId: result.data.sessionId,
      events: result.data.events,
    }),
  );
  res.status(204).end();
});
