import { afterEach, describe, expect, it, vi } from "vitest";
import { authenticate } from "./authApi";

const input = {
  firstName: "Alex",
  lastName: "Tester",
  email: "alex@example.com",
  password: "pantry rice!",
};
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("authentication error messages", () => {
  it.each([
    {
      status: 422,
      code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
      message: "User already exists.",
      expected: "An account with this email already exists. Log in instead.",
    },
    {
      status: 403,
      code: "INVALID_ORIGIN",
      message: "Invalid origin",
      expected:
        "This website address is not allowed for sign-in. Open Sari using its configured address and try again.",
    },
    {
      status: 400,
      code: "VALIDATION_ERROR",
      message: "Use at least 12 characters for your password.",
      expected: "Use at least 12 characters for your password.",
    },
    {
      status: 429,
      code: "TOO_MANY_REQUESTS",
      message: "Rate limit exceeded",
      expected: "Too many attempts. Please wait a minute and try again.",
    },
    {
      status: 500,
      code: "DATABASE_ERROR",
      message: "private database connection details",
      expected: "Account services are unavailable. Please try again shortly.",
    },
  ])(
    "shows a useful message for $code without exposing internal details",
    async ({ status, code, message, expected }) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(Response.json({ code, message }, { status })),
      );
      await expect(authenticate(input, true)).rejects.toThrow(expected);
    },
  );

  it("does not disclose account existence during login", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { code: "USER_NOT_FOUND", message: "User not found" },
            { status: 401 },
          ),
        ),
    );
    await expect(authenticate(input, false)).rejects.toThrow(
      "Invalid email or password.",
    );
  });

  it("handles the API's wrapped service errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          {
            error: {
              code: "AUTH_UNAVAILABLE",
              message: "private configuration details",
            },
          },
          { status: 503 },
        ),
      ),
    );
    await expect(authenticate(input, true)).rejects.toThrow(
      "Account services are unavailable. Please try again shortly.",
    );
  });
});
