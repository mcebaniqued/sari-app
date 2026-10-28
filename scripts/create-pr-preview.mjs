import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const TEAM_ID = "team_MUEMg6CizMZNgqyKjsoFJ34g";
const WEB_PROJECT_ID = "prj_OHxiixXb4nyu0QpvxvEebcinjF9F";
const API_PROJECT_ID = "prj_BmU6UpVExAHnDxhtuPV9Kl7lHRfL";
const REPOSITORY = "mcebaniqued/sari-app";
const API_PROJECT_NAME = "sari-api-staging";
const BASE_BRANCH = "staging";
const CI_NAME = "CI";
const CI_PATH = ".github/workflows/ci.yml";
const SHA_PATTERN = /^[a-f0-9]{40}$/;
const DOMAIN_VERIFICATION_ATTEMPTS = 12;
const DOMAIN_VERIFICATION_INTERVAL_MS = 2_500;

function validateTrigger(event) {
  const run = event?.workflow_run;
  if (
    event?.action !== "completed" ||
    event?.repository?.full_name !== REPOSITORY ||
    !Number.isSafeInteger(run?.id) ||
    run.id < 1 ||
    !Number.isSafeInteger(run?.workflow_id) ||
    run.workflow_id < 1 ||
    run?.name !== CI_NAME ||
    run?.path !== CI_PATH ||
    run?.event !== "pull_request" ||
    run?.status !== "completed" ||
    run?.conclusion !== "success" ||
    run?.repository?.full_name !== REPOSITORY ||
    !SHA_PATTERN.test(run?.head_sha)
  ) {
    throw new Error(
      "Refusing provisioning: the trigger is not a successful trusted CI pull-request run.",
    );
  }

  return {
    runId: run.id,
    workflowId: run.workflow_id,
    headSha: run.head_sha,
  };
}

function createClient(fetchImpl, { webToken, apiToken, githubToken }) {
  async function request(
    service,
    path,
    { method = "GET", body, notFoundOk = false } = {},
  ) {
    const isGitHub = service === "github";
    const token = { web: webToken, api: apiToken, github: githubToken }[
      service
    ];
    const url = new URL(
      path,
      isGitHub ? "https://api.github.com" : "https://api.vercel.com",
    );

    // Project-scoped tokens are also enforced by Vercel. These checks prevent
    // accidentally routing a production or cross-project request through them.
    if (service === "web") {
      const domainBase = `/v9/projects/${WEB_PROJECT_ID}/domains/`;
      const addDomainPath = `/v10/projects/${WEB_PROJECT_ID}/domains`;
      const verifyDomain = url.pathname.slice(
        domainBase.length,
        -"/verify".length,
      );
      const verifyDomainRoute =
        method === "POST" &&
        url.pathname.startsWith(domainBase) &&
        url.pathname.endsWith("/verify") &&
        verifyDomain.length > 0 &&
        !verifyDomain.includes("/");
      if (!(
        (method === "GET" && url.pathname.startsWith(domainBase)) ||
        (method === "POST" && url.pathname === addDomainPath) ||
        verifyDomainRoute
      )) {
        throw new Error(
          "Web token may only access staging web project domains.",
        );
      }
    } else if (service === "api") {
      const envBase = `/v9/projects/${API_PROJECT_ID}/env`;
      const deploymentRoute =
        url.pathname === "/v13/deployments" ||
        /^\/v13\/deployments\/dpl_[a-zA-Z0-9]+$/.test(url.pathname);
      if (
        url.pathname !== envBase &&
        !url.pathname.startsWith(`${envBase}/`) &&
        !deploymentRoute
      ) {
        throw new Error("API token may only access staging API resources.");
      }
    } else if (service === "github") {
      if (!url.pathname.startsWith(`/repos/${REPOSITORY}/`)) {
        throw new Error("GitHub token may only read the Sari repository.");
      }
    } else {
      throw new Error("Unknown API client.");
    }

    if (!isGitHub) {
      url.searchParams.set("teamId", TEAM_ID);
    }

    const response = await fetchImpl(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(isGitHub ? { "X-GitHub-Api-Version": "2022-11-28" } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(30_000),
    });

    if (response.status === 404 && notFoundOk) {
      return null;
    }
    if (!response.ok) {
      throw new Error(
        `${service} ${method} ${url.pathname} failed with HTTP ${response.status}`,
      );
    }
    if (response.status === 204) {
      return {};
    }

    try {
      return await response.json();
    } catch {
      throw new Error(
        `${service} ${method} ${url.pathname} returned invalid JSON.`,
      );
    }
  }

  return {
    web: (path, options) => request("web", path, options),
    api: (path, options) => request("api", path, options),
    github: (path, options) => request("github", path, options),
  };
}

function validateWorkflow(workflow, { workflowId }) {
  if (
    workflow?.id !== workflowId ||
    workflow?.name !== CI_NAME ||
    workflow?.path !== CI_PATH ||
    workflow?.state !== "active"
  ) {
    throw new Error(
      "Refusing provisioning: the trigger does not match the active trusted CI workflow.",
    );
  }
}

