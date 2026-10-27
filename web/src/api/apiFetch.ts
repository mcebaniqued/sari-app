import { apiErrorResponseSchema } from "@sari/contracts";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string | undefined,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** A successful response was received, but its JSON representation was unreadable. */
export class ApiResponseParseError extends Error {
  constructor(public readonly status: number) {
    super(`Could not read the successful response (${status}).`);
    this.name = "ApiResponseParseError";
  }
}

interface RetryOptions {
  /** Additional attempts after the initial request; defaults to 2, maximum 5. */
  maxRetries?: number;
  /** Initial backoff ceiling in milliseconds; defaults to 300. */
  baseDelayMs?: number;
  /** Maximum wait per retry; defaults to 5,000 milliseconds. */
  maxDelayMs?: number;
}
export interface ApiFetchOptions extends RequestInit {
  /** Only GET, HEAD, and OPTIONS without bodies are retried. */
  retry?: false | RetryOptions;
}

const retryableStatuses = new Set([408, 429, 500, 502, 503, 504]);
const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "/api/v1").replace(
  /\/$/,
  "",
);

function retryPolicy(options: false | RetryOptions | undefined) {
  const {
    maxRetries = 2,
    baseDelayMs = 300,
    maxDelayMs = 5_000,
  } = (options === false ? {} : options) ?? {};
  if (
    !Number.isInteger(maxRetries) ||
    maxRetries < 0 ||
    maxRetries > 5 ||
    !Number.isFinite(baseDelayMs) ||
    baseDelayMs < 0 ||
    !Number.isFinite(maxDelayMs) ||
    maxDelayMs < baseDelayMs ||
    maxDelayMs > 60_000
  ) {
    throw new RangeError("Invalid API retry policy.");
  }

  return {
    maxRetries: options === false ? 0 : maxRetries,
    baseDelayMs,
    maxDelayMs,
  };
}

function retryAfterMs(response: Response): number | undefined {
  const value = response.headers.get("Retry-After")?.trim();
  if (!value) {
    return undefined;
  }

  if (/^\d+$/.test(value)) {
    return Number(value) * 1_000;
  }

  const date = Date.parse(value);

  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}

/** Cancellation also interrupts the backoff, releasing its timer and listener. */
function wait(
  ms: number,
  signal: AbortSignal | null | undefined,
): Promise<void> {
  signal?.throwIfAborted();

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- AbortSignal permits arbitrary reasons; preserve its native cancellation semantics.
      reject(signal?.reason);
    };

    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** Relative API paths. Mutations require an explicit user retry to avoid duplicate writes. */
export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T | undefined> {
  const { retry, ...init } = options;
  const { maxRetries, baseDelayMs, maxDelayMs } = retryPolicy(retry);
  const method = (init.method ?? "GET").toUpperCase();
  const isAuthRequest = path.replace(/^\//, "").startsWith("auth/");
  const retries =
    safeMethods.has(method) && (init.body === null || init.body === undefined)
      ? maxRetries
      : 0;
  const headers = new Headers(init.headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  for (let attempt = 0; ; attempt++) {
    init.signal?.throwIfAborted();
    const backoff =
      Math.min(maxDelayMs, baseDelayMs * 2 ** attempt) *
      (0.5 + Math.random() * 0.5);
    let response: Response;

    try {
      response = await fetch(`${apiBaseUrl}/${path.replace(/^\//, "")}`, {
        ...init,
        method,
        headers,
        credentials: "same-origin",
      });
    } catch (error) {
      init.signal?.throwIfAborted();
      // Fetch network failures are TypeErrors. Abort and programming errors are not retried.
      if (!(error instanceof TypeError) || attempt >= retries) {
        throw error;
      }

      await wait(backoff, init.signal);
      continue;
    }
    init.signal?.throwIfAborted();
    if (retryableStatuses.has(response.status) && attempt < retries) {
      const delay = Math.max(backoff, retryAfterMs(response) ?? 0);
      // Never retry earlier than the server asks; long waits are returned to the caller.
      if (delay <= maxDelayMs) {
        await response.body?.cancel().catch(() => undefined);
        await wait(delay, init.signal);
        continue;
      }
    }
    if (!response.ok) {
      if (response.status === 401 && !isAuthRequest) {
        window.dispatchEvent(new Event("sari:unauthorized"));
      }
      const body: unknown = await response.json().catch((error: unknown) => {
        init.signal?.throwIfAborted();
        if (error instanceof DOMException && error.name === "AbortError") {
          throw error;
        }

        return undefined;
      });
      init.signal?.throwIfAborted();
      // Better Auth returns { code, message }; the rest of the API wraps it in { error }.
      const result = apiErrorResponseSchema.safeParse(
        isAuthRequest &&
          typeof body === "object" &&
          body !== null &&
          !("error" in body)
          ? { error: body }
          : body,
      );
      throw new ApiError(
        result.success
          ? result.data.error.message
          : `Request failed (${response.status}).`,
        response.status,
        result.success ? result.data.error.code : undefined,
      );
    }

    if (
      method === "HEAD" ||
      response.status === 204 ||
      response.status === 205
    ) {
      return undefined;
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      init.signal?.throwIfAborted();
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }

      throw new ApiResponseParseError(response.status);
    }
    init.signal?.throwIfAborted();

    return body as T;
  }
}
