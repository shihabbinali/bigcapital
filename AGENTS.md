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

### Done (session 2026-08-04)
- **`system:migrate:latest` failed "migration directory is corrupt, missing ...ts"**: knex's `validateMigrationList` compares on-disk filenames against `bigcapital_system.knex_migrations`. Commit `e3182c15b` ("copy .js migration files") switched system migrations to compiled `.js` (on disk all `.js`, `loadExtensions: ['.js']`), but the existing DB had already recorded `.ts` names -> every record reported missing. Schema was already fully migrated (all 24 in batch 1). Fix: reconciled names via `UPDATE knex_migrations SET name = REPLACE(name, '.ts', '.js') WHERE name LIKE '%.ts'` (backup kept in `knex_migrations_backup`). Now `Already up to date`. Extending `loadExtensions` to `.ts` would NOT help — no `.ts` files exist on disk.
- **Tenant DBs checked and are consistent**: `bigcapital_tenant_*` `knex_migrations` records match `src/database/tenant/migrations` `.ts` files exactly (104/104). No fix needed.
- **Gotcha — tenant `.ts`/`.js` divergence between dev and prod**: `tenantDatabase.migrationsDir` is `path.join(__dirname, '../../database/tenant/migrations')`. Under ts-node/CLI it resolves to `src/**` (`.ts`) -> records `.ts` names; under compiled `dist` (Docker, org-build job) it resolves to `dist/**` (compiled `.js`) -> records `.js` names. A tenant migrated by the production org-build job records `.js`; a later ts-node `tenants:migrate:latest` against it fails with the same corrupt-directory error, in reverse. `TenantDBManager.migrate()` (`TenantDBManager.ts:99`) runs `migrate.latest()` WITHOUT `disableMigrationsListValidation` (the seed path has it). If a tenant shows a `.ts`/`.js` mismatch, reconcile `knex_migrations` names to whichever extension the current runtime loads.

