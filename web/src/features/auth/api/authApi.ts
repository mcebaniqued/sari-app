import {
  authSessionSchema,
  authUserSchema,
  type LoginInput,
  type RegisterInput,
} from "@sari/contracts";

import { ApiError, apiFetch } from "@/api/apiFetch";

const authErrorMessages: Record<string, string> = {
  USER_ALREADY_EXISTS:
    "An account with this email already exists. Log in instead.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    "An account with this email already exists. Log in instead.",
  INVALID_EMAIL: "Enter a valid email address.",
  PASSWORD_TOO_SHORT: "Use at least 12 characters for your password.",
  PASSWORD_TOO_LONG: "Use no more than 128 characters for your password.",
  INVALID_EMAIL_OR_PASSWORD: "Invalid email or password.",
  INVALID_PASSWORD: "Invalid email or password.",
  USER_NOT_FOUND: "Invalid email or password.",
  CREDENTIAL_ACCOUNT_NOT_FOUND: "Invalid email or password.",
  INVALID_ORIGIN:
    "This website address is not allowed for sign-in. Open Sari using its configured address and try again.",
  MISSING_OR_NULL_ORIGIN:
    "The server could not verify this website address. Reload the page and try again.",
  CROSS_SITE_NAVIGATION_LOGIN_BLOCKED:
    "The server could not verify this sign-in request. Reload Sari and try again.",
  FAILED_TO_CREATE_SESSION:
    "Your account may have been created, but we could not sign you in. Try logging in.",
};

export async function getSession(signal?: AbortSignal) {
  const response = await apiFetch<unknown>("/auth/get-session", {
    ...(signal ? { signal } : {}),
    cache: "no-store",
  });
  return authSessionSchema.parse(response);
}

export async function authenticate(
  input: LoginInput | RegisterInput,
  register: boolean,
) {
  try {
    const response = await apiFetch<{ user: unknown }>(
      register ? "/auth/sign-up/email" : "/auth/sign-in/email",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...input,
          ...("firstName" in input && "lastName" in input
            ? { name: `${input.firstName} ${input.lastName}` }
            : {}),
        }),
      },
    );
    return authUserSchema.parse(response?.user);
  } catch (error) {
    let message = "Could not reach Sari. Check your connection and try again.";
    if (error instanceof ApiError) {
      const knownMessage =
        error.code && Object.hasOwn(authErrorMessages, error.code)
          ? authErrorMessages[error.code]
          : undefined;
      if (error.status === 429) {
        message = "Too many attempts. Please wait a minute and try again.";
      } else if (knownMessage) {
        message = knownMessage;
      } else if (error.status === 400 && error.code === "VALIDATION_ERROR") {
        message = error.message;
      } else if (error.status >= 500) {
        message = "Account services are unavailable. Please try again shortly.";
      } else {
        message = register
          ? "Could not create your account. Check your details and try again."
          : "Could not log in. Please try again.";
      }
    }
    throw new Error(message, { cause: error });
  }
}

export async function signOut() {
  await apiFetch("/auth/sign-out", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
}
