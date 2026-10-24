# Development guide

Start with the [quick onboarding guide](README.md). This guide covers architecture, configuration, tests, API behavior, and deployment. Open work is tracked in [GitHub Issues](https://github.com/mcebaniqued/sari-app/issues).

## Stack and layout

React, TypeScript, Vite, React Router, Tailwind CSS v4, and React Icons on the frontend. Node.js, TypeScript, Express 5, and Mongoose on the backend. Shared Zod schemas define public API DTOs. npm workspaces manage the applications and contracts with one lockfile.

```text
api/                  Express application, MongoDB connection, API tests
web/                  React SPA, shared HTTP client, component tests
packages/contracts/   Shared Zod schemas and inferred API types
e2e/                  Playwright tests for frontend/API integration
```

### Frontend organization

```text
web/src/
  api/                  Shared HTTP transport and transport tests
  components/           Shared UI, grouped by component (Input/, SearchBar/, Modal/, Toast/)
  features/food-items/
    api/                Food-item requests, response validation, and API helper tests
    components/         Form, editor/delete dialogs, toolbar, table, and mobile list
    hooks/              Pantry mutations, inventory loading, and form submission
    pages/              Pantry route composition and page tests
    types/              Types shared within the food-items feature
  hooks/                Shared hooks such as debouncing and mobile header behavior
  layouts/              Persistent application shell
  pages/                Universal pages such as Not found and Access denied
  styles/               Tailwind entry point and semantic theme tokens
  utils/                Shared date and API-error formatting
```

Keep feature-specific API calls, state, and UI inside that feature. Route pages compose components and hooks; form submission and inventory loading belong to hooks. Shared components, hooks, and utilities should not import feature code. Source tests live beside the code they exercise. Shared API test helpers live in `api/test`; browser fixtures live in `e2e/fixtures`. Use `@/` for imports from `web/src` across shared areas; relative imports work within a feature or component folder. TypeScript, Vite, and Vitest resolve the same alias.

## Local development details

Vite proxies `/api/v1` to the API at port 3001. Browser requests use the same origin, so local development needs no CORS setup. The frontend's optional `VITE_API_BASE_URL` defaults to `/api/v1`.

The root development command builds `@sari/contracts` first, then watches the shared schemas alongside the API and frontend. Root build commands process contracts before the applications. Root type-check and test commands also prepare contracts automatically. Before running an application workspace command directly, run `npm run contracts:build` once from the root.

Keep npm optional dependencies enabled: esbuild, Rolldown, and Lightning CSS need platform-specific native packages. The lockfile includes platform entries for Windows and CI. If an existing install is missing native packages, stop the development servers and run `npm ci --include=optional` before restarting.

Both development servers and the health endpoint work without MongoDB credentials. Readiness returns HTTP 503 until a real database connection succeeds.

## Configure MongoDB

Create `api/.env` with your local configuration. For a local MongoDB server:

```dotenv
PORT=3001
MONGODB_URI=mongodb://127.0.0.1:27017/sari_dev
```

Set `MONGODB_URI` in that file. Use a development database such as `sari_dev`, either in Atlas or on a local MongoDB server. For Atlas, resume the cluster, configure a database user and network access, and use its driver connection string with `/sari_dev` as the database name. URL-encode any special characters in credentials.

Restart the API after changing its environment file, then request `/api/v1/ready`. A 200 response with `{"status":"ready"}` confirms a working connection. No collections or food records are created by these infrastructure endpoints.

The MongoDB connection is lazy and reuses a small connection pool across requests. Connection failures can be retried. Credentials and connection errors are not returned by readiness.

Only backend environment variables may contain secrets. `VITE_` variables are bundled into public frontend code. Real environment files are ignored by Git.

## Commands

| Command                    | Purpose                                                        |
| -------------------------- | -------------------------------------------------------------- |
| `npm run dev`              | Start frontend and API together                                |
| `npm run check`            | Formatting, lint, types, unused code, tests, production builds |
| `npm run test:integration` | API and browser tests using a disposable MongoDB               |
| `npm run test:coverage`    | Contracts, API, and frontend tests with V8 coverage            |
| `npm run contracts:build`  | Build shared schemas and TypeScript declarations               |
| `npm run format`           | Format source and configuration                                |
| `npm run build`            | Build contracts, API, and frontend                             |
| `npm start`                | Run the compiled API                                           |

Install the browser once before running browser tests:

```sh
npx playwright install chromium
npm run test:e2e
```

Playwright starts isolated servers on ports 3101 (API) and 5273 (frontend), leaving the normal development ports available. It checks the API proxy, SPA navigation, infinite loading, search, sorting/filtering, create/edit/delete flows, keyboard behavior, phone layout, and axe accessibility scans of pages, dialogs, filter controls, and notifications. Automated scans supplement manual accessibility review; they do not establish complete WCAG conformance. The test frontend sets `API_PROXY_TARGET` for its proxy; normal development defaults to port 3001.

Husky runs lint-staged before commits. GitHub Actions runs the validation command and browser tests on pull requests and pushes to `main` and `staging`. CI starts a disposable MongoDB 8 service for persistence tests and does not require Atlas credentials.

## Branch and pull request workflow

`main` is the production and release branch, and `staging` is the integration branch. Both are protected. Start scoped `feat/*`, `fix/*`, `refactor/*`, `chore/*`, or `docs/*` branches from the current `staging` branch and open their pull requests back to `staging`.

Protected-branch pull requests must pass the GitHub Actions `validate` check, be current with their base branch, and have all review conversations resolved. The solo-maintainer workflow does not require an approving review or self-approval. Do not routinely bypass pull request or required-check rules, force-push, or delete protected branches.

Use squash merging for ordinary feature, fix, refactor, maintenance, and documentation pull requests. Promote a validated `staging` revision through a separate pull request to `main`, using a merge commit to preserve branch ancestry. No promotion is automated.

An urgent production hotfix may use an exceptional pull request from a scoped branch directly to `main`. After it is merged and verified, synchronize the hotfix back into `staging` through a separate pull request so later releases retain the change.

If a broken workflow or repository rule prevents every compliant pull request from merging, prefer repairing it through the normal protected-branch workflow. When that is impossible, a repository administrator may make the smallest temporary server-side rule change needed for recovery after recording the current configuration and impact. Restore and verify the intended protection immediately afterward. Emergency recovery does not authorize force pushes, branch deletion, unrelated bypasses, deployments, or production data changes.

## Release management

Sari releases are on demand. Weekends are the preferred review and promotion window, but they are not deadlines: there is no mandatory weekly release, minimum feature count, placeholder release, or version increment for a skipped week. Release only when an integrated revision is ready. A critical production fix may use the exceptional hotfix workflow above outside the preferred window.

The `staging` branch and its deployments form the beta environment. Use `https://sari-web-preview.vercel.app` to validate integrated functionality, regressions, frontend/API behavior, responsive behavior, accessibility, and release readiness. Identify beta revisions by their commit SHA or Vercel deployment identifier; beta deployments do not receive formal release tags. The [Vercel deployment](#vercel-deployment) section defines the separate preview and production projects, credentials, and databases.

The `main` branch and `https://sari-web.vercel.app` are production. Promote only an accepted beta revision through the protected `staging` → `main` merge-commit process established by [PR #125](https://github.com/mcebaniqued/sari-app/pull/125) and documented above. Do not add long-lived `release/*` branches, GitFlow, or other permanent environment branches. A passing CI run or merged promotion pull request does not by itself establish that production deployed successfully.

### Release candidates and beta acceptance

Select a candidate by its full `staging` commit SHA. Compare it with the current production revision and review the included features, fixes, maintenance, and possible regressions. The following commands record the revisions and provide a reviewable summary; run them from a clean checkout and retain the resolved SHAs with the release evidence:

```sh
git fetch origin main staging --tags
RELEASE_CANDIDATE=$(git rev-parse origin/staging)
PRODUCTION_REVISION=$(git rev-parse origin/main)
git log --oneline --decorate "$PRODUCTION_REVISION..$RELEASE_CANDIDATE"
git diff --stat "$PRODUCTION_REVISION..$RELEASE_CANDIDATE"
```

Confirm that required CI passed and both beta frontend and API deployments completed successfully. Exercise the major user workflows and the functionality changed by the candidate, including applicable responsive and accessibility checks. Review frontend/API compatibility and every unresolved defect; fix and retest release-blocking defects before promotion.

Temporarily freeze the selected candidate during final acceptance. Do not merge more changes into `staging` until promotion finishes. If `staging` changes or the release must include another change, the previous acceptance no longer applies: select the new SHA and repeat the affected CI, deployment, review, and beta checks.

### Release checklist

Before promotion:

- [ ] Record the full candidate SHA and the current production SHA.
- [ ] Review the commits and diff from production to the candidate; confirm the intended features, fixes, and maintenance are present and no unintended changes are included.
- [ ] Confirm the required CI checks passed for the candidate.
- [ ] Confirm the beta frontend and API deployments completed successfully for the candidate.
- [ ] Complete applicable manual beta acceptance, major-workflow, responsive, accessibility, and changed-functionality checks.
- [ ] Confirm the frontend and API compatibility expectations for the non-atomic rollout.
- [ ] Record unresolved defects and decide whether each blocks the release; correct and retest every blocker.
- [ ] Freeze the accepted candidate for final validation.

During promotion:

- [ ] Open a pull request from `staging` to `main` and confirm it contains the accepted candidate and only the intended changes.
- [ ] Preserve branch protections, require successful validation, and resolve review concerns. Do not use routine bypasses.
- [ ] If the candidate changes, stop and repeat the affected acceptance checks before merging.
- [ ] Merge with a merge commit so branch ancestry is preserved.

After promotion:

- [ ] Record the expected `main` merge commit and confirm it contains the accepted candidate.
- [ ] Wait for the production frontend and API deployments independently; verify each reports the expected revision.
- [ ] Verify `/api/v1/health` and `/api/v1/ready` through `https://sari-web.vercel.app`.
- [ ] Smoke-test registration or login, Pantry access, persistence after refresh, and the functionality changed by the release.
- [ ] Record failed checks and known limitations. A failed check prevents successful publication until it is resolved or handled through the failure process below.
- [ ] After successful production verification, assign the CalVer version, create and push the tag, and publish the matching GitHub Release.

The frontend and API are separate Vercel projects and do not deploy atomically. Their completion times can differ, passing CI does not prove either production deployment succeeded, and beta validation cannot prove every production-only setting. API changes may need to remain compatible with both the preceding and new frontend during rollout. Database-schema and shared-contract changes may require additional safeguards. [Issue #101](https://github.com/mcebaniqued/sari-app/issues/101) remains authoritative for unresolved coordinated-release verification and operational safeguards; this checklist does not claim those concerns or the current production configuration are verified.

### Calendar versions and publication

Production releases use `vYYYY.MM.DD[.N]`, based on the actual successful production-verification date in `America/Los_Angeles`:

| Release event                                 | Version                          |
| --------------------------------------------- | -------------------------------- |
| First release on October 25, 2026             | `v2026.10.25`                    |
| Second release on October 25, 2026            | `v2026.10.25.1`                  |
| Third release on October 25, 2026             | `v2026.10.25.2`                  |
| First release on November 1, 2026             | `v2026.11.01`                    |
| First release after one or more skipped weeks | The actual verified release date |

The first release on a Los Angeles calendar date omits the sequence. Start the second at `.1` and increment it for each additional verified release that date. Development, beta, merge, and deployment-start dates do not determine the version. Do not reserve a version before verification, increment for a skipped week, or retroactively version historical deployments without verifiable evidence.

After all production checks pass, fetch `main` and all tags, then set `RELEASE_COMMIT` to the full commit reported by the verified production deployments and `RELEASE_TAG` to the next valid CalVer value. The two `rev-parse` commands must identify the intended production commit; stop if the deployment, local `origin/main`, or recorded promotion result disagrees.

```sh
git fetch origin main --tags
RELEASE_COMMIT="paste-verified-production-commit"
RELEASE_TAG="vYYYY.MM.DD"
git rev-parse "$RELEASE_COMMIT^{commit}"
git rev-parse "origin/main^{commit}"
test "$(git rev-parse "$RELEASE_COMMIT^{commit}")" = "$(git rev-parse "origin/main^{commit}")"
git merge-base --is-ancestor "$RELEASE_COMMIT" origin/main
```

Check that the chosen tag does not already exist. Because the fetch imports remote tags, the guard stops if the tag is already taken; select the next valid same-day sequence instead. Never delete, reuse, move, or force-update a published release tag.

```sh
if git show-ref --verify --quiet "refs/tags/$RELEASE_TAG"; then
  echo "Tag already exists; select the next valid CalVer value."
  exit 1
fi
```

After the guard succeeds, create an annotated tag on the explicit verified commit. Review the tagged SHA before pushing the exact tag ref. Do not use `--force`.

```sh
git tag --annotate "$RELEASE_TAG" "$RELEASE_COMMIT" --message "Sari $RELEASE_TAG"
git rev-list -n 1 "$RELEASE_TAG"
git push origin "refs/tags/$RELEASE_TAG"
```

In GitHub Releases, draft a release using the existing pushed tag and confirm GitHub shows the same commit. Publish only after that check. Use this concise structure, omitting empty sections:

```md
## Highlights

- User-visible feature or outcome ([#issue](issue-url), [PR #number](pr-url))

## Improvements

- Improvement included in this production revision

## Fixes

- Corrected production behavior

## Operational notes

- Noteworthy deployment or compatibility information

## Known limitations

- Relevant limitation that remains after release
```

Release notes describe only changes actually included and verified in production. Use the candidate comparison, merged pull requests, and related issues to build the manifest; the `staging` → `main` promotion pull request alone is not a complete feature-level manifest. Preserve the chronological GitHub Release history.

Git tags and GitHub Releases are the authoritative production release identifiers. Existing SemVer-style npm workspace versions serve package metadata and are not synchronized to CalVer unless a future concrete requirement establishes a separate policy.

### Development and production tracking

GitHub Issues remain the development backlog, while GitHub Releases record production history. A development issue may close when its acceptance criteria are satisfied and its implementation is merged into `staging`; record or link the merged pull request when closing it. Because `main` is the default branch, closing keywords in a pull request merged only into `staging` do not automatically close its linked issue, so complete that development-tracking step explicitly.

Issue closure means development completion, not production availability. Beta acceptance is evidence attached to the candidate, and the corresponding GitHub Release identifies what reached verified production. Do not add issue states, labels, milestones, project boards, or a separate release tracker solely to mirror those release stages.

### Failures, regressions, and hotfixes

- If beta acceptance fails or a regression is found before promotion, track the defect at the appropriate severity, correct it through the normal `staging` workflow, select the resulting SHA, and repeat affected acceptance checks.
- If `staging` changes after final candidate acceptance, invalidate that acceptance and revalidate the new candidate before promotion.
- If either production deployment or a production check fails after the merge to `main`, do not assign a version or publish a successful release. Record the failure and use the smallest branch-protected correction or recovery path; do not claim rollback is automatic or atomic.
- If a regression appears after a release was verified and published, preserve its tag and release record. Track and deliver the correction normally or use the exceptional hotfix workflow when urgency requires it.
- An emergency hotfix may promote outside the preferred window through the documented scoped pull request to `main`. Verify production, assign CalVer from the actual Los Angeles verification date, publish only after success, and synchronize the verified hotfix back into `staging` through a separate pull request.
- A failed release attempt receives no version unless a production revision was successfully verified and published. Never repoint an existing tag to represent a retry or correction.

Production data changes, migrations, restores, destructive operations, credential changes, deployments, and repository-rule recovery require their own explicit authorization. Release documentation does not authorize them.

## Code quality

Readability requires blank lines between independent declarations and meaningful steps inside functions. Keep related statements together and document non-obvious invariants. Prettier enforces formatting; manual review checks logical grouping.

The root `tsconfig.json` checks Playwright configuration and browser tests; workspace configurations check application and contracts sources. API and contracts source checks include tests, while their separate `tsconfig.build.json` files exclude tests from emitted production files. The contracts source-check configuration disables emission. Shared `skipLibCheck` avoids rechecking dependency declarations in every workspace; application code and its use of those types remain checked.

ESLint uses strict TypeScript type-aware rules, React Hooks checks, JSX accessibility checks, import sorting, unused import detection, and Playwright rules, with zero warnings allowed. The maintained `@htmlacademy/eslint-plugin-jsx-a11y` fork supports the project’s ESLint 10 version.

For every bug fix, add regression tests that reproduce the bug and verify the corrected behavior.

## API conventions

- REST endpoints live under `/api/v1`.
- `GET /health` returns 200 with `{"status":"ok"}` for liveness.
- `GET /ready` returns 200 with `{"status":"ready"}` or 503 with `{"status":"not_ready"}`.
- Errors use `{"error":{"code":"...","message":"..."}}`.
- `@sari/contracts` is the source of public request/response schemas and inferred DTO types. Import it by package name in either application; keep Mongoose models and database credentials inside the API.
- The frontend `apiFetch` wrapper validates error payloads against the shared Zod schema and handles empty responses. Safe GET/HEAD/OPTIONS requests without bodies retry twice on network failures or HTTP 408/429/500/502/503/504. Backoff doubles from 300ms with jitter and a 5s cap, honors `Retry-After`, and never retries earlier than a longer server wait (it returns that error instead). Mutations never retry automatically. `signal` cancels requests and pending backoff, preserving the abort reason. Set `retry: false` to disable retries, or configure `{ maxRetries, baseDelayMs, maxDelayMs }`. Only the final outcome reaches UI notifications. It accepts paths relative to `/api/v1`; callers provide the JSON content type when sending JSON bodies.
- Successful response generics provide compile-time types. Callers must parse successful payloads with the corresponding schema when runtime validation is required. Future food endpoints must validate incoming requests on the server before persistence.
- Endpoint tests validate real health and error responses against the shared schemas. Route paths and HTTP status codes remain explicit in Express and their tests.

## Authentication

`/login` is the signed-out landing page and accepts email and password. `/register` accepts first name, last name, email, and password. Registration signs the user in immediately. The root route, login, and registration lead signed-in users to `/pantry`. Signed-out visits to all other pages redirect to login, preserving an internal return destination for successful login. The app checks the server session before rendering protected content. Failed session checks offer a retry. An expired session during a pantry request returns to login.

The pantry header shows a user icon and first name with a keyboard-accessible dropdown containing Log out. Logout revokes the server session, clears the cookie, discards pantry state and drafts, and returns to login. Failed logout keeps the session and offers an inline retry. Settings, email verification, password reset, social login, and MFA are not included.

Names are required, trimmed, and limited to 80 characters each. Email addresses are trimmed, lowercased, validated, limited to 254 characters, and unique. Passwords require 12–128 characters, preserve spaces exactly, and are salted and hashed server-side using Better Auth's scrypt implementation. Password hashes never appear in public responses. Registration errors distinguish duplicate email, invalid input, blocked website origin, and rate limiting. The frontend preserves Better Auth error codes and displays approved user-facing messages; internal server details remain hidden. Login errors do not disclose whether an account exists.

Add `BETTER_AUTH_SECRET` (at least 32 random characters) and `BETTER_AUTH_URL` (the frontend origin) to `api/.env`; see `api/.env.example` for generation instructions. Local development defaults to `http://127.0.0.1:5173`. During local development, both `localhost` and `127.0.0.1` are accepted on the configured port. Other hostnames require an exact origin in `AUTH_TRUSTED_ORIGINS`, comma-separated. Production accepts only explicitly configured origins. Secrets must stay out of `VITE_` variables and source control. Production requires a stable secret and an HTTPS frontend URL. Session cookies are HttpOnly, SameSite=Lax, Secure in production, and valid for seven days without sliding refresh. Protected requests check MongoDB; cookie caching is disabled so revocation and expiration take effect immediately.

Authentication endpoints live under `/api/v1/auth`: `POST /sign-up/email`, `POST /sign-in/email`, `GET /get-session`, and `POST /sign-out`. Other Better Auth HTTP endpoints are not exposed. Better Auth mounts before Express's JSON parser and manages password hashing, cookies, CSRF checks, and database-backed rate limiting (10 login attempts and 5 registration attempts per minute per client IP). The server overwrites its internal IP header with Express's socket-derived address. If deployed behind a proxy, configure a trusted proxy/IP policy for that platform before enabling forwarded client IPs. The MongoDB adapter manages authentication collections and supports standalone local MongoDB without transactions. Required production indexes are tracked for verification in [#101](https://github.com/mcebaniqued/sari-app/issues/101).

All food-item endpoints require a session and return `401` when missing or expired. Cookie-authenticated writes also require an allowed `Origin` header. Authentication and pantry responses use `Cache-Control: no-store`. Health and readiness remain public. Authenticated `403` responses still open the access-denied page.

Food items store the owner's user ID internally. Every list, count, read, update, and delete is scoped to that user; other users' IDs return `404`. Browser-supplied ownership is rejected. Records without an owner ID are hidden from every user. New accounts start empty, with no automatic ownership migration or separate pantry collection.

`npm run test:integration` starts an isolated MongoDB using `mongodb-memory-server`, runs the API/component and Playwright suites, and stops MongoDB. The first install downloads a MongoDB binary. This command never loads personal database credentials. `TEST_MONGODB_URI` must name a database ending in `_test`; API suites use separate `_auth_test`, `_pantry_test`, and `_barcode_test` databases. Playwright explicitly overrides the API database configuration so ordinary browser tests cannot reach `api/.env`'s database. Real browser authentication tests run when `TEST_MONGODB_URI` is set, including in CI and the disposable runner.

## Food items

The `/` route redirects signed-in users to `/pantry` and signed-out visitors to `/login`. The header contains the Sari brand link, and the page heading reads My Pantry with a small icon. `/access-denied` shows an access-denied page, and unmatched routes show a not-found page; both share a responsive error layout with semantic colors, page titles, automatic heading focus, and working recovery actions. Back to pantry always returns to `/pantry`; Go back uses the previous app history entry, falling back to the pantry on direct visits. The pantry toolbar provides debounced search, explicit sort and filter controls, Add item, and contextual bulk actions. A shared Input primitive underpins the SearchBar. One inventory loader fetches 20 server-backed items at a time, with infinite loading and a manual Load more fallback. Desktop uses a semantic table with its own scroll area and sticky column headings; mobile uses a document-scrolling list, selection mode, and item action menus. After loading confirms zero results, an empty-state prompt opens the add-item modal. Searches and filters with no matches show guidance to adjust the query. New records appear first until a sort is applied.

Tailwind v4 semantic tokens in `web/src/styles/index.css` define page/surface backgrounds, content colors, borders, brand and danger states, radii, and modal shadow. Components use those roles in Tailwind utilities instead of palette shades or custom CSS classes. Global Tailwind cursor utilities cover native and ARIA controls, including portals: interactive controls use a pointer, and disabled or inert controls use not-allowed. Numeric values remain right-aligned. Table dates use `MMM DD, YYYY` (e.g. Oct 01, 2026); form and filter controls use native date inputs, whose appearance follows the browser's locale. Dates sent to the API remain ISO. Timestamps are displayed in UTC until date/time settings exist. On mobile, the global header hides during meaningful downward scrolling and reappears on upward scrolling; the pantry controls remain sticky, and Back to top appears after about two viewports.

Add item opens a blank form in the same reusable modal. Cancel discards the draft. The modal traps keyboard focus, supports Escape and backdrop dismissal, restores focus when closed, and prevents dismissal during a pending request. Failed saves preserve the entered values.

Add item also offers optional **Input barcode instead**, with **Scan with camera** available below the barcode number field. Camera decoding stays on-device; typed barcode entry is always available. USDA FoodData Central is the sole lookup provider. Configure a free registered `USDA_API_KEY` in `api/.env` and restart the API. Review and edit matched product details before saving; missing or unavailable lookups allow manual completion. See [barcode setup and acceptance checks](docs/barcode-testing.md).

Shared `FoodProduct` records cache USDA details separately from private pantry `FoodItem` values. Optional `productId` and `barcode` fields associate an entry with a product; an unmatched manual barcode has no product reference. Personal names, quantities, units, and expiration dates are preserved across product refreshes. Remove product link keeps these pantry values intact. Original provider payloads stay server-side; nutrition and product images are deferred.

Authenticated `GET /api/v1/food-products/barcode/:barcode` validates EAN-8/UPC-A/EAN-13/GTIN-14 check digits, verifies exact USDA matches, and returns `{ product, stale }`. `GET /api/v1/food-products/:id` returns source details for an existing link. Matches are rechecked after 30 days on next use; genuine misses last 24 hours, and transient failure cooldowns are separate. Concurrent requests reuse shared cache records. Pantry creation accepts an optional `Idempotency-Key` header so retries of the same save do not create duplicate entries; the frontend retains it for an unchanged draft after a failed save. Intentional repeated pantry entries remain allowed.

Select rows to reveal Delete selected. The desktop header checkbox selects only loaded items; mobile offers a dedicated selection mode. Search, filter, and sort changes clear selection. Confirmed mutations reset loading to the first batch with the applied query and return inventory scrolling to the top. Bulk deletion uses the existing item DELETE endpoint with at most ten concurrent requests. Successful deletions trigger a refresh; failed rows remain in the confirmation for retry. Already missing rows are treated as removed, and a retry never repeats successful deletions.

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
| `productId` | Optional nullable product ID; the backend validates the referenced USDA product and barcode association        |
| `barcode`   | Optional nullable validated retail barcode; stored in canonical GTIN-14 format, including leading zeros        |

Non-metric volume units use US customary measures and are labeled as US in the form. `oz` means weight; `fl oz` means volume. Quantity and unit are stored as entered without automatic conversion.

Unknown fields are rejected, including client-supplied IDs and timestamps. The response is HTTP 201 with the saved fields plus a string `id` and UTC ISO `createdAt`/`updatedAt` timestamps. Expiration dates remain date-only strings in both MongoDB and JSON, avoiding timezone conversion. Duplicates are allowed: each submission creates a separate pantry entry.

`GET /api/v1/food-items` returns `{ "items": [...], "total": 42, "start": 0, "limit": 20 }`. It accepts `start` (0–1,000,000), `limit` (1–100, default 20), a trimmed `search` (up to 120 characters), and JSON-encoded `sort` and `filters`. Search matches literal text in food names. Sort is an ordered array of `{ "colId": "name", "sort": "asc" }`; allowed fields are name, quantity, unit, expiresOn, and createdAt. A stable ID tie-breaker prevents ambiguous page ordering. Filters use one text, numeric, or date condition per allowed field; combined conditions and unknown fields/operators are rejected. The shared Zod query schema validates both sides; MongoDB predicates are constructed from a whitelist, never raw client operators. Queries have a 5-second execution bound. API responses omit MongoDB's `_id` and internal version fields. Invalid input returns HTTP 400 with `VALIDATION_ERROR`; a failed database connection returns HTTP 503 with `DATABASE_UNAVAILABLE`. The form preserves entered values after a failed save and only reports success after the server confirms persistence.

`GET /api/v1/food-items/:id` returns one food item. `PATCH /api/v1/food-items/:id` accepts one or more editable fields defined by `updateFoodItemSchema`, validates them, and returns the saved item. Omitted fields retain their values; set `expiresOn` to `null` to clear the date. Updates preserve `id` and `createdAt` and refresh `updatedAt`. Empty updates, unknown fields, and client-supplied IDs/timestamps are rejected.

`DELETE /api/v1/food-items/:id` permanently removes that item and returns HTTP 204 with no body. Malformed IDs return HTTP 400 with `INVALID_ID`. Reading, updating, or deleting a missing item returns HTTP 404 with `FOOD_ITEM_NOT_FOUND`.

A reusable React Toastify notification component reports create, update, delete, partial bulk failures, and final network/load errors. Notifications sit at the bottom center with vertically centered contents, away from Add item, and dismiss after five seconds. The countdown pauses on hover, keyboard focus, or window focus loss. Notifications use semantic colors, Tailwind utilities, no motion, accessible status/alert roles, an explicit close button, and an Alt+T keyboard shortcut. The unstyled Toastify build uses a shared JavaScript countdown instead of depending on a CSS progress animation. Errors also remain next to their form or retry control.

The frontend routes HTTP 403 responses from pantry reads and writes to `/access-denied`, replacing the rejected route in history. Bulk deletion stops scheduling additional batches after a forbidden response and retains completed outcomes. Other errors stay with their form or recovery control. Authentication and ownership are enforced by the backend as described above. See Vercel deployment below for production setup and acceptance checks.

### Persistence tests

Regular tests run without database credentials. To also run real MongoDB integration tests, explicitly set `TEST_MONGODB_URI` to a separate database whose name ends in `_test`, then run `npm test`. For example, in PowerShell with a local MongoDB server:

```powershell
$env:TEST_MONGODB_URI = 'mongodb://127.0.0.1:27017/sari_test'
npm test
Remove-Item Env:TEST_MONGODB_URI
```

Integration tests never load `api/.env` and delete only the records they create. Browser tests exercise the table, mobile list, dialogs, and server query interactions against an API fixture, including infinite loading, sorting, filtering, selection, partial bulk failures, keyboard focus, and mobile layout. Unit tests isolate loading and mutation behavior from jsdom's layout limitations. The API integration suite verifies actual writes and reads against MongoDB.

## Vercel deployment

The Vercel projects are `sari-api` and `sari-web`. Their production domains are `https://sari-api.vercel.app` and `https://sari-web.vercel.app`.

Use two Vercel projects connected to this repository:

| Setting          | API project                                                          | Frontend project                                    |
| ---------------- | -------------------------------------------------------------------- | --------------------------------------------------- |
| Root directory   | `api`                                                                | `web`                                               |
| Framework        | Express                                                              | Vite                                                |
| Build command    | `npm run build -w @sari/contracts && npm run build`                  | `npm run build -w @sari/contracts && npm run build` |
| Install command  | `HUSKY=0 npm ci --include=dev --workspaces --include-workspace-root` | Same                                                |
| Output directory | Leave the Express preset default                                     | `dist`                                              |
| Environment      | `MONGODB_URI`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`               | Relative API base path is the default               |

Allow access to files outside each root directory, because the workspace lockfile, shared TypeScript configuration, and contracts package are outside the application directories. Build commands must compile the contracts package before the application so runtime imports and declaration files are available. Use Node 24.x in both projects. The API's default-exported `src/app.ts` is its Vercel entry point; `src/server.ts` is for conventional local/server hosting.

`api/vercel.json` and `web/vercel.mjs` record the install and build commands. Include development dependencies because the build requires TypeScript and Vite, and the root prepare script invokes Husky. `HUSKY=0` disables Git hooks in the deployment environment.

The root `.vercelignore` excludes local environment files and test artifacts from CLI uploads. Production credentials belong in Vercel environment variables, not uploaded source files.

`web/vercel.mjs` routes API requests **before** the SPA fallback. Production defaults to `https://sari-api.vercel.app`. Preview builds require `SARI_API_ORIGIN=https://sari-api-preview.vercel.app` and fail if it is missing or explicitly points to the production API.

Production, local development, and previews use separate databases and users: `sari_prod`, `sari_dev`, and `sari_preview`. Open `https://sari-web-preview.vercel.app` on your phone to test preview; sign in to Vercel first, then use a separate Sari preview account. See [database operations](docs/database-operations.md) for credential boundaries, deployment details, and the verified backup/restore workflow.

The `staging` Git branch deploys the **preview** environment:

| Environment | Git branch | Vercel frontend    | Vercel API         | MongoDB database/user |
| ----------- | ---------- | ------------------ | ------------------ | --------------------- |
| Preview     | `staging`  | `sari-web-preview` | `sari-api-preview` | `sari_preview`        |
| Production  | `main`     | `sari-web`         | `sari-api`         | `sari_prod`           |

Git deployments are enabled for all four projects. Pushes to `staging` update `sari-api-preview` and the protected `sari-web-preview` frontend. Pushes to `main` update the production `sari-api` and `sari-web` projects. Ignored Build Step settings skip other branches in each project. The preview frontend's domain is assigned to the `staging` Preview branch; the preview API uses its Production target with `staging` as its production branch, while retaining only preview database credentials. Vercel's environment label does not determine which database the API uses.

CI runs on pushes to both branches and on pull requests. Wait for CI and both deployments to succeed before testing a pushed revision. Frontend and API deployments finish independently; there is no atomic deployment or CI gate in Vercel. Keep API changes compatible with the preceding frontend during rollout. Follow the protected-branch promotion process above for releases.

Keep `VITE_API_BASE_URL=/api/v1` so browser requests remain same-origin. Set the API project's production `BETTER_AUTH_URL` to `https://sari-web.vercel.app`, use a dedicated production `BETTER_AUTH_SECRET`, and configure `MONGODB_URI` and optional `USDA_API_KEY` as backend secrets. Do not give preview deployments production database credentials.

For CLI deployments, run from the repository root so both application directories and the contracts package are uploaded:

```sh
npx vercel deploy . --project sari-api --prod
npx vercel deploy . --project sari-web --prod
```

Verify `/api/v1/health` and `/api/v1/ready` through the frontend domain, then check registration, login, pantry persistence, and a direct refresh of `/pantry`. Automatic Git deployments require the Vercel GitHub integration and the Vercel account's GitHub authentication to retain access to this repository.
