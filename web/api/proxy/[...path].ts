const proxyPathPrefix = "/api/proxy";
const apiPathPrefix = "/v1";

interface ApiProxyOptions {
  apiOrigin: string | undefined;
  fetcher?: typeof fetch;
}

function validatedApiOrigin(value: string | undefined) {
  const configured = value?.trim();

  if (!configured) {
    throw new Error("SARI_API_ORIGIN is required by the preview API proxy.");
  }

  const origin = new URL(configured);

  if (
    origin.protocol !== "https:" ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  ) {
    throw new Error("SARI_API_ORIGIN must be an HTTPS origin.");
  }

  return origin;
}

export function createApiProxy({
  apiOrigin,
  fetcher = fetch,
}: ApiProxyOptions) {
  const origin = validatedApiOrigin(apiOrigin);

  return async function proxyApiRequest(request: Request) {
    const requestUrl = new URL(request.url);
    const upstreamPath = requestUrl.pathname.slice(proxyPathPrefix.length);
    const oidcToken = request.headers.get("x-vercel-oidc-token");

    if (
      !requestUrl.pathname.startsWith(`${proxyPathPrefix}${apiPathPrefix}/`) &&
      requestUrl.pathname !== `${proxyPathPrefix}${apiPathPrefix}`
    ) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "Route not found." } },
        { status: 404 },
      );
    }

    if (!oidcToken) {
      return Response.json(
        {
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: "The preview API connection is unavailable.",
          },
        },
        { status: 503 },
      );
    }

    const upstreamUrl = new URL(
      `/api${upstreamPath}${requestUrl.search}`,
      origin,
    );
    const headers = new Headers(request.headers);

    headers.delete("connection");
    headers.delete("content-length");
    headers.delete("host");
    headers.delete("x-vercel-oidc-token");
    headers.delete("x-vercel-protection-bypass");
    headers.set("x-vercel-trusted-oidc-idp-token", oidcToken);

    const response = await fetcher(upstreamUrl, {
      method: request.method,
      headers,
      body:
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : await request.arrayBuffer(),
      redirect: "manual",
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };
}

export default async function handler(request: Request) {
  try {
    return await createApiProxy({
      apiOrigin: process.env.SARI_API_ORIGIN,
    })(request);
  } catch {
    return Response.json(
      {
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "The preview API connection is unavailable.",
        },
      },
      { status: 503 },
    );
  }
}
