import assert from "node:assert/strict";
import { test } from "node:test";
import { createPreview } from "./create-pr-preview.mjs";

const headSha = "731bcb476d8dbd731282075809786b9dd15b2507";
const stagingSha = "10c1af66bc345f46af17e74115a5151efb0cc575";
const team = "team_MUEMg6CizMZNgqyKjsoFJ34g";
const webProject = "prj_OHxiixXb4nyu0QpvxvEebcinjF9F";
const apiProject = "prj_BmU6UpVExAHnDxhtuPV9Kl7lHRfL";
const repository = "mcebaniqued/sari-app";
const branch = "ci/automate-pr-preview-creation";
const domain = "sari-web-pr143.vercel.app";
const origin = `https://${domain}`;
const wildcardOrigin =
  "https://sari-web-staging-git-*-miguels-projects-51fb4258.vercel.app";
const tokens = {
  webToken: "web-only-token",
  apiToken: "api-only-token",
  githubToken: "github-only-token",
  sleep: async () => {},
};
const workflowId = 389025578;

function workflowEvent(runOverrides = {}, eventOverrides = {}) {
  return {
    action: "completed",
    repository: { full_name: repository },
    workflow_run: {
      id: 12345,
      workflow_id: workflowId,
      name: "CI",
      path: ".github/workflows/ci.yml",
      event: "pull_request",
      status: "completed",
      conclusion: "success",
      head_sha: headSha,
      repository: { full_name: repository },
      ...runOverrides,
    },
    ...eventOverrides,
  };
}

function pullRequest(overrides = {}) {
  return {
    number: 143,
    state: "open",
    base: { ref: "staging", repo: { full_name: repository } },
    head: {
      ref: branch,
      sha: headSha,
      repo: { full_name: repository },
    },
    ...overrides,
  };
}

function workflowRun(overrides = {}) {
  return {
    id: 12345,
    workflow_id: workflowId,
    name: "CI",
    path: ".github/workflows/ci.yml",
    event: "pull_request",
    status: "completed",
    conclusion: "success",
    head_branch: branch,
    head_sha: headSha,
    repository: { full_name: repository },
    head_repository: { full_name: repository },
    pull_requests: [{ number: 143 }],
    ...overrides,
  };
}

