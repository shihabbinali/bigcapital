# Bigcapital monorepo

## Structure

Bun workspaces (`workspaces: ["packages/*","shared/*"]`, `bunfig.toml`). Two package groups:
- `packages/*` — `server` (NestJS), `webapp` (React+Vite)
- `shared/*` — `sdk-ts` (OpenAPI SDK), `bigcapital-utils`, `email-components`, `pdf-templates`

Branch `feature/bun-runtime` migrated from pnpm + Lerna to bun. pnpm/lerna files are gone (`pnpm-lock.yaml`, `pnpm-workspace.yaml`, `lerna.json`).

## Toolchain

- **Bun** is the package manager and runtime. Lockfile is the **text `bun.lock`** (not binary `bun.lockb`). Local bun is 1.3.14; Docker images pin `oven/bun:1.3.9-alpine`.
- Node 18.16.1 (`.nvmrc`); `engines` range is `16.x || 17.x || 18.x`. Node is still needed for the `postinstall` patch script (runs via `node`).
- `bun install` hoists into `node_modules/.bun/<pkg>@<version>/node_modules/<pkg>/` (symlinked from each package dir).
- `workspace:*` deps work natively under bun.
- **`bun` respects `#!/usr/bin/env node` shebangs**: CLIs like `vite`, `tsup`, `nest` run under **node** by default unless invoked with `--bun` (bun then installs a temp self-symlink named `node` on PATH, so `ps`/args may show `node` while `/proc/<pid>/exe` is actually bun). webapp (`vite`), utils and sdk-ts (`tsup`) all use `bun --bun ...` in their scripts so the whole toolchain runs under bun; only `cross-env` (a trivial env-setter) still runs on node.
- **`bun run --filter` runs scripts in dependency order** — a package's script waits for its deps' scripts to *finish*. Long-running dev/watch scripts therefore MUST be run with `--parallel` (e.g. root `dev`/`dev:webapp`/`dev:server`), otherwise a dependent's `vite`/`nest --watch` never starts while `@bigcapital/utils`'s tsup watch runs forever.

## Key commands (run from repo root)

| Command | Scope |
|---|---|
| `bun install` | install (migrates lockfile if needed) |
| `bun run --filter '@bigcapital/utils' --filter '@bigcapital/pdf-templates' build` | build shared packages first |
| `bun run --filter '@bigcapital/server' build` | server (`bun --bun nest build`, CJS dist — dist is unused in prod, only for `nest start`) |
| `bun run --filter '@bigcapital/webapp' build` | webapp (`bun --bun vite build`) |
| `bun src/main.ts` | **server dev/prod runtime** (native, from `packages/server/`) |
| `bun run typecheck` | all packages (`tsc --noEmit`) |
| `bun run lint` | all packages |
| `bun run generate:sdk-types` | export server OpenAPI → generate types → build sdk-ts |
| `bun run test:e2e` | **only runs `auth.e2e-spec.ts`** (see jest-e2e.json `testRegex`) |

Dev server needs `packages/server/.env` (loaded from `ConfigModule.forRoot({ envFilePath: '.env' })`).

Server scripts of note (`packages/server/package.json`): `start:prod` = `bun src/main.ts`, all `cli:*` = `bun src/cli.ts <cmd>`. **`dev` = `bun --watch src/main.ts`** — the fast dev loop: no tsc compile, ~3 s cold start, ~20 s edit→restart (bun re-transpiles the whole ~2.2k-file graph on restart; process itself exits in ~220 ms). Transpile-only, **no typecheck** — use `bun run typecheck` / the editor. `start`/`start:dev`/`start:debug` run the **nest CLI under bun**: `bun --bun nest start [--watch|--debug]` (type-checked, slow initial compile of ~2.2k files, edit→restart ~30–60 s), and `nest-cli.json` sets `"exec": "bun"` so the compiled dist is spawned with `bun` (not `node`).

## JWT gotcha

Server reads `APP_JWT_SECRET` (not `JWT_SECRET`). Falls back to hardcoded `"123123"` at `packages/server/src/common/config/jwt.ts:4`.

## SDK / API layer

