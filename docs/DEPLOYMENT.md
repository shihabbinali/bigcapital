# Bigcapital — Alwathba self-hosted deployment

This guide deploys Bigcapital **from local source** (no Docker Hub images for the
server/webapp/migration) using `docker-compose.alwathba.yml`. Everything is built
on the host from the checked-out source tree, so the frontend and backend always
match the exact commit you are on.

> Branch: `alwathba` (forked from `develop`)

---

## 1. Architecture

```
                 ┌──────────────┐
   user ──HTTP──▶│   Envoy      │  :80  (HTTP only — terminate TLS in front)
                 │  proxy       │
                 └──────┬───────┘
            /api/* ─────┼──────── /  (everything else)
                        │
              ┌─────────▼──────────┐    ┌──────────────┐
              │  server (NestJS)   │◀──▶│  redis       │
              │  bigcapital-server │    │  cache+queue │
              │  :local (source)   │    └──────────────┘
              └────────┬───────────┘
                       │         ┌──────────────┐
                       ├────────▶│  gotenberg:7 │  PDF/Office → :3000
                       │         └──────────────┘
                       │         ┌──────────────┐
                       └────────▶│  mariadb 10.2│
                                 └──────────────┘

   webapp (Vite/React, nginx) ── bigcapital-webapp:local (source)
   migration (one-shot)       ── reuses bigcapital-server:local
```

- **server** — NestJS API. Built from `packages/server/Dockerfile`. Image tagged `bigcapital-server:local`.
- **webapp** — Vite/React SPA served by nginx. Built from `packages/webapp/Dockerfile`. The SPA calls same-origin `/api`, so it is environment-agnostic (no build-time API URL needed).
- **migration** — one-shot that reuses the **same** `bigcapital-server:local` image and runs `system:migrate:latest` + `tenants:migrate:latest`, then exits. No separate image, no Docker Hub dependency.
- **mysql** — MariaDB 10.2 (kept on the upstream version for compatibility; note 10.2 is EOL — see *Known issues*).
- **redis** — cache + BullMQ job queues.
- **gotenberg** — PDF/Office rendering. The `gotenberg/gotenberg:7` image listens on **port 3000** internally; `GOTENBERG_URL=http://gotenberg:3000`.
- **proxy** — Envoy. Routes `/api/*` → `server:3000` and everything else → `webapp:80`. HTTP only.

---

## 2. Prerequisites

- Docker Engine + Docker Compose v2 (`docker compose version`)
- ~4 GB RAM available for the build (Chromium/pnpm/webpack)
- Ports `80` (or `PUBLIC_PROXY_PORT`) available on the host

---

## 3. First-time deploy

```bash
# from the repo root, on branch alwathba
git checkout alwathba

# 1. Create your environment file and edit secrets
cp .env.alwathba.example .env.alwathba
$EDITOR .env.alwathba   # at minimum: APP_JWT_SECRET, DB_PASSWORD, DB_ROOT_PASSWORD, BASE_URL

# 2. Build images from source and start the stack
docker compose -f docker-compose.alwathba.yml --env-file .env.alwathba up -d --build
```

Startup order is enforced by healthchecks + `depends_on` conditions:

```
mysql (healthy) ──▶ migration (runs, exits 0) ──▶ server (healthy) ──▶ proxy
redis (healthy) ──▶ server
```

Watch the migration one-shot complete:

```bash
docker compose -f docker-compose.alwathba.yml logs -f migration
```

Once `server` reports healthy, open the app at `http://<host>:<PUBLIC_PROXY_PORT>`.

---

## 4. Environment reference

Full template: `.env.alwathba.example`. Critical variables:

