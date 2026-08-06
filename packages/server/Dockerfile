# Stage 1: Builder — full install + build shared workspace packages.
# The server itself runs natively via `bun src/main.ts` (no tsc/nest compile).
FROM oven/bun:1.3.9-alpine AS builder

WORKDIR /app

# Install build dependencies (python3 for bcrypt/gyp native modules during install)
RUN apk add --no-cache python3 build-base

ENV PYTHON=/usr/bin/python3

# Copy workspace manifests + lockfile
COPY package.json bun.lock bunfig.toml ./
COPY packages/server/package.json ./packages/server/
COPY packages/webapp/package.json ./packages/webapp/
COPY shared ./shared
COPY scripts ./scripts

# Full install (includes devDependencies so the shared packages can be built)
RUN bun install --frozen-lockfile

# Copy source code
COPY ./packages/server ./packages/server

# Build the shared workspace packages that the server imports at runtime.
# (Their package.json `main` points into `dist/`.)
RUN bun run --filter '@bigcapital/utils' --filter '@bigcapital/sdk-ts' --filter '@bigcapital/pdf-templates' --filter '@bigcapital/email-components' build

# Stage 2: Production dependencies (installed on bun/alpine so native modules
# like bcrypt compile against the musl toolchain, matching the runtime)
FROM oven/bun:1.3.9-alpine AS deps

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Install build dependencies for native modules (bcrypt, etc.)
RUN apk add --no-cache python3 build-base

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

# Remove build dependencies to reduce image size
RUN apk del python3 build-base

# Stage 3: Runtime (bun, runs server natively from src/)
FROM oven/bun:1.3.9-alpine AS runtime

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

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
CMD [ "bun", "packages/server/src/main.ts" ]