- `shared/sdk-ts/src/fetch-utils.ts` wraps `openapi-typescript-fetch`. Fetcher stores its config in `__fetcherConfig` so `postFormData()` / `rawRequest()` / `getBlob()` can access auth headers. If auth headers don't propagate, check `getFetcherConfig`.
- `shared/sdk-ts/src/attachments.ts` `uploadAttachment()` uses `postFormData` (not generated client) because the generated client `JSON.stringify`s FormData bodies.
- `shared/sdk-ts/src/middleware/` has `camel-case-request-middleware.ts`, `snake-case-request-middleware.ts`, `error-reporter-middleware.ts` (Middleware type = `(url, init, next) => Promise<ApiResponse>`, `init.headers` is a `Headers`).
- Webapp builds the fetcher via `createApiFetcher({ baseUrl: '/api', init: { headers: { Authorization, organization-id } } })`.

## Webapp theming

- Centralized theme system: `AppThemeProvider` (`packages/webapp/src/context/theme/ThemeProvider.tsx`). `applyTheme` sets `data-theme` on `<html>` and toggles the `bp4-dark` class on **both** `<html>` and `<body>` so portal content (drawers/dialogs/toasts) inherits the theme.
- Themes: `appThemes` = `light` (`bpDark: false`), `dark` (`bpDark: true`). Resolution order: localStorage `theme` key → OS `prefers-color-scheme` → light. Pre-paint script `packages/webapp/public/preload-theme.js` applies the theme before React mounts (avoids flash). `/payment/*` routes force light.
- Hooks: `useTheme()` → `{ theme, isDark, setTheme, toggleTheme }`; `useDarkMode` wraps it. Toggle lives in the topbar user dropdown + Shift+H hotkey (`GlobalHotkeys`).
- **Styling convention**: light-mode values are the default; dark-mode overrides go under `.bp4-dark &` (styled-components/SCSS) or inside `:root[data-theme='dark']` (CSS variables in `style/_variables.scss`, lines 321+). Do NOT hardcode dark values as the base declaration — it breaks light mode (recently fixed in `CommercialDocBox`/`DrawerMainTabs`/`TotalLinePrimitive`, which had dark-only overrides).

## Testing

