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

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "/api/v1").replace(
  /\/$/,
  "",
);

/** Use paths relative to /api/v1, for example apiFetch<HealthResponse>("/health"). */
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T | undefined> {
  const headers = new Headers(init.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  const response = await fetch(`${apiBaseUrl}/${path.replace(/^\//, "")}`, {
    ...init,
    headers,
    credentials: "same-origin",
  });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => undefined);
    const result = apiErrorResponseSchema.safeParse(body);
    throw new ApiError(
      result.success
        ? result.data.error.message
        : `Request failed (${response.status}).`,
      response.status,
      result.success ? result.data.error.code : undefined,
    );
  }

  if (response.status === 204) return undefined;
  return (await response.json()) as T;
}
