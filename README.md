# Sari

A small pantry app. Add, view, edit, and delete food items saved in MongoDB.

## Stack and layout

React, TypeScript, Vite, React Router, Tailwind CSS v4, and React Icons on the frontend. Node.js, TypeScript, Express 5, and Mongoose on the backend. Shared Zod schemas define public API DTOs. npm workspaces manage the applications and contracts with one lockfile.

```text
api/                  Express application, MongoDB connection, API tests
web/                  React SPA, shared HTTP client, component tests
packages/contracts/   Shared Zod schemas and inferred API types
e2e/                  Playwright tests for frontend/API integration
```

Node.js 24 LTS and npm 11 are the recommended development versions. Node 26 is also supported.

### Frontend organization

```text
web/src/
  api/                  Shared HTTP transport and transport tests
  components/           Shared UI, grouped by component (Input/, SearchBar/, Modal/, Toast/)
  features/food-items/
    api/                Food-item requests, response validation, and API helper tests
    components/         Form, editor/delete dialogs, and table UI
    hooks/              Pantry state, form submission, table loading, and columns
    pages/              Pantry route composition and page tests
    types/              Types shared within the food-items feature
    utils/              AG Grid datasource adapter
  hooks/                Shared hooks such as debouncing and forbidden-response navigation
  layouts/              Persistent application shell
  pages/                Universal pages such as Not found and Access denied
  styles/               Tailwind entry point and semantic theme tokens
  utils/                Shared date and API-error formatting
```

Keep feature-specific API calls, state, and UI inside that feature. Route pages compose components and hooks; form submission and table loading belong to hooks, while the imperative datasource adapter stays independent of React. Shared components, hooks, and utilities should not import feature code. Tests live beside the code they exercise. Use `@/` for imports from `web/src` across shared areas; relative imports work within a feature or component folder. TypeScript, Vite, and Vitest resolve the same alias.

SearchBar accepts its label, placeholder, and length limit from the caller and uses the shared debounce hook. Pantry-specific wording and query limits stay in the pantry toolbar.

## Run locally

From the repository root:

```sh
npm ci --include=optional
npm run dev
```

- Frontend: <http://127.0.0.1:5173>
- API liveness: <http://127.0.0.1:3001/api/v1/health>
- Database readiness: <http://127.0.0.1:3001/api/v1/ready>

Vite proxies `/api/v1` to the API at port 3001. Browser requests use the same origin, so local development needs no CORS setup. The frontend's optional `VITE_API_BASE_URL` defaults to `/api/v1`.

The root development command builds `@sari/contracts` first, then watches the shared schemas alongside the API and frontend. Root build commands process contracts before the applications. Root type-check and test commands also prepare contracts automatically. Before running an application workspace command directly, run `npm run contracts:build` once from the root.

Keep npm optional dependencies enabled: esbuild, Rolldown, and Lightning CSS need platform-specific native packages. The lockfile includes platform entries for Windows and CI. If an existing install is missing native packages, stop the development servers and run `npm ci --include=optional` before restarting.

Both development servers and the health endpoint work without MongoDB credentials. Readiness returns HTTP 503 until a real database connection succeeds.

## Configure MongoDB

Create `api/.env` with your local configuration. For a local MongoDB server:

