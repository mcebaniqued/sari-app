import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { loginSchema, registerSchema } from "@sari/contracts";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import type { Db } from "mongodb";
import mongoose from "mongoose";
import { connectDatabase } from "../db.js";

export function appOrigins() {
  const url = process.env.BETTER_AUTH_URL ?? "http://127.0.0.1:5173";
  const appUrl = new URL(url);
  const origins = [
    appUrl.origin,
    ...(process.env.AUTH_TRUSTED_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  ];
  // Local aliases must use the configured protocol and port; production stays explicit.
  if (
    process.env.NODE_ENV !== "production" &&
    ["localhost", "127.0.0.1"].includes(appUrl.hostname)
  ) {
    appUrl.hostname =
      appUrl.hostname === "localhost" ? "127.0.0.1" : "localhost";
    origins.push(appUrl.origin);
  }

  return [...new Set(origins)];
}

function createAuth(database: Db) {
  const secret = process.env.BETTER_AUTH_SECRET;
  const baseURL = process.env.BETTER_AUTH_URL ?? "http://127.0.0.1:5173";
  if (
    process.env.NODE_ENV === "production" &&
    (!process.env.BETTER_AUTH_URL || new URL(baseURL).protocol !== "https:")
  ) {
    throw new Error(
      "Configure BETTER_AUTH_URL with your HTTPS frontend origin in production.",
    );
  }

  if (!secret || secret.length < 32) {
    throw new Error(
      "Configure BETTER_AUTH_SECRET with at least 32 random characters.",
    );
  }

  return betterAuth({
    appName: "Sari",
    baseURL,
    basePath: "/api/v1/auth",
    secret,
    database: mongodbAdapter(database),
    trustedOrigins: appOrigins(),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      autoSignIn: true,
    },
    user: {
      additionalFields: {
        firstName: {
          type: "string",
          required: true,
          validator: { input: registerSchema.shape.firstName },
        },
        lastName: {
          type: "string",
          required: true,
          validator: { input: registerSchema.shape.lastName },
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      disableSessionRefresh: true,
      cookieCache: { enabled: false },
    },
    advanced: {
      disableCSRFCheck: false,
      disableOriginCheck: false,
      cookiePrefix: "sari",
      useSecureCookies: process.env.NODE_ENV === "production",
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax", path: "/" },
      // Only our Express handler writes this header; never trust a browser's IP claim.
      ipAddress: { ipAddressHeaders: ["x-sari-client-ip"] },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 10 },
        "/sign-up/email": { window: 60, max: 5 },
      },
    },
    hooks: {
      before: createAuthMiddleware((ctx) => {
        if (ctx.path !== "/sign-in/email" && ctx.path !== "/sign-up/email") {
          return Promise.resolve();
        }

        const signingUp = ctx.path === "/sign-up/email";
        if (signingUp) {
          const result = registerSchema.safeParse(ctx.body);
          if (!result.success) {
            throw new APIError("BAD_REQUEST", {
              code: "VALIDATION_ERROR",
              message:
                result.error.issues[0]?.message ??
                "Check your account details.",
            });
          }

          ctx.body = {
            ...result.data,
            name: `${result.data.firstName} ${result.data.lastName}`,
          };
        } else {
          const result = loginSchema.safeParse(ctx.body);
          if (!result.success) {
            throw new APIError("BAD_REQUEST", {
              code: "VALIDATION_ERROR",
              message:
                result.error.issues[0]?.message ??
                "Check your account details.",
            });
          }

          ctx.body = result.data;
        }

        return Promise.resolve();
      }),
    },
    logger: { level: "error" },
  });
}

let cached: { database: Db; auth: ReturnType<typeof createAuth> } | undefined;

export async function getAuth() {
  await connectDatabase();
  const database = mongoose.connection.db;
  if (!database) {
    throw new Error("Database is unavailable.");
  }

  if (cached?.database !== database) {
    cached = { database, auth: createAuth(database) };
  }

  return cached.auth;
}

export function hasSessionCookie(cookie: string | undefined) {
  return /(?:^|;\s*)(?:__Secure-)?sari\.session_token=/.test(cookie ?? "");
}
