# Sari

A fresh foundation for a small pantry app. The first product milestone is entering a food item and saving it to MongoDB. This scaffold intentionally stops at infrastructure while the food-item DTO is being designed.

## Stack and layout

React, TypeScript, Vite, React Router, Tailwind CSS v4, and React Icons on the frontend. Node.js, TypeScript, Express 5, and Mongoose on the backend. Shared Zod schemas define public API DTOs. npm workspaces manage the applications and contracts with one lockfile.

```text
api/                  Express application, MongoDB connection, API tests
web/                  React SPA, shared HTTP client, component tests
packages/contracts/   Shared Zod schemas and inferred API types
e2e/                  Playwright tests for frontend/API integration
```

Node.js 24 LTS and npm 11 are the recommended development versions. Node 26 is also supported.

## Run locally

From the repository root:

```sh
npm ci
npm run dev
```

- Frontend: <http://127.0.0.1:5173>
- API liveness: <http://127.0.0.1:3001/api/v1/health>
- Database readiness: <http://127.0.0.1:3001/api/v1/ready>

Vite proxies `/api/v1` to the API at port 3001. Browser requests use the same origin, so local development needs no CORS setup. The frontend's optional `VITE_API_BASE_URL` defaults to `/api/v1`.

The root development command builds `@sari/contracts` first, then watches the shared schemas alongside the API and frontend. Root build commands process contracts before the applications. Root type-check and test commands also prepare contracts automatically. Before running an application workspace command directly, run `npm run contracts:build` once from the root.

Both development servers and the health endpoint work without MongoDB credentials. Readiness returns HTTP 503 until a real database connection succeeds.

## Configure MongoDB

Copy `api/.env.example` to `api/.env`. In PowerShell:

```powershell
Copy-Item api/.env.example api/.env
```

Set `MONGODB_URI` in that file. Use a fresh database such as `sari_mvp1`, either in Atlas or on a local MongoDB server. For Atlas, resume the cluster, configure a database user and network access, and use its driver connection string with `/sari_mvp1` as the database name. URL-encode any special characters in credentials.

Restart the API after changing its environment file, then request `/api/v1/ready`. A 200 response with `{"status":"ready"}` confirms a working connection. No collections or food records are created by these infrastructure endpoints.

The MongoDB connection is lazy and reuses a small connection pool across requests. Connection failures can be retried. Credentials and connection errors are not returned by readiness.

Only backend environment variables may contain secrets. `VITE_` variables are bundled into public frontend code. Real environment files are ignored by Git.

## Commands

| Command                   | Purpose                                                        |
| ------------------------- | -------------------------------------------------------------- |
| `npm run dev`             | Start frontend and API together                                |
| `npm run check`           | Formatting, lint, types, unused code, tests, production builds |
| `npm run test:coverage`   | API and frontend tests with V8 coverage                        |
| `npm run contracts:build` | Build shared schemas and TypeScript declarations               |
| `npm run format`          | Format source and configuration                                |
| `npm run build`           | Build API and frontend                                         |
| `npm start`               | Run the compiled API                                           |

Install the browser once before running browser tests:

```sh
npx playwright install chromium
npm run test:e2e
```

Playwright starts both servers and checks the frontend's API proxy and SPA navigation. Stop any existing development servers on ports 3001 and 5173 before running it.

Husky runs lint-staged before commits. GitHub Actions runs the validation command and browser tests on pull requests and pushes to `main`. CI does not require database credentials; database integration will be added with the food persistence feature.

## API conventions

- REST endpoints live under `/api/v1`.
- `GET /health` returns 200 with `{"status":"ok"}` for liveness.
- `GET /ready` returns 200 with `{"status":"ready"}` or 503 with `{"status":"not_ready"}`.
- Errors use `{"error":{"code":"...","message":"..."}}`.
- `@sari/contracts` is the source of public request/response schemas and inferred DTO types. Import it by package name in either application; keep Mongoose models and database credentials inside the API.
- The frontend `apiFetch` wrapper validates error payloads against the shared Zod schema and handles empty responses. It accepts paths relative to `/api/v1`; callers provide the JSON content type when sending JSON bodies.
- Successful response generics provide compile-time types. Callers must parse successful payloads with the corresponding schema when runtime validation is required. Future food endpoints must validate incoming requests on the server before persistence.
- Endpoint tests validate real health and error responses against the shared schemas. Route paths and HTTP status codes remain explicit in Express and their tests.

No food schema, food CRUD endpoints, login, or session middleware are included yet.

## Vercel deployment preparation

Use two Vercel projects connected to this repository:

| Setting          | API project                                         | Frontend project                                    |
| ---------------- | --------------------------------------------------- | --------------------------------------------------- |
| Root directory   | `api`                                               | `web`                                               |
| Framework        | Express                                             | Vite                                                |
| Build command    | `npm run build -w @sari/contracts && npm run build` | `npm run build -w @sari/contracts && npm run build` |
| Output directory | Leave the Express preset default                    | `dist`                                              |
| Environment      | `MONGODB_URI`                                       | Relative API base path is the default               |

Allow access to files outside each root directory, because the workspace lockfile, shared TypeScript configuration, and contracts package are outside the application directories. Build commands must compile the contracts package before the application so runtime imports and declaration files are available. Use Node 24.x in both projects. The API's default-exported `src/app.ts` is its Vercel entry point; `src/server.ts` is for conventional local/server hosting.

After the API project's actual URL is known, add its rewrite **before** the SPA fallback in `web/vercel.json`. Replace the example hostname with that project's real production hostname:

```json
{
  "rewrites": [
    {
      "source": "/api/v1/:path*",
      "destination": "https://YOUR-API-PROJECT.vercel.app/api/v1/:path*"
    },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Keep `VITE_API_BASE_URL=/api/v1` so browser requests remain same-origin. The committed Vercel configuration currently contains only the SPA fallback; production API routing requires the real backend hostname. Do not deploy food features until that route and the Atlas connection are verified.

## Previous implementation

The previous committed app remains on the remote `archive/pre-build` branch. Local uncommitted pantry work was preserved in `archive/pre-scaffold-wip` and a Git stash before scaffolding. Existing feature branches were retained. Legacy secrets were backed up outside this repository and were not carried into the new application.
