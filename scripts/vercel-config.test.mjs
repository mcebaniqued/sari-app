import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

function loadConfig(environment, apiOrigin = "") {
  return spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      "import {config} from './web/vercel.mjs'; process.stdout.write(JSON.stringify(config));",
    ],
    {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      env: {
        ...process.env,
        VERCEL_ENV: environment,
        SARI_API_ORIGIN: apiOrigin,
      },
      encoding: "utf8",
    },
  );
}

test("production retains same-origin API proxy before the SPA fallback", () => {
  const result = loadConfig("production");
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout).rewrites, [
    {
      source: "/api/v1/:path*",
      destination: "https://sari-api.vercel.app/api/v1/:path*",
    },
    { source: "/(.*)", destination: "/index.html" },
  ]);
});

test("preview uses the isolated API", () => {
  const result = loadConfig("preview", "https://sari-api-preview.vercel.app");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    JSON.parse(result.stdout).rewrites[0].destination,
    "https://sari-api-preview.vercel.app/api/v1/:path*",
  );
});

test("preview fails closed without an API or with the production API", () => {
  for (const origin of ["", "https://sari-api.vercel.app"]) {
    assert.notEqual(loadConfig("preview", origin).status, 0);
  }
});

test("API origin rejects credentials, HTTP, paths, queries, and fragments", () => {
  for (const origin of [
    "http://sari-api-preview.vercel.app",
    "https://user:password@sari-api-preview.vercel.app",
    "https://sari-api-preview.vercel.app/api",
    "https://sari-api-preview.vercel.app?key=value",
    "https://sari-api-preview.vercel.app#fragment",
  ]) {
    assert.notEqual(loadConfig("preview", origin).status, 0);
  }
});