function mockServices({
  domainExists = false,
  domainBranch = branch,
  domainProject = webProject,
  origins = [wildcardOrigin],
  envCount = 1,
  envType = "plain",
  workflow = {
    id: workflowId,
    name: "CI",
    path: ".github/workflows/ci.yml",
    state: "active",
  },
  run = workflowRun(),
  pr = pullRequest(),
  prSequence,
  deploymentStates = ["READY"],
  stagingRef = stagingSha,
  failRequest,
  invalidJsonRequest,
} = {}) {
  const calls = [];
  const state = {
    domainExists,
    domainBranch,
    domainProject,
    origins: [...origins],
    deployments: [],
    prReads: 0,
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

    if (failRequest?.(entry)) {
      return { ok: false, status: 503, json: async () => ({}) };
    }
    if (invalidJsonRequest?.(entry)) {
      return {
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError("invalid JSON");
        },
      };
    }

    let status = 200;
    let body = {};
    if (request.pathname === `/repos/${repository}/actions/workflows/ci.yml`) {
      body = workflow;
    } else if (request.pathname === `/repos/${repository}/actions/runs/12345`) {
      body = run;
    } else if (request.pathname === `/repos/${repository}/pulls/143`) {
      const selected = prSequence?.[state.prReads] ?? pr;
      state.prReads += 1;
      body = selected;
    } else if (
      request.pathname === `/repos/${repository}/git/ref/heads/staging`
    ) {
      body = { object: { sha: stagingRef } };
    } else if (
      request.pathname === `/v9/projects/${webProject}/domains/${domain}` &&
      options.method === "GET"
    ) {
      if (state.domainExists) {
        body = {
          name: domain,
          projectId: state.domainProject,
          gitBranch: state.domainBranch,
        };
      } else {
        status = 404;
      }
    } else if (
      request.pathname === `/v10/projects/${webProject}/domains` &&
      options.method === "POST"
    ) {
      state.domainExists = true;
      state.domainProject = webProject;
      state.domainBranch = entry.body.gitBranch;
      body = {
        name: entry.body.name,
        projectId: state.domainProject,
        gitBranch: state.domainBranch,
      };
    } else if (
      request.pathname === `/v9/projects/${apiProject}/env` &&
      options.method === "GET"
    ) {
      body = {
        envs: Array.from({ length: envCount }, (_, index) => ({
          id: `trusted-var-${index + 1}`,
          key: "AUTH_TRUSTED_ORIGINS",
          type: envType,
          target: ["production"],
          value: state.origins.join(","),
        })),
      };
    } else if (
      request.pathname === `/v9/projects/${apiProject}/env/trusted-var-1` &&
      options.method === "PATCH"
    ) {
      state.origins = entry.body.value.split(",").filter(Boolean);
      body = { id: "trusted-var-1", key: "AUTH_TRUSTED_ORIGINS" };
    } else if (
      request.pathname === "/v13/deployments" &&
      options.method === "POST"
    ) {
      const index = state.deployments.length;
      const id = `dpl_Test${index + 1}`;
      state.deployments.push({
        id,
        readyState: deploymentStates[index] ?? deploymentStates.at(-1),
      });
      body = { deployment: { id } };
    } else if (
      request.pathname.startsWith("/v13/deployments/dpl_Test") &&
      options.method === "GET"
    ) {
      const id = request.pathname.split("/").at(-1);
      body = state.deployments.find((deployment) => deployment.id === id);
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

function run(mock, overrides = {}) {
  return createPreview({
    event: workflowEvent(),
    fetchImpl: mock.fetchImpl,
    ...tokens,
    ...overrides,
  });
}

function mutations(calls) {
  return calls.filter((call) =>
    ["POST", "PATCH", "DELETE"].includes(call.method),
  );
}

function assertTokenIsolation(calls) {
  for (const { url, authorization } of calls) {
    if (url.hostname === "api.github.com") {
      assert.equal(authorization, `Bearer ${tokens.githubToken}`);
    } else if (url.pathname.includes(`/projects/${webProject}/`)) {
      assert.equal(authorization, `Bearer ${tokens.webToken}`);
    } else {
      assert.equal(authorization, `Bearer ${tokens.apiToken}`);
    }
    if (url.hostname === "api.vercel.com") {
      assert.equal(url.searchParams.get("teamId"), team);
    }
  }
}

test("provisions the PR-number domain, exact branch, trusted origin, and current staging API", async () => {
  const mock = mockServices();
  const result = await run(mock);

  assert.deepEqual(result, {
    domain,
    domainCreated: true,
    originAdded: true,
    redeployed: true,
  });
  assert.deepEqual(mock.state.origins, [wildcardOrigin, origin]);
  const domainRequest = mock.calls.find(
    (call) => call.url.pathname === `/v10/projects/${webProject}/domains`,
  );
  assert.deepEqual(domainRequest.body, { name: domain, gitBranch: branch });
  const deployment = mock.calls.find(
    (call) =>
      call.method === "POST" && call.url.pathname === "/v13/deployments",
  );
  assert.equal(deployment.body.project, apiProject);
  assert.equal(deployment.body.name, "sari-api-staging");
  assert.equal(deployment.body.target, "production");
  assert.equal(deployment.body.gitSource.ref, "staging");
  assert.equal(deployment.body.gitSource.sha, stagingSha);
  assertTokenIsolation(mock.calls);
});

test("repeated execution avoids duplicates and still verifies a READY deployment", async () => {
  const mock = mockServices();
  await run(mock);
  const repeated = await run(mock);

  assert.deepEqual(repeated, {
    domain,
    domainCreated: false,
    originAdded: false,
    redeployed: true,
  });
  assert.equal(
    mock.calls.filter(
      (call) => call.url.pathname === `/v10/projects/${webProject}/domains`,
    ).length,
    1,
  );
  assert.equal(mock.calls.filter((call) => call.method === "PATCH").length, 1);
  assert.equal(
    mock.calls.filter((call) => call.url.pathname === "/v13/deployments")
      .length,
    2,
  );
  assert.equal(mock.state.origins.filter((item) => item === origin).length, 1);
});

test("an existing correct domain only adds the missing origin", async () => {
  const mock = mockServices({ domainExists: true });
  const result = await run(mock);

  assert.equal(result.domainCreated, false);
  assert.equal(result.originAdded, true);
  assert.equal(
    mock.calls.some(
      (call) => call.url.pathname === `/v10/projects/${webProject}/domains`,
    ),
    false,
  );
});

test("an existing origin is preserved while the missing domain is created", async () => {
  const mock = mockServices({ origins: [wildcardOrigin, origin] });
  const result = await run(mock);

  assert.equal(result.domainCreated, true);
  assert.equal(result.originAdded, false);
  assert.deepEqual(mock.state.origins, [wildcardOrigin, origin]);
  assert.equal(
    mock.calls.some((call) => call.method === "PATCH"),
    false,
  );
});

test("a failed deployment is recovered without repeating prior mutations", async () => {
  const mock = mockServices({ deploymentStates: ["ERROR", "READY"] });
  await assert.rejects(run(mock), /ended in ERROR/);
  const recovered = await run(mock);

  assert.equal(recovered.domainCreated, false);
  assert.equal(recovered.originAdded, false);
  assert.equal(
    mock.calls.filter(
      (call) => call.url.pathname === `/v10/projects/${webProject}/domains`,
    ).length,
    1,
  );
  assert.equal(mock.calls.filter((call) => call.method === "PATCH").length, 1);
  assert.equal(
    mock.calls.filter((call) => call.url.pathname === "/v13/deployments")
      .length,
    2,
  );
});

test("untrusted workflow triggers fail before API access", async () => {
  for (const event of [
    workflowEvent({ name: "Other" }),
    workflowEvent({ workflow_id: 0 }),
    workflowEvent({ path: ".github/workflows/other.yml" }),
    workflowEvent({ event: "push" }),
    workflowEvent({ conclusion: "failure" }),
    workflowEvent({}, { repository: { full_name: "other/sari-app" } }),
  ]) {
    const mock = mockServices();
    await assert.rejects(run(mock, { event }), /trigger/);
    assert.equal(mock.calls.length, 0);
  }
});

test("incorrect repository, base branch, fork, closed PR, and stale CI SHA are rejected", async () => {
  const cases = [
    workflowRun({ workflow_id: workflowId + 1 }),
    workflowRun({ repository: { full_name: "other/sari-app" } }),
    workflowRun({ head_repository: { full_name: "other/sari-app" } }),
    pullRequest({
      base: { ref: "main", repo: { full_name: repository } },
    }),
    pullRequest({
      head: {
        ref: branch,
        sha: headSha,
        repo: { full_name: "contributor/sari-app" },
      },
    }),
    pullRequest({ state: "closed" }),
    pullRequest({
      head: {
        ref: branch,
        sha: stagingSha,
        repo: { full_name: repository },
      },
    }),
  ];

  for (const value of cases) {
    const mock = value.pull_requests
      ? mockServices({ run: value })
      : mockServices({ pr: value });
    await assert.rejects(run(mock), /Refusing provisioning/);
    assert.equal(mutations(mock.calls).length, 0);
  }
});

test("a trigger that does not match the active default-branch CI workflow is rejected", async () => {
  for (const workflow of [
    {
      id: workflowId + 1,
      name: "CI",
      path: ".github/workflows/ci.yml",
      state: "active",
    },
    {
      id: workflowId,
      name: "Other",
      path: ".github/workflows/ci.yml",
      state: "active",
    },
    {
      id: workflowId,
      name: "CI",
      path: ".github/workflows/ci.yml",
      state: "disabled_manually",
    },
  ]) {
    const mock = mockServices({ workflow });
    await assert.rejects(run(mock), /active trusted CI workflow/);
    assert.equal(mutations(mock.calls).length, 0);
  }
});

test("a PR closed during provisioning is rechecked before domain creation", async () => {
  const mock = mockServices({
    prSequence: [pullRequest(), pullRequest({ state: "closed" })],
  });
  await assert.rejects(run(mock), /closed, forked, stale/);
  assert.equal(mutations(mock.calls).length, 0);
});

test("a domain associated with another branch or project fails before mutation", async () => {
  for (const options of [
    { domainExists: true, domainBranch: "staging" },
    { domainExists: true, domainProject: "prj_Other" },
  ]) {
    const mock = mockServices(options);
    await assert.rejects(run(mock), /owning project or branch/);
    assert.equal(mutations(mock.calls).length, 0);
  }
});

test("incorrect trusted-origin environment configuration fails before mutation", async () => {
  for (const options of [
    { envCount: 0 },
    { envCount: 2 },
    { envType: "encrypted" },
  ]) {
    const mock = mockServices(options);
    await assert.rejects(run(mock), /exactly one readable/);
    assert.equal(mutations(mock.calls).length, 0);
  }
});

test("missing credentials fail before API access", async () => {
  for (const key of ["webToken", "apiToken", "githubToken"]) {
    const mock = mockServices();
    await assert.rejects(run(mock, { [key]: "" }), /are required/);
    assert.equal(mock.calls.length, 0);
  }
});

test("failed and timed-out deployments do not report success", async () => {
  const failed = mockServices({ deploymentStates: ["BLOCKED"] });
  await assert.rejects(run(failed), /ended in BLOCKED/);

  const timedOut = mockServices({ deploymentStates: ["BUILDING"] });
  await assert.rejects(run(timedOut), /did not become READY/);
  assert.equal(
    timedOut.calls.filter(
      (call) => call.url.pathname === "/v13/deployments/dpl_Test1",
    ).length,
    48,
  );
});

test("invalid staging refs and deployment responses fail clearly", async () => {
  const invalidRef = mockServices({ stagingRef: "invalid" });
  await assert.rejects(
    run(invalidRef),
    /Unable to resolve current staging HEAD/,
  );
  assert.equal(
    invalidRef.calls.some((call) => call.url.pathname === "/v13/deployments"),
    false,
  );

  const invalidDeployment = mockServices();
  const originalFetch = invalidDeployment.fetchImpl;
  invalidDeployment.fetchImpl = async (url, options) => {
    const request = new URL(url);
    if (request.pathname === "/v13/deployments" && options.method === "POST") {
      invalidDeployment.calls.push({
        url: request,
        method: options.method,
        authorization: options.headers.Authorization,
        body: JSON.parse(options.body),
      });
      return { ok: true, status: 200, json: async () => ({ id: "invalid" }) };
    }
    return originalFetch(url, options);
  };
  await assert.rejects(run(invalidDeployment), /valid deployment ID/);
});

test("GitHub and Vercel API errors and invalid JSON are surfaced", async () => {
  const githubFailure = mockServices({
    failRequest: (call) => call.url.pathname.includes("/actions/runs/"),
  });
  await assert.rejects(run(githubFailure), /github GET .* HTTP 503/);

  const vercelFailure = mockServices({
    failRequest: (call) => call.url.pathname.endsWith(`/domains/${domain}`),
  });
  await assert.rejects(run(vercelFailure), /web GET .* HTTP 503/);

  const invalidJson = mockServices({
    invalidJsonRequest: (call) => call.url.pathname.includes("/actions/runs/"),
  });
  await assert.rejects(run(invalidJson), /returned invalid JSON/);
});
