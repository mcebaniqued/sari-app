# Sari

A private pantry app built with React, TypeScript, Express, and MongoDB. Shared Zod contracts connect the frontend and API through npm workspaces.

## Get started

Use Node.js 24 LTS, npm 11, and a local MongoDB server or an Atlas development database.

1. Install dependencies from the repository root:

   ```sh
   npm ci --include=optional
   ```

2. Copy [api/.env.example](api/.env.example) to `api/.env`. Set `MONGODB_URI` to your development database and generate `BETTER_AUTH_SECRET` using the command in that file. The default `BETTER_AUTH_URL` works locally. `USDA_API_KEY` is optional for barcode lookup.
3. Start the app:

   ```sh
   npm run dev
   ```

Open <http://127.0.0.1:5173> and register an account. Check [API readiness](http://127.0.0.1:3001/api/v1/ready): HTTP 200 confirms MongoDB is connected. Restart the API after changing `api/.env`.

## Find your way around

- `web/`: React frontend.
- `api/`: Express API and persistence.
- `packages/contracts/`: Shared schemas and types.
- `e2e/`: Playwright browser tests.

Run `npm run check` before submitting changes. See [CONTRIBUTION.md](CONTRIBUTION.md) for development, testing, API, and deployment details. Coding agents must follow [AGENTS.md](AGENTS.md).
