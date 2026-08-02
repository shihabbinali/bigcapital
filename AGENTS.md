# Bigcapital monorepo

## Structure

pnpm workspaces + Lerna. Two package groups:
- `packages/*` — `server` (NestJS), `webapp` (React+Vite)
- `shared/*` — `sdk-ts` (OpenAPI SDK), `bigcapital-utils`, `email-components`, `pdf-templates`

## Node

Node 18.16.1 (`.nvmrc`). `engines` range is `16.x || 17.x || 18.x`.

## Key commands (run from repo root)

| Command | Scope |
|---|---|
| `pnpm run build:shared` | shared packages first |
| `pnpm run build:server` | server |
| `pnpm run build:webapp` | webapp |
| `pnpm run dev:server` | server w/ watch |
| `pnpm run dev:webapp` | webapp (Vite, proxied `/api`→`:3000`) |
| `pnpm run typecheck` | all packages |
| `pnpm run lint` | all packages |
| `pnpm run generate:sdk-types` | export server OpenAPI → generate types → build sdk-ts |
| `pnpm run test:e2e` | **only runs `auth.e2e-spec.ts`** (see jest-e2e.json `testRegex`) |

Dev server needs `packages/server/.env` (loaded from `ConfigModule.forRoot({ envFilePath: '.env' })`).

## JWT gotcha

Server reads `APP_JWT_SECRET` (not `JWT_SECRET`). Falls back to hardcoded `"123123"` at `packages/server/src/common/config/jwt.ts:4`.

## SDK / API layer

- `shared/sdk-ts/src/fetch-utils.ts` wraps `openapi-typescript-fetch`. Fetcher stores its config in `__fetcherConfig` so `postFormData()` / `rawRequest()` / `getBlob()` can access auth headers. If auth headers don't propagate, check `getFetcherConfig`.
- `shared/sdk-ts/src/attachments.ts` `uploadAttachment()` uses `postFormData` (not generated client) because the generated client `JSON.stringify`s FormData bodies.
- Webapp builds the fetcher via `createApiFetcher({ baseUrl: '/api', init: { headers: { Authorization, organization-id } } })`.

## Testing

- E2E test config is at `packages/server/test/jest-e2e.json`. `testRegex` pins to `auth.e2e-spec.ts$` by default — only runs auth tests. `maxWorkers: 1`.
- `init-app-test.ts` signs in as existing user (`bigcapital@bigcapital.com` / `123123123`) — it does NOT create the user or seed the tenant.
- Unit tests use Jest (`*.spec.ts` inside `src/`).

## Docker deployment

| Compose file | Uses | Command |
|---|---|---|
| `docker-compose.prod.yml` | Pre-built Docker Hub images | `setup.sh` |
| `docker-compose.alwathba.yml` | Build from source + Cloudflare R2 | `docker compose -f docker-compose.alwathba.yml --env-file .env.alwathba up -d --build` |

`docker-compose.alwathba.yml` fixes upstream bugs:
- passes `APP_JWT_SECRET` (not `JWT_SECRET`)
- `HOSTED_ON_BIGCAPITAL_CLOUD=false` skips forced subscription
- healthcheck-based `depends_on` instead of `wait-for-it`

## Database

- MariaDB 10.2 (EOL; pinned for compatibility)
- Two DB tiers: **system DB** (`bigcapital_system`) + **per-tenant DBs** (`bigcapital_tenant_<orgId>`)
- Migrations via `knex`; always run `system` before `tenant`
- Migration CLI: `pnpm run system:migrate:latest`, `pnpm run tenants:migrate:latest`
- No CLI to create + initialize a tenant — only through the web UI setup wizard (signup → `POST /api/organization/build`)

## Env files

- `.env` is gitignored (production secrets)
- `.env.alwathba` is gitignored (Alwathba local secrets)
- `.env.alwathba.example` is the template for the self-hosted stack

## Tenant initialization flow

Signup → tenant record → signin → `/setup` wizard → `POST /api/organization/build` → BullMQ job creates DB, runs system+tenant migrations, seeds data.

## Session: Alwathba self-hosted stack fixes

### Done
- Added `openapi-typescript-fetch` to `packages/webapp/package.json` (missing dependency).
- Pinned `sanitize-html` to `2.17.5` in `packages/server/package.json` to avoid ESM `htmlparser2@12` on Node 18.
- Added `useEffect` import in `SetupInitializingForm.tsx`.
- Fixed MySQL healthcheck to interpolate `DB_ROOT_PASSWORD` correctly.
- Fixed `uploadAttachment` in `shared/sdk-ts/src/attachments.ts` to use `postFormData` (generated client `JSON.stringify`s FormData to `"{}"`).
- Fixed `createApiFetcher` / `getFetcherConfig` in `shared/sdk-ts/src/fetch-utils.ts` to store/read `__fetcherConfig` (openapi-typescript-fetch stores config in closures, not properties).
- Rewrote `ChromiumlyHtmlConvert.service.ts` to POST HTML directly to Gotenberg (no temp files, no `GOTENBERG_DOCS_URL`, no `Document` model tracking).
- Added logo data-URI embedding in `SaleInvoicePdf.service.ts` so Gotenberg doesn't need external network access for branded PDFs.
- Added error handling to branding form (`PreferencesBrandingForm.tsx`).
- Migrated from MinIO to Cloudflare R2: removed MinIO services from both `docker-compose.yml` and `docker-compose.alwathba.yml`; replaced all S3 env vars with R2 placeholders in `.env`, `.env.alwathba`, `.env.alwathba.example`, and `packages/server/.env`.
- Cleaned stale MinIO references in code comments (`GetAttachmentPresignedUrl.ts`).
- Fixed `companyLogoUri` → `companyLogo` type error in `SaleInvoicePdf.service.ts`.
- Added signature blocks to invoice templates (`shared/pdf-templates` + webapp preview).
- Added Dokploy deployment: `docker-compose.dokploy.yml` (image-based, proxy on `dokploy-network`, no host ports) + `.github/workflows/docker-alwathba.yml` (push to `alwathba-merged` → build/push server+webapp to Docker Hub tags `alwathba`/`alwathba-<sha>` → POST `DOKPLOY_DEPLOY_WEBHOOK` after both succeed).
- Gated signup verification mail on `SIGNUP_EMAIL_CONFIRMATION` (`AuthMail.subscriber.ts`) — previously queued on every signup; with no SMTP, nodemailer tried localhost:587 and logged ECONNREFUSED.

