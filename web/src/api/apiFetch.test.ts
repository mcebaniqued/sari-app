import { afterEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "./apiFetch";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function useClock() {
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(1);
}

describe("API transport", () => {
  it("reads JSON and preserves headers and same-origin credentials", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ status: "ok" }));
    vi.stubGlobal("fetch", fetch);
    await expect(
      apiFetch("/health", { headers: { "X-Request-ID": "test" } }),
    ).resolves.toEqual({ status: "ok" });
    const options = fetch.mock.calls[0]?.[1] as RequestInit;
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/health",
      expect.objectContaining({ credentials: "same-origin" }),
    );
    expect(new Headers(options.headers).get("Accept")).toBe("application/json");
    expect(new Headers(options.headers).get("X-Request-ID")).toBe("test");
    expect(options).not.toHaveProperty("retry");
  });

  it("preserves structured errors and never retries validation or authorization errors", async () => {
    for (const status of [400, 401, 403, 404, 409, 422]) {
      const fetch = vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { error: { code: "REJECTED", message: "Request rejected." } },
            { status },
          ),
        );
      vi.stubGlobal("fetch", fetch);
      await expect(apiFetch("/missing")).rejects.toMatchObject({
        name: "ApiError",
        status,
        code: "REJECTED",
        message: "Request rejected.",
      });
      expect(fetch).toHaveBeenCalledTimes(1);
    }
  });

  it("handles non-JSON gateway errors when retries are disabled", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Bad gateway", { status: 502 })),
    );
    await expect(apiFetch("/health", { retry: false })).rejects.toMatchObject({
      name: "ApiError",
      status: 502,
    });
  });

  it.each([204, 205])("handles empty status %s", async (status) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status })),
    );
    await expect(apiFetch("/empty")).resolves.toBeUndefined();
  });

  it("handles HEAD without attempting JSON parsing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null)));
    await expect(
      apiFetch("/health", { method: "HEAD" }),
    ).resolves.toBeUndefined();
  });

  it("falls back safely for malformed error contracts", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ error: { code: 42, message: {} } }, { status: 400 }),
        ),
    );
    await expect(apiFetch("/missing")).rejects.toMatchObject({
      message: "Request failed (400).",
      code: undefined,
    });
  });

  it("retries network failures with increasing, bounded exponential delays", async () => {
    useClock();
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Offline"))
      .mockRejectedValueOnce(new TypeError("Offline"))
      .mockResolvedValue(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetch);
    const pending = apiFetch("/health");
    await vi.advanceTimersByTimeAsync(299);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetch).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(599);
    expect(fetch).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it.each([408, 429, 500, 502, 503, 504])(
    "retries temporary HTTP %s responses",
    async (status) => {
      useClock();
      const cancel = vi.fn().mockResolvedValue(undefined);
      const fetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(new ReadableStream({ cancel }), { status }),
        )
        .mockResolvedValue(Response.json({ ok: true }));
      vi.stubGlobal("fetch", fetch);
      const pending = apiFetch("/health");
      await vi.runAllTimersAsync();
      await expect(pending).resolves.toEqual({ ok: true });
      expect(cancel).toHaveBeenCalledOnce();
      expect(fetch).toHaveBeenCalledTimes(2);
    },
  );

  it("stops after its retry budget and returns the final structured error", async () => {
    useClock();
    const fetch = vi
      .fn()
      .mockImplementation(() =>
        Response.json(
          { error: { code: "UNAVAILABLE", message: "Try later." } },
          { status: 503 },
        ),
      );
    vi.stubGlobal("fetch", fetch);
    const rejected = expect(apiFetch("/health")).rejects.toMatchObject({
      status: 503,
      code: "UNAVAILABLE",
      message: "Try later.",
    });
    await vi.runAllTimersAsync();
    await rejected;
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["POST", "PATCH", "PUT", "DELETE"])(
    "never automatically repeats %s writes",
    async (method) => {
      const fetch = vi.fn().mockRejectedValue(new TypeError("Lost connection"));
      vi.stubGlobal("fetch", fetch);
      await expect(
        apiFetch("/food-items", { method, retry: { maxRetries: 5 } }),
      ).rejects.toThrow("Lost connection");
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );

  it.each(["2", "Mon, 19 Oct 2026 00:00:02 GMT"])(
    "respects Retry-After %s",
    async (header) => {
      useClock();
      vi.setSystemTime(new Date("2026-10-19T00:00:00Z"));
      const fetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(null, {
            status: 429,
            headers: { "Retry-After": header },
          }),
        )
        .mockResolvedValue(Response.json({ ok: true }));
      vi.stubGlobal("fetch", fetch);
      const pending = apiFetch("/health");
      await vi.advanceTimersByTimeAsync(1999);
      expect(fetch).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      await expect(pending).resolves.toEqual({ ok: true });
    },
  );

  it("returns long Retry-After responses without retrying too early", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(null, { status: 429, headers: { "Retry-After": "120" } }),
      );
    vi.stubGlobal("fetch", fetch);
    await expect(apiFetch("/health")).rejects.toMatchObject({ status: 429 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("rejects an already aborted signal without sending a request", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const reason = new Error("Navigation changed");
    await expect(
      apiFetch("/health", { signal: AbortSignal.abort(reason) }),
    ).rejects.toBe(reason);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("cancels a backoff immediately and clears timers and listeners", async () => {
    useClock();
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    const fetch = vi.fn().mockRejectedValue(new TypeError("Offline"));
    vi.stubGlobal("fetch", fetch);
    const pending = apiFetch("/health", { signal: controller.signal });
    const rejected = expect(pending).rejects.toMatchObject({
      name: "AbortError",
    });
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
    await vi.runAllTimersAsync();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("passes the signal into fetch and preserves in-flight cancellation", async () => {
    const controller = new AbortController();
    const fetch = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener(
            "abort",
            () => {
              reject(new DOMException("Cancelled", "AbortError"));
            },
            { once: true },
          );
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const pending = apiFetch("/health", { signal: controller.signal });
    const rejected = expect(pending).rejects.toMatchObject({
      name: "AbortError",
    });
    controller.abort();
    await rejected;
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it("does not turn aborted error-body reads into ApiErrors", async () => {
    const controller = new AbortController();
    const response = new Response(null, { status: 400 });
    vi.spyOn(response, "json").mockImplementation(() => {
      controller.abort();
      return Promise.reject(new DOMException("Cancelled", "AbortError"));
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    await expect(
      apiFetch("/health", { signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("never retries invalid successful JSON or programming errors", async () => {
    for (const error of [
      new Error("Application bug"),
      new DOMException("Cancelled", "AbortError"),
    ]) {
      const fetch = vi.fn().mockRejectedValue(error);
      vi.stubGlobal("fetch", fetch);
      await expect(apiFetch("/health")).rejects.toBe(error);
      expect(fetch).toHaveBeenCalledOnce();
    }
    const fetch = vi.fn().mockResolvedValue(new Response("Invalid JSON"));
    vi.stubGlobal("fetch", fetch);
    await expect(apiFetch("/health")).rejects.toBeInstanceOf(SyntaxError);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("validates retry configuration before sending requests", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(
      apiFetch("/health", { retry: { maxRetries: -1 } }),
    ).rejects.toBeInstanceOf(RangeError);
    expect(fetch).not.toHaveBeenCalled();
  });
});
