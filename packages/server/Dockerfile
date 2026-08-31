# Stage 1: Builder — full install + build shared workspace packages.
# The server itself runs natively via `bun src/main.ts` (no tsc/nest compile).
#
# Debian (NOT alpine) base so the bun binary matches local dev exactly
# (glibc + modern CPU build). The alpine tag ships the baseline build, whose
# 1.3.14 decorator emission regresses @nestjs/swagger property decorators
# (legacy decorators get invoked with an undefined target).
FROM oven/bun:1.3.14 AS builder

WORKDIR /app

# Install build dependencies (python3 for bcrypt/gyp native modules during install)
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 build-essential && \
    rm -rf /var/lib/apt/lists/*

ENV PYTHON=/usr/bin/python3

# Copy workspace manifests + lockfile
COPY package.json bun.lock bunfig.toml ./
COPY packages/server/package.json ./packages/server/
COPY packages/webapp/package.json ./packages/webapp/
COPY shared ./shared
COPY scripts ./scripts

# Full install (includes devDependencies so the shared packages can be built)
RUN bun install --frozen-lockfile

# Re-apply bun-compatibility patches explicitly (the root postinstall runs
# `node scripts/...` and these images ship no node binary).
RUN bun scripts/patch-node-modules.js

# Copy source code
COPY ./packages/server ./packages/server

# Build the shared workspace packages that the server imports at runtime.
# (Their package.json `main` points into `dist/`.)
RUN bun run --filter '@bigcapital/utils' --filter '@bigcapital/sdk-ts' --filter '@bigcapital/pdf-templates' --filter '@bigcapital/email-components' build

# Stage 2: Production dependencies (installed on bun/debian so native modules
# like bcrypt compile against the glibc toolchain, matching the runtime)
FROM oven/bun:1.3.14 AS deps

WORKDIR /app

# Create non-root user
RUN groupadd --gid 1001 nodejs && \
    useradd --uid 1001 --gid nodejs --shell /usr/sbin/nologin nodejs

# Install build dependencies for native modules (bcrypt, etc.)
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 build-essential && \
    rm -rf /var/lib/apt/lists/*

ENV PYTHON=/usr/bin/python3

# Copy package files for production dependency installation
COPY package.json bun.lock bunfig.toml ./
COPY packages/server/package.json ./packages/server/
COPY packages/webapp/package.json ./packages/webapp/
COPY shared ./shared
COPY scripts ./scripts

# Install only production dependencies for the server + the shared workspace
# packages it depends on (webapp is deliberately excluded — it has its own image).
RUN bun install --production --filter '@bigcapital/server' \
    --filter '@bigcapital/utils' --filter '@bigcapital/sdk-ts' \
    --filter '@bigcapital/pdf-templates' --filter '@bigcapital/email-components' \
    --frozen-lockfile

# Re-apply bun-compatibility patches to the production tree. Dev-only packages
# (jest-runtime, @nestjs/cli) are absent here — the script skips those; the
# @nestjs/swagger enum design:type patch applies.
RUN bun scripts/patch-node-modules.js

# Stage 3: Runtime (bun, runs server natively from src/)
FROM oven/bun:1.3.14 AS runtime

WORKDIR /app

# Create non-root user
RUN groupadd --gid 1001 nodejs && \
    useradd --uid 1001 --gid nodejs --shell /usr/sbin/nologin nodejs

# Copy production dependencies from the deps stage (workspace symlinks intact)
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=nodejs:nodejs /app/packages/server/node_modules ./packages/server/node_modules
COPY --from=deps --chown=nodejs:nodejs /app/package.json ./package.json
COPY --from=deps --chown=nodejs:nodejs /app/bunfig.toml ./bunfig.toml

# Copy all shared packages (prod node_modules) from the deps stage
COPY --from=deps --chown=nodejs:nodejs /app/shared ./shared

# Overlay the built dist for each shared package from the builder stage
COPY --from=builder --chown=nodejs:nodejs /app/shared/bigcapital-utils/dist ./shared/bigcapital-utils/dist
COPY --from=builder --chown=nodejs:nodejs /app/shared/sdk-ts/dist ./shared/sdk-ts/dist
COPY --from=builder --chown=nodejs:nodejs /app/shared/pdf-templates/dist ./shared/pdf-templates/dist
COPY --from=builder --chown=nodejs:nodejs /app/shared/email-components/dist ./shared/email-components/dist

# Copy server source (run natively via bun), package.json and tsconfig
COPY --from=builder --chown=nodejs:nodejs /app/packages/server/src ./packages/server/src
COPY --from=builder --chown=nodejs:nodejs /app/packages/server/package.json ./packages/server/package.json
COPY --from=builder --chown=nodejs:nodejs /app/packages/server/tsconfig.json ./packages/server/tsconfig.json

# Copy static assets (public, static directories)
COPY --from=builder --chown=nodejs:nodejs /app/packages/server/public ./packages/server/public
COPY --from=builder --chown=nodejs:nodejs /app/packages/server/static ./packages/server/static

# Belt-and-braces: bun 1.3.14 resolves TS compiler options (decorators) from
# the process cwd when no nearer tsconfig applies — without this file at /app
# the server transpiles with TC39 defaults and crashes in @nestjs/swagger
# decorators (legacy decorators invoked with an undefined target).
COPY --from=builder --chown=nodejs:nodejs /app/packages/server/tsconfig.json /app/tsconfig.json

# Run exactly like local dev (`cd packages/server && bun src/main.ts`) so the
# nearest tsconfig.json (experimentalDecorators) governs the transpile.
WORKDIR /app/packages/server

# Set runtime environment variables
ENV NODE_ENV=production
ENV NEW_RELIC_NO_CONFIG_FILE=true
ENV PORT=3000

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check - uses /api/system_db ping endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD bun -e "require('http').get('http://localhost:3000/api/system_db', (r) => {process.exit(r.statusCode >= 200 && r.statusCode < 300 ? 0 : 1)}).on('error', () => process.exit(1))"

# Start the application (natively, no compiled dist)
CMD [ "bun", "src/main.ts" ]