- Jest runs under bun: **`bunx --bun jest`**. Requires node_modules patches (below) — auto-applied by `postinstall` via `scripts/patch-node-modules.js`.
- E2E config: `packages/server/test/jest-e2e.json`. `testRegex` pins to `auth.e2e-spec.ts$` by default — only runs auth tests. `maxWorkers: 1`. `testTimeout: 300000` (AppModule compiles 13–26s cold).
- `init-app-test.ts` signs in as existing user (`bigcapital@bigcapital.com` / `123123123`) — it does NOT create the user or seed the tenant. In this env that signin 401s (user not present) — non-blocking, signup/signin/reset tests create their own users.
- Unit tests use Jest (`*.spec.ts` inside `src/`).
- **tsconfig split (required)**: main `packages/server/tsconfig.json` uses `module: esnext` + `verbatimModuleSyntax: true` for bun. **`tsconfig.build.json` (used by the nest CLI for `nest build`/`nest start`/`start:dev`) MUST override to `module: commonjs` + `verbatimModuleSyntax: false` + `esModuleInterop: true` + `incremental: false`** — otherwise the nest CLI emits ESM with extensionless imports that can't run (`ERR_MODULE_NOT_FOUND` on `nest start --watch`). ts-jest likewise MUST use `tsconfig.spec.json` / `test/tsconfig.spec.json` (same CJS override). Wired via `jest.globals['ts-jest'].tsconfig` and `test/jest-e2e.json` `globals`. All 56 e2e specs use `import request from 'supertest'` (default import, not `import * as`).
- **node_modules patches** (`scripts/patch-node-modules.js`, runs in `postinstall`):
  1. `jest-runtime`: `Module` statics are readonly under bun → `Object.defineProperty` instead of assignment (bun issue #16933).
  2. `depd`: bun's `Error.captureStackTrace` returns strings in jest's vm sandbox → guard `typeof callSite.getFileName !== 'function'`.
  3. `@nestjs/cli` tsconfig-paths hook: under bun, `require.resolve('@/...')` resolves tsconfig aliases (node throws, so the `#838` package short-circuit correctly falls through to the relative-path rewrite). With the short-circuit firing, the emitted `dist/**` keeps raw `@/` requires → bun resolves them back to `src/**` at runtime → duplicate module identities → DI failures (`Nest can't resolve dependencies ... argument Object at index [2]`) and missing routes. Patch: only `return text` when `packagePath` is under `node_modules`.
  4. `@nestjs/swagger`: normalize enum `design:type` under bun.
- If you bump `bun install`/delete `node_modules`, re-apply via `node scripts/patch-node-modules.js`.

## Bun runtime gotchas (server)

- **Native `bun src/main.ts` is the prod runtime** (binds :3000, `/api/system_db` → 200) and the fast dev path (`bun --watch src/main.ts`). The nest-CLI dev loop (`start:dev`) compiles to CJS `dist/` and runs `bun dist/main.js` — this works and boots (all DI + routes resolve) thanks to the tsconfig-paths patch (above), but the initial tsc watch compile is slow under bun (~4–5 min vs ~3 min under node); edit→recompile→restart cycles work (~30–60 s) but `touch` (same-size mtime-only change) is ignored by tsc's watcher on both runtimes. `dist/` is unused in prod/Docker (they run from `src/`).
- **nest CLI runs under bun**: invoke as `bun --bun nest ...` (the `-b/--bun` flag makes the node-shebang CLI run under bun; process title may still show `node`). `nest-cli.json` sets `"exec": "bun"` so `nest start` spawns `bun --enable-source-maps [--inspect=9229] dist/main.js` (bun accepts both flags). `nest g` works: `printf '\n\n\n\n' | bun --bun nest g <schematic> <name> --dry-run`.
- **`design:paramtypes` elision bug**: a value import used only as a constructor param type is elided to `Object` in `design:paramtypes` IF the class has NO class-level decorator but HAS param decorators, AND the imported type sits at an index BEFORE the first decorated param. Position-dependent; `verbatimModuleSyntax` does NOT fix it. **Any DI class with param decorators but no class decorator needs `@Injectable()` (or another class-level decorator)** or Nest fails with `Nest can't resolve dependencies ... argument Object at index [0]`.
- **`mapKeysDeep is not a function` (serialize.interceptor)**: `import * as _ from 'lodash'` + `deepdash` breaks (ESM namespace wrapper is read-only; `mixin` can't attach). `src/utils/deepdash.ts` must use `import _ from 'lodash'` (default interop). Only 2 other files namespace-import lodash (`entries-amount-diff.ts`, `is-blank.ts`) — fine since they only read methods.
- Type-only imports should use `import type` (codemod enforced via eslint `consistent-type-imports`); needed for bun's per-file transpiler to elide types in circular import graphs.
- **Never use token-less `@Inject()`** (empty parens). It makes Nest resolve the param via reflected `design:paramtypes`/`design:type` metadata, which bun's transpiler elides on some versions (1.3.9 elided it → `Nest can't resolve dependencies … (?)` in Docker while local 1.3.14 booted fine). Always pass an explicit token: `@Inject(MyService)`. Docker base images are pinned to `oven/bun:1.3.14-alpine` to match local bun — keep them aligned.

## pdf-templates

- `@bigcapital/pdf-templates` build = `bun build ./src/index.ts --target=node --format=cjs --outfile=dist/components.umd.js && tsc --emitDeclarationOnly`. (Webpack removed.)
- **Runtime uses the BUILT `dist`** (symlink; `main: ./dist/components.umd.js`). Edits to `shared/pdf-templates/src/**` do NOT take effect until `bun run --filter '@bigcapital/pdf-templates' build`, then restart server.
- `module`/`types`/`exports` all point at `./dist/components.umd.js` / `./dist/index.d.ts` (webpack only emitted the UMD; the `.es.js` path never existed).
- Webapp does NOT import pdf-templates (only the server does, via `render*PaperTemplateHtml` / `*PaperTemplate` components).

## Database

- MariaDB 10.2 (EOL; pinned for compatibility)
- Two DB tiers: **system DB** (`bigcapital_system`) + **per-tenant DBs** (`bigcapital_tenant_<orgId>`)
- Migrations via `knex`; always run `system` before `tenant`
- Migration CLI: `bun run system:migrate:latest`, `bun run tenants:migrate:latest` (root scripts → `bun run --filter '@bigcapital/server' cli:system:migrate:latest` etc.)
- No CLI to create + initialize a tenant — only through the web UI setup wizard (signup → `POST /api/organization/build`)
- **Tenant DB table names are UPPERCASE** (`SALES_RECEIPTS`, `PDF_TEMPLATES`, `ACCOUNTS`, ...) with `lower_case_table_names=0` (case-sensitive). The mysql CLI MUST use uppercase table+column names (e.g. `TERMS_CONDITIONS`); the app/knex models query lowercase (internal reconciliation) — inspect columns via the app models, not the raw CLI.
- **`.ts`/`.js` migration-name divergence**: `tenantDatabase.migrationsDir` resolves to `src/**` (`.ts`) under ts-node/CLI but `dist/**` (`.js`) under compiled Docker/org-build. A tenant migrated by prod records `.js` names; a later ts-node `tenants:migrate:latest` fails with "migration directory is corrupt". Reconcile `knex_migrations.name` to whichever extension the current runtime loads. `TenantDBManager.migrate()` (`TenantDBManager.ts:99`) runs WITHOUT `disableMigrationsListValidation`.
- System migrations live as compiled `.js` on disk (`loadExtensions: ['.js']`); `knex_migrations` names must match on-disk extension.

## Env files

- `.env` is gitignored (production secrets)
- `.env.alwathba` is gitignored (Alwathba local secrets)
- `.env.alwathba.example` is the template for the self-hosted stack

## Tenant initialization flow

Signup → tenant record → signin → `/setup` wizard → `POST /api/organization/build` → BullMQ job creates DB, runs system+tenant migrations, seeds data.

## Docker deployment

| Compose file | Uses | Command |
|---|---|---|
| `docker-compose.prod.yml` | Pre-built Docker Hub images | `setup.sh` |
| `docker-compose.alwathba.yml` | Build from source + Cloudflare R2 | `docker compose -f docker-compose.alwathba.yml --env-file .env.alwathba up -d --build` |
| `docker-compose.dokploy.yml` | Image-based, proxy on `dokploy-network`, no host ports | dokploy deploy |

Both `docker-compose.alwathba.yml` and `docker-compose.dokploy.yml` use the bun-based Dockerfiles (`packages/server/Dockerfile`, `packages/webapp/Dockerfile`) and run migrations via `bun src/cli.ts system:migrate:latest && bun src/cli.ts tenants:migrate:latest` (working_dir `/app/packages/server`).

`docker-compose.alwathba.yml` fixes upstream bugs:
- passes `APP_JWT_SECRET` (not `JWT_SECRET`)
- `HOSTED_ON_BIGCAPITAL_CLOUD=false` skips forced subscription
- healthcheck-based `depends_on` instead of `wait-for-it`

CI workflows (`typecheck.yml`, `e2e.yml`, `generate-openapi.yml`) use `oven-sh/setup-bun@v2` (bun 1.3.9) + `bun install --frozen-lockfile`. Docker build/deploy workflows (`build-deploy-*.yml`, `docker-alwathba.yml`) are pnpm-free.

## Known issues / open items

- **`EADDRINUSE` on :3000** is usually the unrelated `brainease_web` docker container (`07c2b1adfd29`) mapping host 3000. `docker stop` it before booting the API locally.
- Ports 3306/6379/80 may be occupied by foreign processes; use `PORT=8081` etc. when booting the API locally.
- `HOSTED_ON_BIGCAPITAL_CLOUD=false` is hardcoded in `docker-compose.alwathba.yml` — should be configurable via `.env.alwathba`.
- `DOKPLOY_DEPLOY_WEBHOOK` GitHub secret not yet set — auto-deploy from CI is skipped (workflow warns) until it is.
- Logo upload 401 was fixed by the `__fetcherConfig` change — rebuild + re-test to confirm.
- Pre-existing typecheck errors in `packages/webapp` (e.g. `CustomersSelect.tsx`, `QuickCreateCustomerDrawer.tsx`) and `shared/sdk-ts` (`snake-case-request-middleware.ts`) exist at HEAD; not regressions from the bun migration.
- Full `docker compose -f docker-compose.alwathba.yml --build` with the bun Dockerfile end-to-end not yet validated (bcrypt + CLI path verified in isolation).
