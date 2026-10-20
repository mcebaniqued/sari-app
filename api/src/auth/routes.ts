import type { ApiErrorResponse } from "@sari/contracts";
import { toNodeHandler } from "better-auth/node";
import { Router } from "express";

import { getAuth, hasSessionCookie } from "./auth.js";

export const authRouter = Router();

authRouter.use(async (req, res, next) => {
  res.set("Cache-Control", "no-store");
  const sessionCheck = req.method === "GET" && req.path === "/get-session";
  const mutation =
    req.method === "POST" &&
    ["/sign-in/email", "/sign-up/email", "/sign-out"].includes(req.path);
  if (!sessionCheck && !mutation) {
    next();
    return;
  }
  if (sessionCheck && !hasSessionCookie(req.headers.cookie)) {
    res.json(null);
    return;
  }
  try {
    const auth = await getAuth();
    req.headers["x-sari-client-ip"] = req.ip ?? "unknown";
    await toNodeHandler(auth)(req, res);
  } catch {
    if (!res.headersSent) {
      res.status(503).json({
        error: {
          code: "AUTH_UNAVAILABLE",
          message:
            "Account services are unavailable. Please try again shortly.",
        },
      } satisfies ApiErrorResponse);
    }
  }
});
