import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const TEAM_ID = "team_MUEMg6CizMZNgqyKjsoFJ34g";
const WEB_PROJECT_ID = "prj_OHxiixXb4nyu0QpvxvEebcinjF9F";
const API_PROJECT_ID = "prj_BmU6UpVExAHnDxhtuPV9Kl7lHRfL";
const REPOSITORY = "mcebaniqued/sari-app";
const API_PROJECT_NAME = "sari-api-staging";
const BASE_BRANCH = "staging";

function validateEvent(event) {
  const pr = event?.pull_request;
  if (
    event?.action !== "closed" ||
    event?.repository?.full_name !== REPOSITORY ||
    pr?.base?.ref !== BASE_BRANCH ||
    pr?.base?.repo?.full_name !== REPOSITORY ||
    pr?.head?.repo?.full_name !== REPOSITORY ||
    !Number.isSafeInteger(pr?.number) ||
    pr.number < 1 ||
    typeof pr?.head?.ref !== "string" ||
    !pr.head.ref
  ) {
    throw new Error(
      "Refusing cleanup: this is not a closed, in-repository PR targeting staging.",
    );
  }

  return {
    number: pr.number,
    branch: pr.head.ref,
    domain: `sari-web-pr${pr.number}.vercel.app`,
    origin: `https://sari-web-pr${pr.number}.vercel.app`,
  };
}

function createClient(fetchImpl, { webToken, apiToken, githubToken }) {
  async function request(
    service,
    path,
    { method = "GET", body, notFoundOk = false } = {},
  ) {
    const isGitHub = service === "github";
    const token = {
      web: webToken,
      api: apiToken,
      github: githubToken,
    }[service];
    const url = new URL(
      path,
      isGitHub ? "https://api.github.com" : "https://api.vercel.com",
    );

    // Project-scoped tokens are also enforced by Vercel. These checks
    // prevent accidentally routing a request through the wrong client.
    if (service === "web") {
      if (!url.pathname.startsWith(`/v9/projects/${WEB_PROJECT_ID}/domains/`)) {
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
    } else if (!isGitHub) {
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
    return response.json();
  }

  return {
    web: (path, options) => request("web", path, options),
    api: (path, options) => request("api", path, options),
    github: (path, options) => request("github", path, options),
  };
}

function isProductionTarget(target) {
  return Array.isArray(target)
    ? target.includes("production")
    : target === "production";
}

export async function cleanupPreview({
  event,
  webToken,
  apiToken,
  githubToken,
  fetchImpl = fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  const { number, branch, domain, origin } = validateEvent(event);
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
  const domainPath = `/v9/projects/${WEB_PROJECT_ID}/domains/${domain}`;
  const registeredDomain = await web(domainPath, { notFoundOk: true });
  if (
    registeredDomain &&
    (registeredDomain.name !== domain ||
      registeredDomain.projectId !== WEB_PROJECT_ID ||
      registeredDomain.gitBranch !== branch)
  ) {
    throw new Error(
      `Refusing to delete ${domain}: its owning project or branch does not match this PR.`,
    );
  }

  const envList = await api(`/v9/projects/${API_PROJECT_ID}/env`);
  const trustedVars =
    envList.envs?.filter(
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
      "Expected exactly one readable production AUTH_TRUSTED_ORIGINS variable; refusing cleanup.",
    );
  }

  const trustedVar = trustedVars[0];
  const origins = trustedVar.value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const remaining = origins.filter((item) => item !== origin);
  const originRemoved = remaining.length !== origins.length;

  // Verify the staging ref before making any mutation.
  const ref = await github(`/repos/${REPOSITORY}/git/ref/heads/${BASE_BRANCH}`);
  const sha = ref?.object?.sha;
  if (typeof sha !== "string" || !/^[a-f0-9]{40}$/.test(sha)) {
    throw new Error(
      "Unable to resolve current staging HEAD; refusing cleanup.",
    );
  }

  if (registeredDomain) {
    await web(domainPath, { method: "DELETE" });
    console.info(`Removed PR #${number} short domain ${domain}.`);
  } else {
    console.info(`PR #${number} short domain already absent.`);
  }

  if (originRemoved) {
    await api(
      `/v9/projects/${API_PROJECT_ID}/env/${encodeURIComponent(trustedVar.id)}`,
      { method: "PATCH", body: { value: remaining.join(",") } },
    );
    console.info(`Removed PR #${number} trusted origin.`);
  } else {
    console.info(`PR #${number} trusted origin already absent.`);
  }

  // Always deploy even when the origin is already absent. A previous run
  // might have updated Vercel's setting but failed before a READY deployment.
  console.info("Redeploying staging API to apply/verify the current settings.");
  const deployment = await api("/v13/deployments?forceNew=1", {
    method: "POST",
    body: {
      name: API_PROJECT_NAME,
      project: API_PROJECT_ID,
      // "production" here is the Vercel target *within the staging API project*.
      target: "production",
      gitSource: {
        type: "github",
        org: "mcebaniqued",
        repo: "sari-app",
        ref: BASE_BRANCH,
        sha,
      },
    },
  });
  const deploymentId = deployment.deployment?.id ?? deployment.id;
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
      current.deployment?.readyState ?? current.readyState ?? current.state;
    if (readyState === "READY") {
      console.info(
        `Staging API redeployed at ${sha.slice(0, 7)} (${deploymentId}).`,
      );
      return {
        domainRemoved: Boolean(registeredDomain),
        originRemoved,
        redeployed: true,
      };
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
  await cleanupPreview({
    event,
    webToken: process.env.VERCEL_WEB_TOKEN,
    apiToken: process.env.VERCEL_API_TOKEN,
    githubToken: process.env.GITHUB_READ_TOKEN,
  });
}