function validateWorkflowRun(run, { runId, workflowId, headSha }) {
  if (
    run?.id !== runId ||
    run?.workflow_id !== workflowId ||
    run?.name !== CI_NAME ||
    run?.path !== CI_PATH ||
    run?.event !== "pull_request" ||
    run?.status !== "completed" ||
    run?.conclusion !== "success" ||
    run?.repository?.full_name !== REPOSITORY ||
    run?.head_repository?.full_name !== REPOSITORY ||
    run?.head_sha !== headSha ||
    !Array.isArray(run?.pull_requests) ||
    run.pull_requests.length !== 1 ||
    !Number.isSafeInteger(run.pull_requests[0]?.number) ||
    run.pull_requests[0].number < 1
  ) {
    throw new Error(
      "Refusing provisioning: GitHub did not confirm one trusted in-repository CI pull-request run.",
    );
  }

  return run.pull_requests[0].number;
}

function validatePullRequest(pr, { number, headSha, expectedBranch } = {}) {
  const valid =
    pr?.number === number &&
    pr?.state === "open" &&
    pr?.base?.ref === BASE_BRANCH &&
    pr?.base?.repo?.full_name === REPOSITORY &&
    pr?.head?.repo?.full_name === REPOSITORY &&
    typeof pr?.head?.ref === "string" &&
    pr.head.ref.length > 0 &&
    pr?.head?.sha === headSha &&
    (expectedBranch === undefined || pr.head.ref === expectedBranch);

  if (!valid) {
    throw new Error(
      "Refusing provisioning: the PR is closed, forked, stale, or does not target staging.",
    );
  }

  return pr.head.ref;
}

function isProductionTarget(target) {
  return Array.isArray(target)
    ? target.includes("production")
    : target === "production";
}

function getTrustedOriginsVariable(envList) {
  const trustedVars =
    envList?.envs?.filter(
      (env) =>
        env.key === "AUTH_TRUSTED_ORIGINS" && isProductionTarget(env.target),
    ) ?? [];
  if (
    trustedVars.length !== 1 ||
    trustedVars[0].type !== "plain" ||
    typeof trustedVars[0].value !== "string" ||
    typeof trustedVars[0].id !== "string" ||
    !trustedVars[0].id
  ) {
    throw new Error(
      "Expected exactly one readable production AUTH_TRUSTED_ORIGINS variable; refusing provisioning.",
    );
  }

  return trustedVars[0];
}

function validateDomain(domainRecord, { domain, branch }) {
  if (
    domainRecord?.name !== domain ||
    domainRecord?.projectId !== WEB_PROJECT_ID ||
    domainRecord?.gitBranch !== branch
  ) {
    throw new Error(
      `Refusing to use ${domain}: its owning project or branch does not match this PR.`,
    );
  }
}

function validateDomainVerification(domainRecord, domain) {
  if (typeof domainRecord?.verified !== "boolean") {
    throw new Error(
      `Vercel returned an invalid verification status for ${domain}.`,
    );
  }

  return domainRecord.verified;
}

async function ensureDomainVerified({
  web,
  domainPath,
  domainRecord,
  domain,
  branch,
  sleep,
}) {
  validateDomain(domainRecord, { domain, branch });
  if (validateDomainVerification(domainRecord, domain)) {
    return;
  }

  for (let attempt = 0; attempt < DOMAIN_VERIFICATION_ATTEMPTS; attempt++) {
    const current =
      attempt === 0
        ? await web(`${domainPath}/verify`, { method: "POST" })
        : await web(domainPath);
    validateDomain(current, { domain, branch });
    if (validateDomainVerification(current, domain)) {
      console.info(`Verified PR domain ${domain}.`);
      return;
    }
    if (attempt < DOMAIN_VERIFICATION_ATTEMPTS - 1) {
      await sleep(DOMAIN_VERIFICATION_INTERVAL_MS);
    }
  }

  throw new Error(
    `PR domain ${domain} could not be verified after ${DOMAIN_VERIFICATION_ATTEMPTS} attempts.`,
  );
}

