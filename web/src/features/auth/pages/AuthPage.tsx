import { loginSchema, registerSchema } from "@sari/contracts";
import { type SubmitEvent, useEffect, useRef, useState } from "react";
import { LuEye, LuEyeOff, LuLeaf } from "react-icons/lu";
import { Link, useLocation, useNavigate } from "react-router-dom";

import Input from "@/components/Input/Input";

import { authenticate } from "../api/authApi";
import { useAuth } from "../context/AuthContext";
import { safeReturnPath } from "../utils/returnPath";

export default function AuthPage({ register = false }: { register?: boolean }) {
  const { signedIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const routeState: unknown = location.state;
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pending = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const title = register ? "Create an account" : "Log in";

  useEffect(() => {
    document.title = `${title} | Sari`;
    heading.current?.focus();
  }, [title]);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) {
      return;
    }

    const data = Object.fromEntries(new FormData(event.currentTarget));
    const result = register
      ? registerSchema.safeParse(data)
      : loginSchema.safeParse(data);
    setError("");
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Check your details.");

      return;
    }

    pending.current = true;
    setBusy(true);

    try {
      const user = await authenticate(result.data, register);
      const state: unknown = location.state;
      const returnTo =
        typeof state === "object" && state !== null && "returnTo" in state
          ? state.returnTo
          : undefined;
      signedIn(user);
      await navigate(register ? "/pantry" : safeReturnPath(returnTo), {
        replace: true,
      });
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not reach Sari. Check your connection and try again.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-page px-4 py-12 text-content">
      <div className="w-full max-w-105">
        <div className="mb-8 flex items-center justify-center gap-2.5 text-2xl font-semibold tracking-tight">
          <span className="flex size-10 items-center justify-center rounded-panel bg-brand text-content-inverse">
            <LuLeaf aria-hidden="true" className="size-6" />
          </span>
          Sari
        </div>
        <section
          aria-labelledby="auth-heading"
          className="rounded-panel border border-border-default bg-surface p-6 sm:p-8"
        >
          <h1
            id="auth-heading"
            ref={heading}
            tabIndex={-1}
            className="mb-6 text-2xl font-semibold outline-none"
          >
            {title}
          </h1>
          <form
            onSubmit={(event) => {
              void submit(event);
            }}
            className="space-y-5"
            aria-busy={busy}
          >
            <fieldset disabled={busy} className="space-y-5">
              <legend className="sr-only">
                {register ? "Registration details" : "Login details"}
              </legend>
              {register ? (
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="firstName"
                      className="mb-1.5 block text-sm font-medium"
                    >
                      First name
                    </label>
                    <Input
                      id="firstName"
                      name="firstName"
                      autoComplete="given-name"
                      required
                      maxLength={80}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="lastName"
                      className="mb-1.5 block text-sm font-medium"
                    >
                      Last name
                    </label>
                    <Input
                      id="lastName"
                      name="lastName"
                      autoComplete="family-name"
                      required
                      maxLength={80}
                    />
                  </div>
                </div>
              ) : null}
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-sm font-medium"
                >
                  Email
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  maxLength={254}
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-sm font-medium"
                >
                  Password
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={
                      register ? "new-password" : "current-password"
                    }
                    required
                    minLength={register ? 12 : 1}
                    maxLength={128}
                    aria-describedby={register ? "password-help" : undefined}
                    className="pr-12"
                  />
                  <button
                    type="button"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    aria-pressed={showPassword}
                    onClick={() => {
                      setShowPassword((value) => !value);
                    }}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-control text-content-muted focus-visible:outline-2 focus-visible:outline-brand"
                  >
                    {showPassword ? (
                      <LuEyeOff aria-hidden="true" className="size-5" />
                    ) : (
                      <LuEye aria-hidden="true" className="size-5" />
                    )}
                  </button>
                </div>
                {register ? (
                  <p
                    id="password-help"
                    className="mt-2 text-sm text-content-muted"
                  >
                    Use 12–128 characters. Spaces are welcome.
                  </p>
                ) : null}
              </div>
            </fieldset>
            {error ? (
              <p
                role="alert"
                className="rounded-control border border-danger-border bg-danger-subtle p-3 text-sm text-danger"
              >
                {error}
              </p>
            ) : null}
            <button
              disabled={busy}
              className="w-full rounded-control bg-brand px-4 py-2.5 text-sm font-semibold text-content-inverse hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50"
            >
              {busy ? (register ? "Creating account…" : "Logging in…") : title}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-content-muted">
            {register ? "Already have an account?" : "New to Sari?"}{" "}
            <Link
              to={register ? "/login" : "/register"}
              state={routeState}
              className="font-semibold text-brand underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {register ? "Log in" : "Create an account"}
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