### Notes / gotchas
- **`@bigcapital/pdf-templates` runtime uses the BUILT `dist`** (symlink; `main: ./dist/components.umd.js`). Edits to `shared/pdf-templates/src/**` do NOT take effect until `pnpm run build:shared` regenerates `dist`, then restart server.
- **Node 18 required for pnpm/CLI**: under Node 23, `corepack` throws `Cannot find matching keyid`. Prefix commands with `export PATH="/home/spro/.nvm/versions/node/v18.20.8/bin:$PATH"` (or run e.g. `pnpm run tenants:migrate:latest` under Node 18).
- **Tenant DB table names are UPPERCASE** (`SALES_RECEIPTS`, `PDF_TEMPLATES`, `ACCOUNTS`, ...) with `lower_case_table_names=0` (case-sensitive). Reading/writing directly via the `mysql` CLI MUST use uppercase table+column names (e.g. `TERMS_CONDITIONS`). The app/knex models query lowercase and work (there's an internal reconciliation), so inspect columns via the app models, not the raw CLI.

### Done (session 2026-08-05, second half): NATIVE `bun src/main.ts` now boots 🎉
- **Supersedes the compiled-dist approach** above. Native `bun src/main.ts` binds :3000 and `/api/system_db` returns `{"status":"ok"}` HTTP 200. The earlier "native is a dead end" conclusion (whack-a-mole `Export named 'X' not found` / type-import elision) was solved by:
  1. **`verbatimModuleSyntax: true` + `module: esnext`** in `packages/server/tsconfig.json` (was commonjs). tsc still passes `--noEmit`. Bun reads this tsconfig for `bun run`/`bun build`.
  2. The **3 codemod passes** (typeonly / typecheck / typepos + runtime-absent-type restore) converting value-imports of type-only symbols to `import type` across ~1500 files.
- **Root-cause of `Nest can't resolve dependencies ... argument Object at index [0]`**: a bun transpiler bug — a **value import used only as a constructor param type is elided to `Object` in `design:paramtypes` IF the class has NO class-level decorator but HAS param decorators** AND the imported type sits at an index BEFORE the first decorated param. Position-dependent (repros in `/tmp/opencode/buntest` T3/T11/T12; preserved when after the first decorator or when the class has ANY class-level decorator e.g. `@Injectable()`). `verbatimModuleSyntax` does NOT fix this specific case (only the class-level decorator does). Only 3 active classes hit it (4th is fully commented out): `GetItemCategoriesService`, `DashboardService`, `GetUsersService` — added `@Injectable()` to each. **Any new/edited DI class with param decorators but no class decorator will break under bun — always add `@Injectable()` (or another class-level decorator).**
- **`mapKeysDeep is not a function` (serialize.interceptor)**: `import * as _ from 'lodash'` + `deepdash` breaks — the ESM namespace wrapper is read-only, so `addDeepdash(_)` can't `mixin` into it, and methods come back `undefined`. Fixed in `src/utils/deepdash.ts`: `import _ from 'lodash'` (default interop works; `require('lodash')` equivalent). Only 2 other files namespace-import lodash (`entries-amount-diff.ts`, `is-blank.ts`) — fine since they only read methods.
- **Gotcha — `EADDRINUSE` on :3000 was an unrelated docker container** `brainease_web` (`07c2b1adfd29`) from another project mapping host 3000. `docker stop` it before booting the API locally.

### Done (session 2026-08-05): Bun runtime migration (branch `feature/bun-runtime`)
- **Objective**: run the server CLI/migrations and production runtime on **Bun** (compiled `dist`, NOT native `bun src/*.ts`), keeping pnpm as the package manager. Dev loop `start:dev`/`start` stay on the nest CLI (unchanged).
- **Working approach = `bun dist/*.js`** (compiled output). Measured: `bun dist/cli.js tenants:list` 26.5s vs node 43.8s (~40% faster); `system:migrate:latest` and `tenants:migrate:latest` both work ("Already up to date", no knex corruption error). ts-node timed out at 200s+ (EXIT 124).
- **Native `bun src/*.ts` is a dead end**: 657 type-only named imports across 2186 files rely on tsc full-program elision; in circular import graphs bun's per-file transpiler throws `SyntaxError: Export named 'X' not found` (`TenantModelProxy` → fixed 392 files via `import type` → next `IFilterRole`, whack-a-mole). Reverted all `packages/server/src` edits. `bun build` bundling also fails on optional deps (knex `pg`/`better-sqlite3`/`oracledb`, `nestjs-i18n`→`hbs`, `@fastify/static`, `node-pre-gyp`→`aws-sdk`). Use `bun` only as executor of compiled dist.
- **package.json scripts** (`packages/server/package.json`): all 10 `cli:*` → `bun dist/cli.js ...`; `start:prod` → `bun dist/main`; `start`/`start:dev`/`start:debug` unchanged.
- **Dockerfile → 3 stages**: `builder` (node:18, `nest build`), `deps` (node:18, `pnpm install --prod --frozen-lockfile` so bcrypt compiles against **musl**), `runtime` (`oven/bun:1-alpine`, copies node_modules/symlinks from `deps` + dist/shared from `builder`). `CMD ["bun","packages/server/dist/main.js"]`, HEALTHCHECK uses `bun -e "require('http')..."`. **Verified go/no-go**: musl-compiled bcrypt@5.1.1 hash/compare works under `oven/bun:1-alpine`.
- **Compose migration commands**: `docker-compose.alwathba.yml` + `docker-compose.dokploy.yml` migration service now runs `bun dist/cli.js system:migrate:latest && bun dist/cli.js tenants:migrate:latest`. (`docker/migration/Dockerfile` still uses `node` because it extends the upstream `bigcapitalhq/server:latest` image for `docker-compose.prod.yml` — not used in the Alwathba stack, leave as-is.)
- **`shared/pdf-templates/package.json` `exports` fix (kept)**: `import` condition pointed to nonexistent `./dist/components.es.js`; webpack only builds `components.umd.js`. Pointed `import` → `./dist/components.umd.js` (same as `require`). Webapp doesn't import pdf-templates. Fixes bun ESM resolution; also a latent bug for any ESM importer.
- **Phantom `express` dep (kept)**: 30+ src files do `import { Response } from 'express'` but express only existed transitively in pnpm's `.pnpm` store. Added `"express": "^4.21.1"` to `packages/server/package.json` dependencies; `pnpm install --offline` OK. Needed for CLI to load under bare bun/node.
- **Existing tenant `knex_migrations` recorded `.js` names** (created via prod org-build) — consistent with running compiled `dist`, so `bun dist/cli.js tenants:migrate:latest` reconciles cleanly. Only a problem if a tenant was migrated by ts-node (records `.ts`) — see the `.ts`/`.js` divergence gotcha above.
- **Caveat**: compiled API server boot was already broken/slow in this env under BOTH node and bun (`dist/main.js` doesn't bind within 90–150s, empty logs) — pre-existing, not a bun regression, cause undiagnosed.

### Open

- Logo upload returns 401 even when authenticated. Root cause was `postFormData` couldn't read fetcher's auth headers before the `__fetcherConfig` fix. Likely fixed now — needs rebuild + test.
- `HOSTED_ON_BIGCAPITAL_CLOUD=false` is hardcoded in `docker-compose.alwathba.yml` — should be configurable via `.env.alwathba`.
- `DOKPLOY_DEPLOY_WEBHOOK` GitHub secret not yet set — auto-deploy from CI is skipped (workflow warns) until it is.
- Full `docker compose -f docker-compose.alwathba.yml --build` not yet run with the 3-stage bun Dockerfile; builder-stage `chromium`/`nest build` time not yet validated end-to-end (bcrypt+CLI path verified in isolation).
- Native `bun src/main.ts` boot proven + jest gate + webapp gate all green (see below). Phase 1 (bun workspaces) done — see below. Phase 2–4 (native scripts, `oven/bun:1.3.9-alpine` Dockerfiles, pdf-templates via `bun build`, delete dist path) still pending. The old compiled-dist Dockerfile/scripts are now obsolete and should be migrated to native `bun src/main.ts`/`bun src/cli.ts`.

### Done (session 2026-08-05, Phase 1): bun workspaces replace pnpm+lerna
- **Root manifest**: `package.json` now has `workspaces: ["packages/*","shared/*"]`; all `lerna run` scripts rewritten to `bun run --filter` (brace/glob and multiple `--filter` flags both work; `--filter '*'` excludes root; runs in topo order; silently skips packages lacking the script). `prepare` (husky) + `postinstall` retained. Removed devDeps `lerna`, `pnpm`, `@commitlint/config-lerna-scopes`; `commitlint.config.js` now extends `@commitlint/config-conventional`.
- **Deleted** `pnpm-workspace.yaml`, `lerna.json`, `pnpm-lock.yaml`. Added `bunfig.toml` (`linkWorkspacePackages = true`).
- **Lockfile**: bun 1.3.14 writes the **text `bun.lock`** (NOT binary `bun.lockb`). `bun install` **migrated the pnpm lockfile automatically** ("migrated lockfile from pnpm-lock.yaml", 5120 packages). Backup of old lock at `/tmp/pnpm-lock.yaml.bak`.
- **`node_modules` layout changed**: bun hoists into `node_modules/.bun/<pkg>@<version>/node_modules/<pkg>/` (symlinked from each package dir), NOT pnpm's `.pnpm`. The jest-runtime + depd patch script (`scripts/patch-node-modules.js`) now resolves via `require.resolve` with a `.bun`/`.pnpm` scan fallback, so it works under BOTH layouts. `postinstall` re-applies automatically.
- **Post-install regression check (all still green)**: unit specs 19/19 pass, `auth.e2e-spec.ts` 3/3 pass (slower on cold cache: ~371s vs ~133s), native `bun src/main.ts` binds :3000 with `/api/system_db` 200, `bunx --bun vite` on :4000 proxies `/api` → 200.
- **Note**: the jest-runtime original snippet includes a `// @ts-expect-error: no index signature` line between `forEach` and `Module[key]=value` — patch `old` string must match it exactly.
- **`workspace:*` deps** in `packages/server`/`packages/webapp` package.json need NO change — bun supports `workspace:*` natively.

### Done (session 2026-08-05, jest + webapp gates): ALL Phase 0 success gates green 🎉
- **jest gate (`bunx --bun jest`)**: 2 unit specs (App.controller + _utils, 19 tests) AND `auth.e2e-spec.ts` (3 tests) all PASS under bun 1.3.14. Four bun/jest incompatibilities fixed:
  1. **`Attempted to assign to readonly property`** (jest-runtime build/index.js:1638): bun's `node:module` `Module` class has readonly statics (`prototype`); `Object.entries(Module).forEach(k => Module[k]=v)` throws. **Patched jest-runtime** to use `Object.defineProperty(Module, key, desc)` instead of assignment (official fix from bun issue #16933). **NOTE: node_modules patch — reapply on install via `scripts/patch-node-modules.js` (auto-runs in `postinstall`).**
  2. **`callSite.getFileName is not a function`** (depd, loaded by express/body-parser): inside jest's `vm` sandbox, bun's `Error.captureStackTrace` returns STRINGS instead of CallSite objects. **Patched depd** (`callSiteLocation` guards `typeof callSite.getFileName !== 'function'` → return `['<anonymous>',0,0]`). Also a node_modules patch.
  3. **`undefined is not a constructor (new lru-cache)`**: ts-jest compiled `import LruCache from 'lru-cache'` to `.default` but `lru-cache@6` is `module.exports = LRUCache` (no default). Fixed by **`esModuleInterop: true`** in `tsconfig.spec.json` (new, CJS-override of the main tsconfig).
  4. **`TS1286 ESM not allowed in CommonJS`** + **`import * as request from 'supertest'` not callable**: the main tsconfig now has `module: esnext` + `verbatimModuleSyntax: true` (for bun). ts-jest compiles to CJS, so it MUST NOT use the main tsconfig. Created **`tsconfig.spec.json`** (extends main: `module: commonjs`, `verbatimModuleSyntax: false`, `esModuleInterop: true`) + **`test/tsconfig.spec.json`** (same, extends `../tsconfig.json`), wired into `package.json` `jest.globals['ts-jest'].tsconfig` and `test/jest-e2e.json` `globals`. **Converted all 56 e2e specs** `import * as request from 'supertest'` → `import request from 'supertest'`.
- **e2e beforeAll timeout gotcha**: `init-app-test.ts` compiles `AppModule` which takes 13–26s cold; jest default `testTimeout` is 5s, so the shared `beforeAll` silently died (afterAll then crashed on undefined `app`). Fixed: `testTimeout: 300000` in `test/jest-e2e.json` + `jest.setTimeout(300000)` in `init-app-test.ts`.
- **Pre-existing signin 401 in e2e harness**: `init-app-test.ts` signs in `bigcapital@bigcapital.com / 123123123` → 401 `INVALID_DETAILS` in this DB (user/tenant not present in this env). Non-blocking: signup/signin/reset tests create their own users and pass. If you want the harness signin to succeed, the seeded user must exist in the system DB.
- **webapp gate (`bunx --bun vite`)**: vite 5.4.10 serves on :4000 under bun, serves index.html, and `/api` proxy to the bun API on :3000 returns 200. (Runs as a node child of bunx — fine.)
- **`ts-jest` WARN `globals` deprecated** (cosmetic): still works. New-style transform config `['ts-jest', { tsconfig }]` is the modern form if we later clean it up.
- **Bun upgraded 1.3.9 → 1.3.14 locally** (`bun upgrade`) — jest readonly-property bug NOT fixed there (still needs the node_modules patch). Pin decision for Docker images pending.

