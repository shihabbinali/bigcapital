# Bigcapital — Alwathba project memory

Auto-loaded context for this fork of Bigcapital. Read this first when working on
the `alwathba` branch.

## What this fork is

A self-hosted deployment of [Bigcapital](https://github.com/bigcapitalhq/bigcapital)
(accounting/finance software) that **builds every image from local source** with a
corrected, production-ready Docker Compose. Forked from `develop` onto `alwathba`.

Primary deliverables on this branch:
- `docker-compose.alwathba.yml` — source-build production stack (replaces Docker Hub image pulls)
- `.env.alwathba.example` — corrected env template
- `docs/DEPLOYMENT.md` — full deployment + Dokploy guide
- This memory file

## Monorepo layout

pnpm workspaces + Lerna. Node 18.16 (`.nvmrc`), pnpm 9.0.5.

- `packages/server` — NestJS API (Knex/Objection, MariaDB, Redis/BullMQ, Gotenberg). Build: `nest build` → `dist`. Entry: `dist/main.js`, CLI: `dist/cli.js`.
- `packages/webapp` — Vite + React 18 SPA, served by nginx. Calls same-origin `/api` (no build-time API URL).
- `shared/bigcapital-utils` (`@bigcapital/utils`), `shared/pdf-templates`, `shared/email-components`, `shared/sdk-ts` — shared packages built with tsup/webpack/vite.

Build order matters: shared packages build **before** server/webapp. The lerna scripts encode this:
- `pnpm build:server` → server + utils + pdf-templates + email-components
- `pnpm build:webapp` → webapp + utils + pdf-templates + sdk-ts

## Critical environment-variable facts (gotchas)

- **JWT secret is `APP_JWT_SECRET`, NOT `JWT_SECRET`.** See `packages/server/src/common/config/jwt.ts`. Falls back to hard-coded `123123` if unset — upstream `docker-compose.prod.yml` passes the wrong name, silently leaving the default in production. The Alwathba compose passes `APP_JWT_SECRET`.
- **`OPEN_EXCHANGE_RATE_APP_ID`** — upstream prod compose has `-` instead of `=` (never set). Fixed here.
- **`HOSTED_ON_BIGCAPITAL_CLOUD=false`** required for self-host (else forced subscription screen — upstream #1071).
- **Gotenberg** listens on port **3000** internally (`gotenberg/gotenberg:7`); `GOTENBERG_URL=http://gotenberg:3000`. Upstream compose `expose: '9000'` is misleading/cosmetic.
- **`TENANT_DB_NAME_PERFIX`** — note the upstream spelling "PERFIX" (not PREFIX). Keep it.
- DB config fallbacks: `SYSTEM_DB_*` → `DB_*`, `TENANT_DB_*` → `DB_*`. Port: `DB_PORT` default 3306.

## Deployment (Alwathba stack)

```bash
cp .env.alwathba.example .env.alwathba   # edit secrets (APP_JWT_SECRET, DB passwords, BASE_URL)
docker compose -f docker-compose.alwathba.yml --env-file .env.alwathba up -d --build
```

Enforced ordering: `mysql` (healthy) + `redis` (healthy) → `migration` (runs `system:migrate:latest` + `tenants:migrate:latest`, exits 0) → `server` (healthy) → `proxy`.

Images built & tagged locally:
- `bigcapital-server:local` (server + reused by migration one-shot)
- `bigcapital-webapp:local`

Envoy is HTTP-only. TLS terminates in an external proxy (Traefik/Caddy/Nginx/Dokploy). See `docs/DEPLOYMENT.md`.

Validate compose without starting:
```bash
docker compose -f docker-compose.alwathba.yml --env-file .env.alwathba config
```
Note: `--env-file` isn't always needed for validation — the `:?}` syntax on `APP_JWT_SECRET`
will error during `config` if the var is absent; use `APP_JWT_SECRET=dummy` to lint the
structure alone.

## Hardening applied on this branch (beyond the upstream fixes)

- **JWT secret fail-fast:** `APP_JWT_SECRET=${APP_JWT_SECRET:?}` — the compose itself
  errors at startup if the env var is empty or absent (instead of silently falling back
  to the default `123123` in code).
- **Redis password removed from compose:** The NestJS Redis clients don't wire the
  password field, so exposing `REDIS_PASSWORD` was a footgun. Redis is unauthenticated
  but isolated on the Docker bridge network. A future code change to all three Redis
  configs (cache, queue, throttle) can restore this.
- **Proxy bound to loopback:** `127.0.0.1:${PUBLIC_PROXY_PORT:-80}:80` — prevents
  direct plaintext HTTP exposure when running behind an external TLS proxy.
- **`.env.alwathba` added to `.gitignore`** — prevents accidental secret commits.

## Known issues

**Fixed on this branch:** see "Critical environment-variable facts" above + startup race (healthchecks + `service_completed_successfully`). Additional hardening: JWT fail-fast (`:?}`), Redis password removed (not wired in NestJS clients), proxy bound to loopback, `.env.alwathba` gitignored.

**Avoided by building from source:** upstream #1155 (webapp/server image version skew → PDF "No mutationFn found").

**Still upstream (tracked):**
- MariaDB 10.2 is **EOL**. Kept for compatibility; candidate for 10.11 LTS upgrade.
- #1072 — `MailModule` passes auth unconditionally (breaks no-auth SMTP relays).
- #1146 — import requires "Branch" field even when feature disabled.
- #1118 — cash flow "beginning of period" always $0.

## Testing / quality commands

This repo has no unified test runner at root for the deploy artifacts. Use:
- `docker compose ... config` to lint the compose file (done in CI for this branch).
- `docker compose ... build` to validate the source builds end-to-end.
- Server unit tests: `pnpm --filter @bigcapital/server test`.

## Conventions

- Do **not** modify upstream files (`docker-compose.prod.yml`, `packages/*/Dockerfile`, `docker/migration/Dockerfile`) on this branch unless unavoidable — add new files to keep merges from `develop` clean.
- New deployment artifacts use the `alwathba` suffix (`docker-compose.alwathba.yml`, `.env.alwathba.example`) and `docs/DEPLOYMENT.md`.
- The webapp image's nginx config lives at `packages/webapp/nginx/sites/default.conf` (already correct — `/api` is handled by Envoy, webapp serves the SPA).
