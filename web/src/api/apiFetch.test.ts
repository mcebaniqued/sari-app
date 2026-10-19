import type { HealthResponse } from "@sari/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch } from "./apiFetch";

afterEach(() => vi.unstubAllGlobals());

describe("API transport", () => {
  it("reads a JSON response through the relative API base path", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ status: "ok" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(apiFetch<HealthResponse>("/health")).resolves.toEqual({
      status: "ok",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/health",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("preserves structured server errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { error: { code: "NOT_FOUND", message: "Route not found." } },
            { status: 404 },
          ),
        ),
    );
    await expect(apiFetch("/missing")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      code: "NOT_FOUND",
      message: "Route not found.",
    });
  });

  it("handles non-JSON gateway errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Bad gateway", { status: 502 })),
    );
    await expect(apiFetch("/health")).rejects.toBeInstanceOf(ApiError);
    await expect(apiFetch("/health")).rejects.toMatchObject({ status: 502 });
  });

  it("handles a successful empty response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );
    await expect(apiFetch("/empty")).resolves.toBeUndefined();
  });

  it("falls back safely when JSON errors do not match the shared contract", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { error: { code: 42, message: { detail: "Unexpected response" } } },
            { status: 400 },
          ),
        ),
    );
    await expect(apiFetch("/missing")).rejects.toMatchObject({
      name: "ApiError",
      status: 400,
      code: undefined,
      message: "Request failed (400).",
    });
  });
});