### Notes / gotchas (production)
- `AuthMailSubscriber` skips verification mail when `signupConfirmation.enabled` is false — no SMTP needed for signup.
- `ER_BAD_DB_ERROR Unknown database 'bigcapital_tenant_<id>'` during setup is transient: the org-build BullMQ job creates the tenant DB asynchronously; the models-init guard catches and logs it. It stops once the build job completes.

### Done (session 2026-08-03)
- **Toolbar list-print for receipts** was 500ing `provider does not exist in the current context`. Root cause: `SaleReceiptsExportable` was the ONLY exportable missing the `@ExportableService({ name: SaleReceipt.name })` decorator. Without it `getExportableService('SaleReceipt')` returns `undefined` -> `ModuleRef.resolve(undefined)` in `ExportService.ts:125` 500s. **Every exportable must carry `@ExportableService({ name: <Model>.name })`** (same fix already applied to invoice in `04c25bd31`).
- **Silent "print does nothing"**: `useRequestPdf` (`webapp/src/hooks/useRequestPdf.tsx`) and `use-export-pdf.ts` have **no `.catch`**, so a server 5xx leaves `pdfUrl=''` (anchor `href=""`) / no download and shows no UI error. Any new PDF/print feature should add a `.catch` (toast) for visibility.
- **Receipt PDF printed blank Customer Note / Terms**: `transformReceiptToBrandingTemplateAttributes` (`SaleReceipts/utils.ts`) didn't pass `customerNote`/`termsConditions`, so the sample text in `defaultSaleReceiptBrandingAttributes` (`constants.ts`) leaked into the print. Fixed by passing real (possibly empty) values; template already hides empties via `!isEmpty`. **`sales_receipts` lacked a `terms_conditions` column** (unlike `sales_invoices`); added via tenant migration `20260802000003_add_terms_conditions_to_sales_receipts` (+ model/DTO/response-DTO field `termsConditions`).
- **Receipt signature block** added (mirror of invoice): props + 2-column Customer/Authorized signature block in `shared/pdf-templates/src/components/ReceiptPaperTemplate.tsx` AND `webapp/.../ReceiptCustomize/ReceiptPaperTemplate.tsx`. Note webapp uses Blueprint `Text` -> pass `style={{ fontSize, color, fontWeight }}`, NOT individual props.
- **sdk-ts build was broken** (blocked `pnpm build`): `fetch-utils.ts` imported `./middleware/snake-case-request-middleware` and `./middleware/error-reporter-middleware` which didn't exist (only `camel-case-middleware.ts`). Created both (Middleware type = `(url, init, next) => Promise<ApiResponse>`, `init.headers` is a `Headers`). Now builds green.

### Notes / gotchas
- **`@bigcapital/pdf-templates` runtime uses the BUILT `dist`** (symlink; `main: ./dist/components.umd.js`). Edits to `shared/pdf-templates/src/**` do NOT take effect until `pnpm run build:shared` regenerates `dist`, then restart server.
- **Node 18 required for pnpm/CLI**: under Node 23, `corepack` throws `Cannot find matching keyid`. Prefix commands with `export PATH="/home/spro/.nvm/versions/node/v18.20.8/bin:$PATH"` (or run e.g. `pnpm run tenants:migrate:latest` under Node 18).
- **Tenant DB table names are UPPERCASE** (`SALES_RECEIPTS`, `PDF_TEMPLATES`, `ACCOUNTS`, ...) with `lower_case_table_names=0` (case-sensitive). Reading/writing directly via the `mysql` CLI MUST use uppercase table+column names (e.g. `TERMS_CONDITIONS`). The app/knex models query lowercase and work (there's an internal reconciliation), so inspect columns via the app models, not the raw CLI.

### Open

- Logo upload returns 401 even when authenticated. Root cause was `postFormData` couldn't read fetcher's auth headers before the `__fetcherConfig` fix. Likely fixed now — needs rebuild + test.
- `HOSTED_ON_BIGCAPITAL_CLOUD=false` is hardcoded in `docker-compose.alwathba.yml` — should be configurable via `.env.alwathba`.
- `DOKPLOY_DEPLOY_WEBHOOK` GitHub secret not yet set — auto-deploy from CI is skipped (workflow warns) until it is.
