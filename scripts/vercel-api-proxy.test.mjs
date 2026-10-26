import assert from "node:assert/strict";
import { test } from "node:test";
import { createApiProxy } from "../web/api/proxy/[...path].ts";

const apiOrigin = "https://feature-api.example.com";

test("preview API proxy fails closed without a Vercel OIDC token", async () => {
  const fetcher = () => {
    throw new Error("The upstream API must not be called.");
  };
  const proxy = createApiProxy({ apiOrigin, fetcher });
  const response = await proxy(
    new Request("https://feature-web.example.com/api/proxy/v1/food-items"),
  );

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: {
      code: "SERVICE_UNAVAILABLE",
      message: "The preview API connection is unavailable.",
    },
  });
});

test("preview API proxy forwards session requests with short-lived OIDC identity", async () => {
  let upstreamRequest;
  const fetcher = async (input, init) => {
    upstreamRequest = new Request(input, init);

    return new Response(null, {
      status: 204,
      headers: { "x-upstream": "camera-diagnostics" },
    });
  };
  const proxy = createApiProxy({ apiOrigin, fetcher });
  const response = await proxy(
    new Request(
      "https://feature-web.example.com/api/proxy/v1/camera-diagnostics?source=test",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: "sari.session=opaque",
          origin: "https://feature-web.example.com",
          "x-vercel-oidc-token": "short-lived-token",
          "x-vercel-protection-bypass": "must-not-be-forwarded",
        },
        body: '{"events":[]}',
      },
    ),
  );

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("x-upstream"), "camera-diagnostics");
  assert.equal(
    upstreamRequest.url,
    "https://feature-api.example.com/api/v1/camera-diagnostics?source=test",
  );
  assert.equal(upstreamRequest.method, "POST");
  assert.equal(upstreamRequest.headers.get("cookie"), "sari.session=opaque");
  assert.equal(
    upstreamRequest.headers.get("origin"),
    "https://feature-web.example.com",
  );
  assert.equal(
    upstreamRequest.headers.get("x-vercel-trusted-oidc-idp-token"),
    "short-lived-token",
  );
  assert.equal(upstreamRequest.headers.get("x-vercel-oidc-token"), null);
  assert.equal(upstreamRequest.headers.get("x-vercel-protection-bypass"), null);
  assert.equal(await upstreamRequest.text(), '{"events":[]}');
});

test("preview API proxy rejects paths outside the API namespace", async () => {
  const proxy = createApiProxy({
    apiOrigin,
    fetcher: () => {
      throw new Error("The upstream API must not be called.");
    },
  });
  const response = await proxy(
    new Request("https://feature-web.example.com/api/proxy/admin", {
      headers: { "x-vercel-oidc-token": "short-lived-token" },
    }),
  );

  assert.equal(response.status, 404);
});

test("preview API proxy rejects unsafe upstream origins", () => {
  for (const origin of [
    undefined,
    "http://feature-api.example.com",
    "https://user:password@feature-api.example.com",
    "https://feature-api.example.com/api",
  ]) {
    assert.throws(() => createApiProxy({ apiOrigin: origin }));
  }
});
