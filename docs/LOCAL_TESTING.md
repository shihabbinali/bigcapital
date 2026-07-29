# Local testing guide (Alwathba)

Use this guide to validate `docker-compose.alwathba.yml` on your development
machine before deploying to production. Every service builds from local source,
so bugs can be caught early.

## Prerequisites

- Docker + Docker Compose v2+
- Port 80 free (or set `PUBLIC_PROXY_PORT` in `.env.alwathba`)
- `openssl` (for generating secrets)

## 1. Create environment file

```bash
cp .env.alwathba.example .env.alwathba
```

Generate real secrets for the three mandatory values:

```bash
# Replace the placeholder values in .env.alwathba
APP_JWT_SECRET=$(openssl rand -hex 48)
DB_PASSWORD=$(openssl rand -hex 16)
DB_ROOT_PASSWORD=$(openssl rand -hex 16)
```

Edit `.env.alwathba` and set at minimum:

| Variable | Notes |
|---|---|
| `APP_JWT_SECRET` | long random hex |
| `DB_PASSWORD` | database user password |
| `DB_ROOT_PASSWORD` | MariaDB root password |
| `BASE_URL` | `http://localhost` for local testing |

## 2. Build all images

First build is slow (~10–15 min) — it compiles the entire NestJS server and
React webapp from source inside Docker.

```bash
docker compose -f docker-compose.alwathba.yml --env-file .env.alwathba build
```

Use `--progress=plain` to see full build output if something fails:

```bash
docker compose -f docker-compose.alwathba.yml --env-file .env.alwathba build --progress=plain
```

## 3. Start the stack

Watch live logs (Ctrl+C to stop, services keep running if started with `-d`):

```bash
docker compose -f docker-compose.alwathba.yml --env-file .env.alwathba up
```

Or run detached:

```bash
docker compose -f docker-compose.alwathba.yml --env-file .env.alwathba up -d
docker compose logs -f
```

## 4. Verification checklist

Once everything is up, confirm each layer of the dependency chain:

| Step | What to check | Command |
|---|---|---|
| **MariaDB healthy** | `mysqladmin ping` succeeds | `docker compose ps mysql` → `healthy` |
| **Redis healthy** | `redis-cli ping` succeeds | `docker compose ps redis` → `healthy` |
| **Migrations run** | system + tenant migrations complete with exit code 0 | `docker compose logs migration` |
| **Server starts** | Server listens on port 3000 | `docker compose logs server` |
| **Server healthy** | Healthcheck endpoint returns 200 | `docker compose ps server` → `healthy` |
| **API reachable** | Proxy routes `/api/*` to server | `curl -s http://localhost/api/system_db` |
| **Webapp serves** | Nginx returns HTML for `/` | `curl -s http://localhost/ \| head -c 200` |
| **Gotenberg** | No connection errors in server logs | `docker compose logs server \| grep -i gotenberg` |

## 5. Common issues & fixes

### Build fails

- Check that `pnpm-lock.yaml` exists and is up-to-date with `package.json` files.
- If a native module fails (e.g. `bcrypt`), the Dockerfile installs `python3`
  and `build-base` in both build stages — verify `apk add` succeeds.
- Run build with `--progress=plain` to surface the exact error.

### Migration container exits with code 1

The migration runs:

```
node dist/cli.js system:migrate:latest && node dist/cli.js tenants:migrate:latest
```

Possible causes:

- `dist/cli.js` not compiled — check `pnpm run build:server` output.
- Database connection refused — verify `DB_HOST=mysql` (Docker DNS) and that
  `mysql` service is healthy.
- Migration files not copied into the image — check the `COPY` line in
  `packages/server/Dockerfile` for `src/database`.

### Server healthcheck never turns green

The server Dockerfile healthcheck hits `http://localhost:3000/api/system_db`.
If the server doesn't expose that route:

- Confirm the route exists in `packages/server/src/`.
- Check server logs for startup errors before the healthcheck begins (40s
  `start_period`).

### Webapp returns 502 from proxy

The proxy depends on `server` being healthy first. Check:

```
docker compose ps server    # must show "healthy"
```

If the server is healthy but the webapp returns 502, the envoy config at
`docker/envoy/envoy.yaml` may have the wrong cluster name or port.

### Port conflict on :80

Stop whatever is using port 80, or change the port:

```bash
# In .env.alwathba
PUBLIC_PROXY_PORT=8080
```

Then access the app at `http://localhost:8080`.

## 6. Iterating during development

Rebuild and restart a single service after a code change:

```bash
docker compose -f docker-compose.alwathba.yml --env-file .env.alwathba up -d --build server
```

Only `server` and `webapp` need rebuilding (they use local source). The
`migration` service also uses the `bigcapital-server:local` image, so rebuild
the `server` service first to update the image.

## 7. Reset everything

Stop all services and delete volumes (wipes databases):

```bash
docker compose -f docker-compose.alwathba.yml --env-file .env.alwathba down -v
```

Next `up` will run migrations fresh.
