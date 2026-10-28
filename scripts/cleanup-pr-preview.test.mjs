import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanupPreview } from "./cleanup-pr-preview.mjs";

const sha = "731bcb476d8dbd731282075809786b9dd15b2507";
const team = "team_MUEMg6CizMZNgqyKjsoFJ34g";
const webProject = "prj_OHxiixXb4nyu0QpvxvEebcinjF9F";
const apiProject = "prj_BmU6UpVExAHnDxhtuPV9Kl7lHRfL";
const domain = "sari-web-pr141.vercel.app";
const origin = `https://${domain}`;
const initialOrigins = [
  "https://sari-web-staging-git-*-miguels-projects-51fb4258.vercel.app",
  origin,
  "https://sari-web-pr142.vercel.app",
];
const tokens = {
  webToken: "web-only-token",
  apiToken: "api-only-token",
  githubToken: "github-only-token",
  sleep: async () => {},
};

function event(overrides = {}) {
  return {
    action: "closed",
    repository: { full_name: "mcebaniqued/sari-app" },
    pull_request: {
      number: 141,
      head: {
        ref: "feat/135-unsaved-edit-conflict-recovery",
        repo: { full_name: "mcebaniqued/sari-app" },
      },
      base: { ref: "staging", repo: { full_name: "mcebaniqued/sari-app" } },
      ...overrides,
    },
  };
}

function mockVercel({
  exists = true,
  origins = initialOrigins,
  branch = "feat/135-unsaved-edit-conflict-recovery",
  envCount = 1,
  deploymentStates = ["READY"],
  githubSha = sha,
} = {}) {
  const calls = [];
  const state = {
    exists,
    origins: [...origins],
    deployments: [],
  };

  async function fetchImpl(url, options) {
    const request = new URL(url);
    const entry = {
      url: request,
      method: options.method,
      authorization: options.headers.Authorization,
      body: options.body ? JSON.parse(options.body) : undefined,
    };
    calls.push(entry);
    let status = 200;
    let body = {};

    if (
      request.hostname === "api.github.com" &&
      request.pathname.endsWith("/git/ref/heads/staging")
    ) {
      body = { object: { sha: githubSha } };
    } else if (
      request.pathname === `/v9/projects/${webProject}/domains/${domain}` &&
      options.method === "GET"
    ) {
      if (state.exists) {
        body = { name: domain, projectId: webProject, gitBranch: branch };
      } else {
        status = 404;
      }
    } else if (
      request.pathname === `/v9/projects/${webProject}/domains/${domain}` &&
      options.method === "DELETE"
    ) {
      state.exists = false;
      status = 204;
    } else if (
      request.pathname === `/v9/projects/${apiProject}/env` &&
      options.method === "GET"
    ) {
      body = {
        envs: Array.from({ length: envCount }, () => ({
          id: "trusted-var-id",
          key: "AUTH_TRUSTED_ORIGINS",
          type: "plain",
          target: ["production"],
          value: state.origins.join(","),
        })),
      };
    } else if (
      request.pathname === `/v9/projects/${apiProject}/env/trusted-var-id` &&
      options.method === "PATCH"
    ) {
      state.origins = entry.body.value.split(",").filter(Boolean);
      body = { key: "AUTH_TRUSTED_ORIGINS" };
    } else if (
      request.pathname === "/v13/deployments" &&
      options.method === "POST"
    ) {
      const index = state.deployments.length;
      const id = `dpl_Test${index + 1}`;
      state.deployments.push({
        id,
        readyState: deploymentStates[index] ?? "READY",
      });
      body = { deployment: { id } };
    } else if (
      request.pathname.startsWith("/v13/deployments/dpl_Test") &&
      options.method === "GET"
    ) {
      const id = request.pathname.split("/").at(-1);
      body = state.deployments.find((d) => d.id === id);
      if (!body) {
        status = 404;
      }
    } else {
      throw new Error(
        `Unexpected request ${options.method} ${request.pathname}`,
      );
    }

    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    };
  }
  return { calls, state, fetchImpl };
}

function assertTokenIsolation(calls) {
  for (const { url, authorization } of calls) {
    if (url.hostname === "api.github.com") {
      assert.equal(authorization, `Bearer ${tokens.githubToken}`);
    } else if (url.pathname.startsWith(`/v9/projects/${webProject}/`)) {
      assert.equal(authorization, `Bearer ${tokens.webToken}`);
    } else {
      assert.equal(authorization, `Bearer ${tokens.apiToken}`);
    }
    if (url.hostname === "api.vercel.com") {
      assert.equal(url.searchParams.get("teamId"), team);
    }
  }
}

