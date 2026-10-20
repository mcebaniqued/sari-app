const productionApi = "https://sari-api.vercel.app";
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

export const config = {
  installCommand:
    "HUSKY=0 npm ci --include=dev --workspaces --include-workspace-root",
  buildCommand: "npm run build -w @sari/contracts && npm run build",
  rewrites: [
    { source: "/api/v1/:path*", destination: `${api.origin}/api/v1/:path*` },
    { source: "/(.*)", destination: "/index.html" },
  ],
};