| Variable | Why it matters |
|---|---|
| **`APP_JWT_SECRET`** | The server reads **`APP_JWT_SECRET`**, not `JWT_SECRET` (see `packages/server/src/common/config/jwt.ts`). Generate with `openssl rand -hex 48`. The compose uses `${APP_JWT_SECRET:?}` — the stack **will not start** if this is empty (no silent fallback to `123123`). |
| `BASE_URL` | Public URL (no trailing slash) used in emails/links. |
| `DB_PASSWORD`, `DB_ROOT_PASSWORD` | Change from defaults. |
| `SYSTEM_DB_NAME` | Defaults to `bigcapital_system`. |
| `TENANT_DB_NAME_PERFIX` | Prefix for per-tenant databases (note: the upstream key is spelled `PERFIX`). |
| `HOSTED_ON_BIGCAPITAL_CLOUD` | Hard-coded `false` in the compose file to disable the forced subscription screen (upstream #1071). |

Redis is unauthenticated on the internal Docker bridge network (clients don't wire the
password field). Redis is **not** exposed to the host.

Optional integrations (all default off/empty): Plaid, Stripe, Lemon Squeezy, S3, New Relic, Open Exchange Rates, SMTP. Fill only what you use.

---

## 5. Operational commands

```bash
# Rebuild after pulling source changes
docker compose -f docker-compose.alwathba.yml --env-file .env.alwathba up -d --build

# Tail logs
docker compose -f docker-compose.alwathba.yml logs -f server

# Stop everything (data volumes kept)
docker compose -f docker-compose.alwathba.yml down

# Stop AND wipe data (destructive)
docker compose -f docker-compose.alwathba.yml down -v

# Run migrations manually against a running stack
docker compose -f docker-compose.alwathba.yml --env-file .env.alwathba run --rm \
  migration sh -c 'node dist/cli.js system:migrate:latest && node dist/cli.js tenants:migrate:latest'
```

---

## 6. HTTPS / reverse proxy (incl. Dokploy)

Envoy is HTTP-only in this stack. Terminate TLS in front of it.

The compose binds Envoy to `127.0.0.1:${PUBLIC_PROXY_PORT}` by default (no external
network access). When running standalone without a front proxy, update the binding to
`'${PUBLIC_PROXY_PORT:-80}:80'` (or remove the `127.0.0.1` prefix).

**Generic (Traefik / Caddy / Nginx):**
- Publish Envoy on a loopback or internal port: `PUBLIC_PROXY_PORT=8080`
- Point your proxy at `http://<host>:8080`
- Forward `Host` and pass through websockets; allow large request bodies for imports/uploads

**Dokploy:**
1. In Dokploy, create an Application pointing at this repo/branch.
2. Set the build/preset to **Docker Compose** with compose file `docker-compose.alwathba.yml` and env file `.env.alwathba`.
3. Set `PUBLIC_PROXY_PORT` to a port Traefik can reach (Dokploy routes via Traefik).
4. Add your domain in Dokploy; Dokploy/Traefik provisions the Let's Encrypt certificate and terminates TLS.
5. Set `BASE_URL=https://your-domain` so email links and PDF callbacks use HTTPS.

When behind an external TLS proxy, ensure the proxy:
- preserves the original `Host` header
- forwards `X-Forwarded-Proto` (so the app sees HTTPS)
- does **not** strip `Authorization` (auth on import/export endpoints — relevant to upstream #1155)
- allows large multipart bodies (imports / attachments)

---

## 7. Known issues & mitigations

### Fixed on this branch
- **JWT secret silently defaulting to `123123`** — upstream `docker-compose.prod.yml` passes `JWT_SECRET`, but the code reads `APP_JWT_SECRET`. This branch passes the correct name.
- **`OPEN_EXCHANGE_RATE_APP_ID` typo** — upstream line uses `-` instead of `=`; fixed here.
- **Start-order races** — `server` now waits for `mysql` (healthy) **and** the `migration` one-shot (`service_completed_successfully`).
- **Gotenberg port confusion** — documented; `GOTENBERG_URL=http://gotenberg:3000`.
- **Forced subscription screen on self-host** — `HOSTED_ON_BIGCAPITAL_CLOUD=false`.

### Avoided by building from source
- **#1155 PDF "No mutationFn found"** — caused by webapp/server image version skew on Docker Hub. Building both from the same commit removes the skew.

### Still upstream (tracked, not fixed here)
- **MariaDB 10.2 is EOL** (June 2022). Kept on 10.2 for compatibility. Consider upgrading to 10.11 LTS.
- **#1072 SMTP no-auth relays** — `MailModule` passes an auth object unconditionally. Use an SMTP server that accepts auth, or patch `MailModule`.
- **#1146 Import requires "Branch" field** even when the Branches feature is disabled (closed upstream but watch for regression).

---

## 8. Where things live

| Path | Purpose |
|---|---|
| `docker-compose.alwathba.yml` | Source-build production compose (this branch) |
| `.env.alwathba.example` | Environment template |
| `packages/server/Dockerfile` | Server image build (multi-stage) |
| `packages/webapp/Dockerfile` | Webapp image build (Vite → nginx) |
| `docker/envoy/envoy.yaml` | Envoy routing config |
| `docker/mariadb/` | MariaDB image + init SQL |
| `docker/redis/` | Redis image + config |