```dotenv
PORT=3001
MONGODB_URI=mongodb://127.0.0.1:27017/sari_mvp1
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

Playwright starts isolated servers on ports 3101 (API) and 5273 (frontend), leaving the normal development ports available. It checks the API proxy, SPA navigation, pagination, search, sorting/filtering, create/edit/delete flows, keyboard behavior, phone layout, and axe accessibility scans of pages, dialogs, filter popups, and notifications. Automated scans supplement manual accessibility review; they do not establish complete WCAG conformance. The test frontend sets `API_PROXY_TARGET` for its proxy; normal development defaults to port 3001.

Husky runs lint-staged before commits. GitHub Actions runs the validation command and browser tests on pull requests and pushes to `main`. CI starts a disposable MongoDB 8 service for persistence tests and does not require Atlas credentials.

## API conventions

- REST endpoints live under `/api/v1`.
- `GET /health` returns 200 with `{"status":"ok"}` for liveness.
- `GET /ready` returns 200 with `{"status":"ready"}` or 503 with `{"status":"not_ready"}`.
- Errors use `{"error":{"code":"...","message":"..."}}`.
- `@sari/contracts` is the source of public request/response schemas and inferred DTO types. Import it by package name in either application; keep Mongoose models and database credentials inside the API.
- The frontend `apiFetch` wrapper validates error payloads against the shared Zod schema and handles empty responses. Safe GET/HEAD/OPTIONS requests without bodies retry twice on network failures or HTTP 408/429/500/502/503/504. Backoff doubles from 300ms with jitter and a 5s cap, honors `Retry-After`, and never retries earlier than a longer server wait (it returns that error instead). Mutations never retry automatically. `signal` cancels requests and pending backoff, preserving the abort reason. Set `retry: false` to disable retries, or configure `{ maxRetries, baseDelayMs, maxDelayMs }`. Only the final outcome reaches UI notifications. It accepts paths relative to `/api/v1`; callers provide the JSON content type when sending JSON bodies.
- Successful response generics provide compile-time types. Callers must parse successful payloads with the corresponding schema when runtime validation is required. Future food endpoints must validate incoming requests on the server before persistence.
- Endpoint tests validate real health and error responses against the shared schemas. Route paths and HTTP status codes remain explicit in Express and their tests.

## Food items (MVP 1)

The `/` route redirects to `/pantry`. The persistent header contains the Sari brand link, and the page heading reads My Pantry with a small icon. `/access-denied` shows an access-denied page, and unmatched routes show a not-found page; both share a responsive error layout with semantic colors, page titles, automatic heading focus, and working recovery actions. Back to pantry always returns to `/pantry`; Go back uses the previous app history entry, falling back to the pantry on direct visits. A single toolbar above the table contains a debounced search on the left and selection/bulk-delete actions and Add item on the right. A shared Input primitive underpins the SearchBar. AG Grid Community uses its Infinite Row Model with 20-row pages, a three-page cache, and server-backed search, column-header filtering, and sorting. After loading confirms zero results, an empty-state prompt opens the add-item modal. Searches and filters with no matches show guidance to adjust the query. New records appear first until a sort is applied. The Actions column stays pinned to the right and opens a prefilled edit modal or a delete confirmation.

Tailwind v4 semantic tokens in `web/src/styles/index.css` define page/surface backgrounds, content colors, borders, brand and danger states, radii, and modal shadow. Components use those roles in Tailwind utilities instead of palette shades or custom CSS classes. AG Grid's theme references the same CSS variables. Global Tailwind cursor utilities cover native and ARIA controls, including portals: interactive controls use a pointer, and disabled or inert controls use not-allowed. Numeric values remain right-aligned while all column filter buttons stay on the right. Breadcrumbs, summary cards, floating filter rows, and decorative subtitles are omitted. Table dates use `MMM DD, YYYY` (e.g. Oct 01, 2026); form and filter controls use native date inputs, whose appearance follows the browser's locale. Dates sent to the API remain ISO. Timestamps are displayed in UTC until date/time settings exist. Infinite-grid placeholder rows remain invisible until real records arrive, keeping blank checkboxes and cell borders out of the loading state.

Add item opens a blank form in the same reusable modal. Cancel discards the draft. The modal traps keyboard focus, supports Escape and backdrop dismissal, restores focus when closed, and prevents dismissal during a pending request. Failed saves preserve the entered values.

Select rows to reveal Delete selected. The header checkbox selects only the currently loaded page. Changing the page, search, filter, or sort clears selection. Bulk deletion uses the existing item DELETE endpoint with at most ten concurrent requests. Successfully deleted rows are removed immediately after the batch completes; failed rows remain in the confirmation for retry. Already missing rows are treated as removed, and a retry never repeats successful deletions.

`POST /api/v1/food-items` accepts a JSON object:

```json
{
  "name": "Rice",
  "quantity": 0.5,
  "unit": "kg",
  "expiresOn": "2028-02-29"
}
```

| Field       | Rules                                                                                                          |
| ----------- | -------------------------------------------------------------------------------------------------------------- |
| `name`      | Required, trimmed, 1–120 characters                                                                            |
| `quantity`  | Positive number up to 1,000,000; defaults to `1`                                                               |
| `unit`      | `item`, `g`, `kg`, `ml`, `l`, `oz`, `lb`, `fl oz`, `tsp`, `tbsp`, `cup`, `pt`, `qt`, `gal`; defaults to `item` |
| `expiresOn` | Optional valid `YYYY-MM-DD` calendar date; defaults to `null`                                                  |

Non-metric volume units use US customary measures and are labeled as US in the form. `oz` means weight; `fl oz` means volume. Quantity and unit are stored as entered without automatic conversion.

Unknown fields are rejected, including client-supplied IDs and timestamps. The response is HTTP 201 with the saved fields plus a string `id` and UTC ISO `createdAt`/`updatedAt` timestamps. Expiration dates remain date-only strings in both MongoDB and JSON, avoiding timezone conversion. Duplicates are allowed: each submission creates a separate pantry entry.

`GET /api/v1/food-items` returns `{ "items": [...], "total": 42, "start": 0, "limit": 20 }`. It accepts `start` (0–1,000,000), `limit` (1–100, default 20), a trimmed `search` (up to 120 characters), and JSON-encoded `sort` and `filters`. Search matches literal text in food names. Sort is an ordered array of `{ "colId": "name", "sort": "asc" }`; allowed fields are name, quantity, unit, expiresOn, and createdAt. A stable ID tie-breaker prevents ambiguous page ordering. Filters use a single AG Grid text, numeric, or date condition per allowed column; combined conditions and unknown fields/operators are rejected. The shared Zod query schema validates both sides; MongoDB predicates are constructed from a whitelist, never raw client operators. Queries have a 5-second execution bound. API responses omit MongoDB's `_id` and internal version fields. Invalid input returns HTTP 400 with `VALIDATION_ERROR`; a failed database connection returns HTTP 503 with `DATABASE_UNAVAILABLE`. The form preserves entered values after a failed save and only reports success after the server confirms persistence.

`GET /api/v1/food-items/:id` returns one food item. `PATCH /api/v1/food-items/:id` accepts one or more of the same four editable fields, validates them, and returns the saved item. Omitted fields retain their values; set `expiresOn` to `null` to clear the date. Updates preserve `id` and `createdAt` and refresh `updatedAt`. Empty updates, unknown fields, and client-supplied IDs/timestamps are rejected.

`DELETE /api/v1/food-items/:id` permanently removes that item and returns HTTP 204 with no body. Malformed IDs return HTTP 400 with `INVALID_ID`. Reading, updating, or deleting a missing item returns HTTP 404 with `FOOD_ITEM_NOT_FOUND`.

A reusable React Toastify notification component reports create, update, delete, partial bulk failures, and final network/load errors. Notifications sit at the bottom center with vertically centered contents, away from Add item, and dismiss after five seconds. The countdown pauses on hover, keyboard focus, or window focus loss. Notifications use semantic colors, Tailwind utilities, no motion, accessible status/alert roles, an explicit close button, and an Alt+T keyboard shortcut. The unstyled Toastify build uses a shared JavaScript countdown instead of depending on a CSS progress animation. Errors also remain next to their form or retry control.

ESLint uses strict TypeScript type-aware rules, React Hooks checks, JSX accessibility checks, import sorting, unused import detection, and Playwright rules, with zero warnings allowed. The maintained `@htmlacademy/eslint-plugin-jsx-a11y` fork supports the project’s ESLint 10 version.

The frontend routes HTTP 403 responses from pantry reads and writes to `/access-denied`, replacing the rejected route in history. Bulk deletion stops scheduling additional batches after a forbidden response and retains completed outcomes. Other errors stay with their form or recovery control. There is no user ownership or authentication yet; actual permission enforcement belongs to the backend. This milestone is for local development; deployment remains deferred.

### Persistence tests

Regular tests run without database credentials. To also run real MongoDB integration tests, explicitly set `TEST_MONGODB_URI` to a separate database whose name ends in `_test`, then run `npm test`. For example, in PowerShell with a local MongoDB server:

```powershell
$env:TEST_MONGODB_URI = 'mongodb://127.0.0.1:27017/sari_test'
npm test
Remove-Item Env:TEST_MONGODB_URI
```

Integration tests never load `api/.env` and delete only the records they create. Browser tests exercise the real AG Grid and modal interactions against an API fixture, including sorting, filtering, selection, partial bulk failures, keyboard focus, and mobile layout. Unit tests isolate modal and persistence behavior from jsdom's layout limitations. The API integration suite verifies actual writes and reads against MongoDB.

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