export async function createPreview({
  event,
  webToken,
  apiToken,
  githubToken,
  fetchImpl = fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  const trigger = validateTrigger(event);
  if (!webToken || !apiToken || !githubToken) {
    throw new Error(
      "VERCEL_WEB_TOKEN, VERCEL_API_TOKEN, and GITHUB_READ_TOKEN are required.",
    );
  }

  const { web, api, github } = createClient(fetchImpl, {
    webToken,
    apiToken,
    githubToken,
  });
  const workflow = await github(
    `/repos/${REPOSITORY}/actions/workflows/ci.yml`,
  );
  validateWorkflow(workflow, trigger);
  const run = await github(
    `/repos/${REPOSITORY}/actions/runs/${trigger.runId}`,
  );
  const number = validateWorkflowRun(run, trigger);
  const prPath = `/repos/${REPOSITORY}/pulls/${number}`;
  const initialPr = await github(prPath);
  const branch = validatePullRequest(initialPr, {
    number,
    headSha: trigger.headSha,
  });
  if (run.head_branch !== branch) {
    throw new Error(
      "Refusing provisioning: the CI branch does not match the pull request.",
    );
  }

  const domain = `sari-web-pr${number}.vercel.app`;
  const origin = `https://${domain}`;
  const domainPath = `/v9/projects/${WEB_PROJECT_ID}/domains/${domain}`;
  const existingDomain = await web(domainPath, { notFoundOk: true });
  if (existingDomain) {
    validateDomain(existingDomain, { domain, branch });
  }

  const envList = await api(`/v9/projects/${API_PROJECT_ID}/env`);
  const trustedVar = getTrustedOriginsVariable(envList);
  const origins = trustedVar.value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const originPresent = origins.includes(origin);

  async function recheckPullRequest() {
    const currentPr = await github(prPath);
    validatePullRequest(currentPr, {
      number,
      headSha: trigger.headSha,
      expectedBranch: branch,
    });
  }

  let domainCreated = false;
  let domainRecord = existingDomain;
  if (!existingDomain) {
    await recheckPullRequest();
    domainRecord = await web(`/v10/projects/${WEB_PROJECT_ID}/domains`, {
      method: "POST",
      body: { name: domain, gitBranch: branch },
    });
    validateDomain(domainRecord, { domain, branch });
    domainCreated = true;
    console.info(`Created PR #${number} short domain ${domain}.`);
  } else {
    console.info(`PR #${number} short domain already exists.`);
  }

  if (domainRecord.verified !== true) {
    await recheckPullRequest();
  }
  await ensureDomainVerified({
    web,
    domainPath,
    domainRecord,
    domain,
    branch,
    sleep,
  });

  let originAdded = false;
  if (!originPresent) {
    await recheckPullRequest();
    await api(
      `/v9/projects/${API_PROJECT_ID}/env/${encodeURIComponent(trustedVar.id)}`,
      { method: "PATCH", body: { value: [...origins, origin].join(",") } },
    );
    originAdded = true;
    console.info(`Added PR #${number} trusted origin.`);
  } else {
    console.info(`PR #${number} trusted origin already exists.`);
  }

  // Always deploy. A prior run may have updated Vercel's setting but failed
  // before a READY deployment, including when both resources now exist.
  await recheckPullRequest();
  const ref = await github(`/repos/${REPOSITORY}/git/ref/heads/${BASE_BRANCH}`);
  const stagingSha = ref?.object?.sha;
  if (typeof stagingSha !== "string" || !SHA_PATTERN.test(stagingSha)) {
    throw new Error(
      "Unable to resolve current staging HEAD; refusing API redeployment.",
    );
  }

  console.info("Redeploying staging API to apply/verify the current settings.");
  const deployment = await api("/v13/deployments?forceNew=1", {
    method: "POST",
    body: {
      name: API_PROJECT_NAME,
      project: API_PROJECT_ID,
      // "production" is the target within the staging-only API project.
      target: "production",
      gitSource: {
        type: "github",
        org: "mcebaniqued",
        repo: "sari-app",
        ref: BASE_BRANCH,
        sha: stagingSha,
      },
    },
  });
  const deploymentId = deployment?.deployment?.id ?? deployment?.id;
  if (
    typeof deploymentId !== "string" ||
    !/^dpl_[a-zA-Z0-9]+$/.test(deploymentId)
  ) {
    throw new Error(
      "Staging API redeployment did not return a valid deployment ID.",
    );
  }

  for (let attempt = 0; attempt < 48; attempt++) {
    const current = await api(`/v13/deployments/${deploymentId}`);
    const readyState =
      current?.deployment?.readyState ?? current?.readyState ?? current?.state;
    if (readyState === "READY") {
      console.info(
        `Provisioned ${origin}; staging API ${deploymentId} is READY at ${stagingSha.slice(0, 7)}.`,
      );
      return { domain, domainCreated, originAdded, redeployed: true };
    }
    if (["ERROR", "CANCELED", "BLOCKED"].includes(readyState)) {
      throw new Error(
        `Staging API redeployment ${deploymentId} ended in ${readyState}.`,
      );
    }
    await sleep(5_000);
  }

  throw new Error(
    `Staging API redeployment ${deploymentId} did not become READY.`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    throw new Error("GITHUB_EVENT_PATH is required.");
  }
  const event = JSON.parse(await readFile(eventPath, "utf8"));
  await createPreview({
    event,
    webToken: process.env.VERCEL_WEB_TOKEN,
    apiToken: process.env.VERCEL_API_TOKEN,
    githubToken: process.env.GITHUB_READ_TOKEN,
  });
}
