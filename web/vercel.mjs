const productionApi = "https://sari-api.vercel.app";
// The staging branch uses the isolated preview API. Keep this server-side;
// browser requests stay on /api/v1 so authentication cookies remain same-origin.
const preview = process.env.VERCEL_ENV === "preview";
const configuredApi = process.env.SARI_API_ORIGIN?.trim();

if (preview && !configuredApi) {
  throw new Error("Preview deployments require an isolated SARI_API_ORIGIN.");
}

const api = new URL(configuredApi || productionApi);
if (
  api.protocol !== "https:" ||
  api.username ||
  api.password ||
  api.pathname !== "/" ||
  api.search ||
  api.hash ||
  (preview && api.origin === productionApi)
) {
  throw new Error(
    "SARI_API_ORIGIN must be an HTTPS origin isolated from production in previews.",
  );
}

// Keep environment-dependent routes outside the exported object so Git
// preflight defers their evaluation to the build-time config compiler.
const rewrites = [
  {
    source: "/api/v1/:path*",
    destination: preview
      ? "/api/proxy/v1/:path*"
      : `${api.origin}/api/v1/:path*`,
  },
  { source: "/(.*)", destination: "/index.html" },
];

export const config = {
  // Build tools are dev dependencies; deployments install them without local Git hooks.
  installCommand:
    "HUSKY=0 npm ci --include=dev --workspaces --include-workspace-root",
  buildCommand: "npm run build -w @sari/contracts && npm run build",
  rewrites,
};
