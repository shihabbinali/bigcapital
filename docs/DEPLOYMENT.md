# Bigcapital — Alwathba self-hosted deployment

Two deployment flavours live in this repo:

| File | Build strategy | Used for |
|---|---|---|
| `docker-compose.alwathba.yml` | Builds server/webapp from the local source tree | Manual deploys on a VPS, local validation |
| `docker-compose.dokploy.yml` | Server/webapp pulled as prebuilt **Docker Hub** images | Dokploy (with auto-updates via CI) |

> Branch: `alwathba-merged` (forked from `develop`)

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

### 3a. Manual VPS deploy (build from source)

```bash
# from the repo root, on branch alwathba-merged
git checkout alwathba-merged

# 1. Create your environment file and edit secrets
cp .env.alwathba.example .env.alwathba
$EDITOR .env.alwathba   # at minimum: APP_JWT_SECRET, DB_PASSWORD, DB_ROOT_PASSWORD, BASE_URL

# 2. Build images from source and start the stack
docker compose -f docker-compose.alwathba.yml --env-file .env.alwathba up -d --build
```

### 3b. Dokploy deploy (prebuilt images) — recommended

Skip straight to [§6 Dokploy](#6-dokploy-deployment) for the full walkthrough.
No source build happens on the server: images come from Docker Hub and are
updated automatically on every push (see [§7 Auto-updates](#7-auto-updates-cicd)).

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

> **Dokploy only:** also set `DOCKERHUB_USER` (your Docker Hub namespace, e.g.
> `shihabbinali`) — `docker-compose.dokploy.yml` resolves the server/webapp
> images as `${DOCKERHUB_USER}/bigcapital-{server,webapp}:alwathba`.

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

## 6. Dokploy deployment

Dokploy is the recommended way to run the Alwathba stack: it manages the
reverse proxy (Traefik), HTTPS certificates, environment variables, deploy
hooks, and (via CI) automatic updates.

How routing works:

```
Browser ──HTTPS──▶ Dokploy Traefik (:80/:443)
                        │  Host(domain) ──▶ proxy (Envoy) :80  ← on dokploy-network
                        ▼
                   proxy splits paths:  /api/*  ──▶ server :3000
                                        /      ──▶ webapp :80
```

### One-time setup

1. **Repo access.** In Dokploy, add the GitHub source:
   - *Recommended:* GitHub App — install it and grant access to
     `shihabbinali/bigcapital`. The repo is private, so a PAT or SSH deploy
     key also works but must be managed manually.

2. **Create the project.** Project → **Docker Compose** → repository
   `shihabbinali/bigcapital`, branch `alwathba-merged`, compose path
   `docker-compose.dokploy.yml`.

3. **Environment variables.** Open the **Environment** tab and paste the
   contents of `.env.alwathba.example` with real values, plus `DOCKERHUB_USER`:

   | Variable | Value |
   |---|---|
   | `APP_JWT_SECRET` | `openssl rand -hex 48` |
   | `DB_PASSWORD`, `DB_ROOT_PASSWORD` | random hex (`openssl rand -hex 16`) |
   | `BASE_URL` | `https://your-domain` |
   | `DOCKERHUB_USER` | your Docker Hub namespace (e.g. `shihabbinali`) |
   | `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT`, `S3_BUCKET` | Cloudflare R2 credentials |

   Dokploy writes these into an env file that is passed to
   `docker compose --env-file`, so every `${VAR}` in the compose file resolves.

4. **Domain.** **Domains** tab → add your domain → service `proxy`, container
   port **80**, HTTPS enabled. Dokploy injects the Traefik labels automatically
   and provisions the Let's Encrypt certificate (needs port 80/443 open and DNS
   pointing at the server first).

   > The `proxy` service is the only one connected to Dokploy's
   > `dokploy-network`; Traefik must never reach `mysql`/`redis` directly.

5. **DNS.** Create an `A` record: `your-domain` → your server's public IP. Wait
   for propagation (`dig +short your-domain`), then click **Deploy**.

6. **First deploy.** Dokploy pulls the images (no source build) and runs the
   compose stack: mysql/redis start, the migration one-shot runs
   system+tenant migrations, then the server comes up healthy. Check the
   project **Logs** for `server` → `healthy` and open `https://your-domain`.

7. **Deploy webhook (for auto-updates).** Project **Settings** → copy the
   **Deploy Hook** URL. Store it as a GitHub Actions secret:

   ```bash
   gh secret set DOKPLOY_DEPLOY_WEBHOOK   # paste the URL
   ```

   Also ensure `DOCKER_USERNAME` and `DOCKER_PASSWORD` (Docker Hub) exist as
   repository secrets.

### Upgrade / rollback

- **Upgrade:** `git push` to `alwathba-merged` — CI does the rest (see §7).
- **Rollback:** the workflow also tags every build as `alwathba-<sha>`.
  Temporarily point the compose image at the previous SHA tag, or run the
  previous workflow run's images via the **Deploy** button.

## 7. Auto-updates (CI/CD)

`.github/workflows/docker-alwathba.yml` implements the update pipeline:

```
git push (alwathba-merged)
   │
   ▼  GitHub Actions
build server image ──┐
                     ├─▶ push to Docker Hub: <user>/bigcapital-server:alwathba
build webapp image ──┘                              <user>/bigcapital-webapp:alwathba
                     (plus immutable :alwathba-<sha> tags)
   │ both succeeded
   ▼
POST https://dokploy.../deploy (secret DOKPLOY_DEPLOY_WEBHOOK)
   │
   ▼  Dokploy
docker compose up -d  →  pulls new images, recreates containers,
                          re-runs the migration one-shot
```

Notes:

- The deploy webhook fires **only after both images are pushed**, so Dokploy
  never pulls a half-updated pair.
- The migration one-shot re-runs on every redeploy (system + tenant
  migrations), so schema changes ship with the code that uses them.
- Secret prerequisites: `DOCKER_USERNAME`, `DOCKER_PASSWORD`
  (Docker Hub), `DOKPLOY_DEPLOY_WEBHOOK` (Dokploy). If the webhook secret is
  missing the workflow still pushes images and only warns.
- Images are built for `linux/amd64` only — fine for standard VPSs.

---

## 8. Known issues & mitigations

### Fixed on this branch
- **JWT secret silently defaulting to `123123`** — upstream `docker-compose.prod.yml` passes `JWT_SECRET`, but the code reads `APP_JWT_SECRET`. This branch passes the correct name.
- **`OPEN_EXCHANGE_RATE_APP_ID` typo** — upstream line uses `-` instead of `=`; fixed here.
- **Start-order races** — `server` now waits for `mysql` (healthy) **and** the `migration` one-shot (`service_completed_successfully`).
- **Gotenberg port confusion** — documented; `GOTENBERG_URL=http://gotenberg:3000`.
- **Forced subscription screen on self-host** — `HOSTED_ON_BIGCAPITAL_CLOUD=false`.

### Avoided by pairing images from the same commit
- **#1155 PDF "No mutationFn found"** — caused by webapp/server image version skew. The CI workflow builds both images from the same commit and only then triggers the redeploy, so they can never diverge.

### Still upstream (tracked, not fixed here)
- **MariaDB 10.2 is EOL** (June 2022). Kept on 10.2 for compatibility. Consider upgrading to 10.11 LTS.
- **#1072 SMTP no-auth relays** — `MailModule` passes an auth object unconditionally. Use an SMTP server that accepts auth, or patch `MailModule`.
- **#1146 Import requires "Branch" field** even when the Branches feature is disabled (closed upstream but watch for regression).

---

## 9. Where things live

| Path | Purpose |
|---|---|
| `docker-compose.alwathba.yml` | Source-build production compose (manual VPS deploys) |
| `docker-compose.dokploy.yml` | Dokploy compose (prebuilt Docker Hub images) |
| `.github/workflows/docker-alwathba.yml` | CI: build images → push to Docker Hub → trigger Dokploy |
| `.env.alwathba.example` | Environment template |
| `packages/server/Dockerfile` | Server image build (multi-stage) |
| `packages/webapp/Dockerfile` | Webapp image build (Vite → nginx) |
| `docker/envoy/envoy.yaml` | Envoy routing config |
| `docker/mariadb/` | MariaDB image + init SQL |
| `docker/redis/` | Redis image + config |
