import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "./auth.js";

describe("account validation", () => {
  const input = {
    firstName: " René ",
    lastName: " 李 ",
    email: " Person@Example.com ",
    password: "  password  ",
  };
  it("normalizes names and email while preserving the exact password", () => {
    expect(registerSchema.parse(input)).toEqual({
      ...input,
      firstName: "René",
      lastName: "李",
      email: "person@example.com",
    });
    expect(loginSchema.parse(input).password).toBe(input.password);
  });
  it.each([
    { firstName: " " },
    { lastName: "" },
    { email: "bad-address" },
    { password: "a".repeat(11) },
    { password: "a".repeat(129) },
  ])("rejects invalid registration: %j", (invalid) => {
    expect(registerSchema.safeParse({ ...input, ...invalid }).success).toBe(
      false,
    );
  });
});