function run(mock, overrides = {}) {
  return cleanupPreview({
    event: event(),
    fetchImpl: mock.fetchImpl,
    ...tokens,
    ...overrides,
  });
}

test("deletes only PR domain and origin, deploys current staging, and isolates tokens", async () => {
  const mock = mockVercel();
  const result = await run(mock);
  assert.deepEqual(result, {
    domainRemoved: true,
    originRemoved: true,
    redeployed: true,
  });
  assert.deepEqual(
    mock.calls.map((c) => `${c.method} ${c.url.pathname}`),
    [
      `GET /v9/projects/${webProject}/domains/${domain}`,
      `GET /v9/projects/${apiProject}/env`,
      "GET /repos/mcebaniqued/sari-app/git/ref/heads/staging",
      `DELETE /v9/projects/${webProject}/domains/${domain}`,
      `PATCH /v9/projects/${apiProject}/env/trusted-var-id`,
      "POST /v13/deployments",
      "GET /v13/deployments/dpl_Test1",
    ],
  );
  assert.deepEqual(
    mock.state.origins,
    initialOrigins.filter((o) => o !== origin),
  );
  const deployed = mock.calls.find((c) => c.method === "POST");
  assert.equal(deployed.body.project, apiProject);
  assert.equal(deployed.body.gitSource.sha, sha);
  assert.equal(deployed.body.target, "production");
  assertTokenIsolation(mock.calls);
});

test("missing domain still removes trusted origin and redeploys", async () => {
  const mock = mockVercel({ exists: false });
  const result = await run(mock);
  assert.deepEqual(result, {
    domainRemoved: false,
    originRemoved: true,
    redeployed: true,
  });
  assert.equal(
    mock.calls.some((c) => c.method === "DELETE"),
    false,
  );
});

test("both resources already absent still redeploys for failed-run recovery", async () => {
  const mock = mockVercel({ exists: false, origins: [initialOrigins[0]] });
  const result = await run(mock);
  assert.deepEqual(result, {
    domainRemoved: false,
    originRemoved: false,
    redeployed: true,
  });
  assert.equal(
    mock.calls.some((c) => c.method === "PATCH"),
    false,
  );
  assert.equal(
    mock.calls.some((c) => c.method === "POST"),
    true,
  );
});

test("a failed deployment is recovered on the next run without repeating deletion", async () => {
  const mock = mockVercel({ deploymentStates: ["ERROR", "READY"] });
  await assert.rejects(run(mock), /ended in ERROR/);
  const recovered = await run(mock);
  assert.deepEqual(recovered, {
    domainRemoved: false,
    originRemoved: false,
    redeployed: true,
  });
  assert.equal(mock.calls.filter((c) => c.method === "DELETE").length, 1);
  assert.equal(mock.calls.filter((c) => c.method === "PATCH").length, 1);
  assert.equal(mock.calls.filter((c) => c.method === "POST").length, 2);
});

test("domain on a different branch is rejected before mutation", async () => {
  const mock = mockVercel({ branch: "staging" });
  await assert.rejects(run(mock), /owning project or branch/);
  assert.equal(
    mock.calls.some((c) => ["PATCH", "DELETE", "POST"].includes(c.method)),
    false,
  );
});

test("duplicate trusted-origin vars are rejected before mutation", async () => {
  const mock = mockVercel({ envCount: 2 });
  await assert.rejects(run(mock), /exactly one readable/);
  assert.equal(
    mock.calls.some((c) => ["PATCH", "DELETE", "POST"].includes(c.method)),
    false,
  );
});

test("missing one project-scoped token fails before any request", async () => {
  for (const key of ["webToken", "apiToken", "githubToken"]) {
    const mock = mockVercel();
    await assert.rejects(run(mock, { [key]: "" }), /are required/);
    assert.equal(mock.calls.length, 0);
  }
});

test("untrusted events are rejected before any request", async () => {
  for (const badEvent of [
    event({
      base: { ref: "main", repo: { full_name: "mcebaniqued/sari-app" } },
    }),
    event({ head: { ref: "fork", repo: { full_name: "other/sari-app" } } }),
    event({ number: 0 }),
    { ...event(), action: "opened" },
  ]) {
    const mock = mockVercel();
    await assert.rejects(run(mock, { event: badEvent }), /Refusing cleanup/);
    assert.equal(mock.calls.length, 0);
  }
});

test("invalid GitHub staging SHA fails before deletion or edit", async () => {
  const mock = mockVercel({ githubSha: "invalid" });
  await assert.rejects(run(mock), /Unable to resolve current staging HEAD/);
  assert.equal(
    mock.calls.some((c) => ["PATCH", "DELETE", "POST"].includes(c.method)),
    false,
  );
});
