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
| `docker-compose.alwathba.yml` | Build from source + MinIO | `docker compose -f docker-compose.alwathba.yml --env-file .env.alwathba up -d --build` |

`docker-compose.alwathba.yml` fixes upstream bugs:
- passes `APP_JWT_SECRET` (not `JWT_SECRET`)
- `HOSTED_ON_BIGCAPITAL_CLOUD=false` skips forced subscription
- healthcheck-based `depends_on` instead of `wait-for-it`
- MinIO local S3 with auto bucket creation via `minio-init-bucket`

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
- Added MinIO service + `minio-init-bucket` to `docker-compose.alwathba.yml`; wired S3 vars in `.env.alwathba`.
- Fixed MySQL healthcheck to interpolate `DB_ROOT_PASSWORD` correctly.
- Fixed `uploadAttachment` in `shared/sdk-ts/src/attachments.ts` to use `postFormData` (generated client `JSON.stringify`s FormData to `"{}"`).
- Fixed `createApiFetcher` / `getFetcherConfig` in `shared/sdk-ts/src/fetch-utils.ts` to store/read `__fetcherConfig` (openapi-typescript-fetch stores config in closures, not properties).

### Open
- Logo upload returns 401 even when authenticated. Root cause: `postFormData` couldn't read fetcher's auth headers before the `__fetcherConfig` fix. Need to rebuild webapp image and test.
- `HOSTED_ON_BIGCAPITAL_CLOUD=false` is hardcoded in `docker-compose.alwathba.yml` — should be configurable via `.env.alwathba`.
