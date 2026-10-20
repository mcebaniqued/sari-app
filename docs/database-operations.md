# Database operations

The Atlas project is **Sari App**, cluster `sariapp-dev`. The cluster name is historical; it hosts the current production database as well as separate development and preview databases. Do not delete the cluster as part of legacy cleanup.

| Environment       | Database       | Application user | Configuration                                       |
| ----------------- | -------------- | ---------------- | --------------------------------------------------- |
| Production        | `sari_prod`    | `sari_prod`      | `sari-api`, Production secrets                      |
| Local development | `sari_dev`     | `sari_dev`       | Ignored `api/.env`                                  |
| Preview           | `sari_preview` | `sari_preview`   | `sari-api-preview`, plus `sari-api` Preview secrets |

Each application user has `readWrite` access only to its own database, restricted to this cluster. Development and preview credentials must never receive production access. The environments share cluster capacity and its network access list, so this is database and credential isolation rather than infrastructure isolation.

The old `sariapp_dev`, `sariapp_vercel`, and `sari_vercel_prod` database users have been revoked. Historical API deployments can still contain their old connection secrets. If a rollback is needed, redeploy the desired source revision using current Production environment variables rather than promoting a historical deployment that used a revoked account.

The retired `sariapp_dev` database contained `users` and `pantryentries` and has been removed. The abandoned empty `sari_mvp1_test` database has also been removed; automated integration tests use their own disposable MongoDB and do not need Atlas. Production was migrated from the historical `sari_mvp1` name to `sari_prod`, preserving documents, BSON types, collection options, and indexes. The former database was removed after live verification and a verified backup of `sari_prod`; a protected migration archive remains available locally for recovery.

## Controlled database migrations

Set `MAINTENANCE_MODE=true` in the production API project and deploy the current source before copying production. Confirm both the direct API and frontend proxy return `503` for authenticated routes and mutations, then allow in-flight requests to finish. Liveness remains available; readiness returns `503`. The guard runs before authentication and database access and sends `Cache-Control: no-store` and `Retry-After: 60`.

Export the frozen database to a protected archive, restore into a new database using temporary scoped credentials, and compare every document, BSON type, collection option, and index. Update the production database user's scope and the API's Secret `MONGODB_URI`, preserving `BETTER_AUTH_SECRET`. Set `MAINTENANCE_MODE=false`, redeploy, and verify readiness, authentication, and persisted pantry writes before deleting the former database. Update the backup account and protected connection, run a verified backup of the new database, and revoke temporary migration credentials. Retain the source archive and checksum for recovery.

## Preview deployments

The stable frontend preview is `https://sari-web-preview.vercel.app`, backed by `https://sari-api-preview.vercel.app`. The preview API uses a separate authentication secret and trusts the stable preview frontend origin. Preview accounts, sessions, pantry entries, and product caches stay in `sari_preview`.

`web/vercel.mjs` selects the API origin at configuration time. Production defaults to `https://sari-api.vercel.app`. The `sari-web` Preview environment sets `SARI_API_ORIGIN=https://sari-api-preview.vercel.app`. A preview build fails if the origin is missing or explicitly points to the production API. Keep this value server-side; browsers continue using `/api/v1`.

Use the stable preview URL for account flows. Arbitrary branch/deployment URLs are not automatically trusted authentication origins. Add an exact origin to the preview API's `AUTH_TRUSTED_ORIGINS` only when that URL needs its own account flow; do not add preview origins to production. Deploy the preview API and frontend together when their contracts change. The preview API project uses its Production target to provide a stable backend domain; it still has only preview database credentials.

From the repository root:

```powershell
npx vercel deploy . --project sari-api-preview --scope miguels-projects-51fb4258 --prod
npx vercel deploy . --project sari-web --scope miguels-projects-51fb4258 --environment preview
npx vercel alias set <frontend-preview-deployment-url> sari-web-preview.vercel.app --scope miguels-projects-51fb4258
```

Vercel Authentication protects the frontend preview. For automated browser tests, obtain a short-lived development OIDC token from the linked `web` project with `vercel env run` and send it as `x-vercel-trusted-oidc-idp-token` only to the preview frontend origin. Never disable deployment protection or expose the token in browser JavaScript.

Preview barcode lookups require a separate `USDA_API_KEY` in the preview API project. Manual entry works without it. A shared preview database is disposable; do not enter production or sensitive personal data.

## Backups and restore verification

Native backups are currently off, and the Atlas console does not offer them on this shared-tier cluster. The local workflow uses MongoDB's official `mongodump` and `mongorestore`, preserving BSON types, collection metadata, and indexes. It does not copy production data into development or preview.

The `sari_backup` user can read `sari_prod` and read/write only the disposable `sari_restore_verify` database. It cannot modify production. Its connection is stored as a Windows-protected SecureString in `.backups/backup-connection.xml`, usable only by the Windows user who created it. The `.backups` folder has restricted Windows permissions and is excluded from Git and Vercel uploads.

MongoDB Database Tools 100.19.1 are installed locally under `.backups/tools`. To reinstall, download the Windows x86-64 ZIP from MongoDB's official Database Tools download page. The verified ZIP SHA-256 is `527738a0f9ab2d80ea40cb8fc7a68f8e28664a2fd4e3b63626c2d4629aeb7f37`.

Run from PowerShell:

```powershell
# Export production and write a SHA-256 manifest.
./scripts/backup-atlas.ps1

# Also restore into the disposable database, compare every document and index,
# then remove the disposable collections.
./scripts/backup-atlas.ps1 -VerifyRestore
```

Archives and manifests are written to `.backups/archives`. A manifest with `restoreVerified: true` means the restore matched source documents, BSON types, collection options, and indexes at verification time. Failed verification returns an error and does not produce a success manifest. Run during a quiet period: Free clusters do not support oplog-based point-in-time exports, so writes during an export can produce a cross-collection inconsistency or cause comparisons to fail.

These backups are local and run on demand. They do not protect against loss of this computer. Copy completed archives and manifests to private off-machine storage and choose a retention schedule before relying on them for disaster recovery. Archives contain password hashes and session records and are not encrypted by `mongodump`; protect them accordingly. The Windows-encrypted credential file is not a portable recovery key, but the standard archive can be restored elsewhere using new authorized credentials.

For a real recovery, restore to a new database with temporary scoped credentials, verify it, then switch the API's Production `MONGODB_URI` and redeploy. Do not restore over the live database by default. Keep `BETTER_AUTH_SECRET` stable across database-only restores unless intentional session invalidation is required.
