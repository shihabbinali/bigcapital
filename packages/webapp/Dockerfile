# Stage 1: Build
# Debian base (glibc + modern bun build) to match local dev and the server image.
FROM oven/bun:1.3.14 AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 build-essential && \
    rm -rf /var/lib/apt/lists/*

ENV PYTHON=/usr/bin/python3

# Copy package files for dependency installation
COPY package.json bun.lock bunfig.toml ./
COPY packages/webapp/package.json ./packages/webapp/
COPY packages/server/package.json ./packages/server/
COPY shared ./shared
COPY scripts ./scripts

# Install all dependencies (including devDependencies for build)
RUN bun install --frozen-lockfile

# Copy source code for webapp and dependencies
COPY ./packages/webapp ./packages/webapp

# Build the shared workspace packages the webapp imports at runtime
RUN bun run --filter '@bigcapital/utils' build

# Build webapp package
RUN bun run --filter '@bigcapital/webapp' build

# Stage 2: Nginx
FROM nginx:alpine

# Copy nginx configuration
COPY ./packages/webapp/nginx/sites/default.conf /etc/nginx/conf.d/default.conf

# Copy built webapp assets from builder stage
COPY --from=builder /app/packages/webapp/dist /usr/share/nginx/html

# Expose port
EXPOSE 80

# Nginx runs as nginx user by default, which is good for security
# No CMD needed as nginx base image already has it
