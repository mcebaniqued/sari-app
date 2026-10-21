# Sari

Sari is a pantry app for tracking food, quantities, expiration dates, and optional barcode lookups.

Built with React, TypeScript, Express, and MongoDB, using npm workspaces and shared Zod contracts.

## Prerequisites

Use Node.js 24 LTS, npm 11, and a local MongoDB server or an Atlas development database.

## Get started

Clone the repository, install dependencies, and copy the API environment template:

```sh
git clone https://github.com/mcebaniqued/sari-app.git
cd sari-app
npm ci --include=optional
node -e "require('node:fs').copyFileSync('api/.env.example', 'api/.env')"
```

Edit `api/.env`:

| Setting              | Local setup                                                               |
| -------------------- | ------------------------------------------------------------------------- |
| `MONGODB_URI`        | Required. Use your development database; the default is local `sari_dev`. |
| `BETTER_AUTH_SECRET` | Required. Generate a secret with the command below and paste it here.     |
| `BETTER_AUTH_URL`    | Keep the default `http://127.0.0.1:5173`.                                 |
| `USDA_API_KEY`       | Optional for barcode lookup. Manual entry works without it.               |

```sh
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Start the app from the repository root:

```sh
npm run dev
```

## Verify it works

Open <http://127.0.0.1:5173> and register an account. Add a pantry item, refresh, and confirm it remains saved. [API readiness](http://127.0.0.1:3001/api/v1/ready) returns HTTP 200 when MongoDB is connected. Restart the API after changing `api/.env`.

## Find your way around

- `web/`: React frontend.
- `api/`: Express API and persistence.
- `packages/contracts/`: Shared schemas and types.
- `e2e/`: Playwright browser tests.

Run `npm run check` before submitting changes. See [CONTRIBUTION.md](CONTRIBUTION.md) for development, testing, API, and deployment details, or the [issue tracker](https://github.com/mcebaniqued/sari-app/issues) for bugs and requests. Coding agents must follow [AGENTS.md](AGENTS.md).
