import type { ApiErrorResponse } from "@sari/contracts";
import { fromNodeHeaders } from "better-auth/node";
import type { RequestHandler } from "express";

import { appOrigins, getAuth, hasSessionCookie } from "./auth.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Express augments its Locals interface through this namespace.
  namespace Express {
    interface Locals {
      userId: string;
    }
  }
}

export const requireSession: RequestHandler = async (req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (!hasSessionCookie(req.headers.cookie)) {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Please log in to continue." },
    } satisfies ApiErrorResponse);

    return;
  }

  try {
    const auth = await getAuth();
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) {
      res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Please log in to continue.",
        },
      } satisfies ApiErrorResponse);

      return;
    }

    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      (!req.headers.origin || !appOrigins().includes(req.headers.origin))
    ) {
      res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Request origin is not allowed.",
        },
      } satisfies ApiErrorResponse);

      return;
    }

    res.locals.userId = session.user.id;
    next();
  } catch {
    res.status(503).json({
      error: {
        code: "AUTH_UNAVAILABLE",
        message: "Cannot check your session. Please try again shortly.",
      },
    } satisfies ApiErrorResponse);
  }
};
