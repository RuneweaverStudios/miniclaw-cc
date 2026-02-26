################################################################################
# Multi-stage Dockerfile for Miniclaw Worker Service
# This creates an optimized production-ready Docker image for the Worker
################################################################################

# =============================================================================
# Stage 1: Base Image
# =============================================================================
FROM node:20-alpine AS base

# Install build dependencies and common tools
RUN apk add --no-cache \
    ca-certificates \
    tzdata \
    curl \
    dumb-init

# Set working directory
WORKDIR /app

# Set Node.js environment
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=2048" \
    PNPM_VERSION="8.15.0"

# =============================================================================
# Stage 2: Dependencies
# =============================================================================
FROM base AS dependencies

# Install pnpm
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Copy workspace packages
COPY packages/worker/package.json ./packages/worker/
COPY packages/shared/package.json ./packages/shared/
COPY packages/types/package.json ./packages/types/

# Install dependencies
RUN pnpm install --frozen-lockfile --prod=false

# =============================================================================
# Stage 3: Builder
# =============================================================================
FROM dependencies AS builder

# Copy all source code
COPY . .

# Build the shared packages and Worker
RUN pnpm --filter @miniclaw/shared build
RUN pnpm --filter @miniclaw/types build
RUN pnpm --filter @miniclaw/worker build

# =============================================================================
# Stage 4: Production Dependencies
# =============================================================================
FROM base AS production-dependencies

# Install pnpm
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY packages/worker/package.json ./packages/worker/
COPY packages/shared/package.json ./packages/shared/
COPY packages/types/package.json ./packages/types/

# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod

# =============================================================================
# Stage 5: Production Image
# =============================================================================
FROM base AS production

# Install security updates
RUN apk update && apk upgrade --no-cache

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy production dependencies
COPY --from=production-dependencies --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=production-dependencies --chown=nodejs:nodejs /app/packages ./packages
COPY --from=production-dependencies --chown=nodejs:nodejs /app/pnpm-lock.yaml ./

# Copy built assets from builder
COPY --from=builder --chown=nodejs:nodejs /app/packages/worker/dist ./packages/worker/dist
COPY --from=builder --chown=nodejs:nodejs /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=nodejs:nodejs /app/packages/types/dist ./packages/types/dist

# Copy configuration files
COPY --chown=nodejs:nodejs packages/worker/.env.production ./packages/worker/.env.production

# Create log directory
RUN mkdir -p /var/log/miniclaw && \
    chown -R nodejs:nodejs /var/log/miniclaw

# Set environment variables
ENV NODE_ENV=production \
    PORT=9090 \
    HOST=0.0.0.0 \
    LOG_LEVEL=info \
    LOG_FORMAT=json \
    WORKER_CONCURRENCY=5 \
    QUEUE_REDIS_ENABLED=true \
    QUEUE_REDIS_HOST=redis \
    QUEUE_REDIS_PORT=6379

# Expose port (for health checks)
EXPOSE 9090

# Health check - checks if worker process is running
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:9090/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Switch to non-root user
USER nodejs

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "packages/worker/dist/index.js"]

# =============================================================================
# Stage 6: Development Image (Optional)
# =============================================================================
FROM base AS development

# Install development dependencies
RUN apk add --no-cache git

# Install pnpm
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (including dev)
RUN pnpm install

# Copy source code
COPY . .

# Build shared packages
RUN pnpm --filter @miniclaw/shared build
RUN pnpm --filter @miniclaw/types build

# Expose port
EXPOSE 9090

# Set environment
ENV NODE_ENV=development \
    PORT=9090 \
    HOST=0.0.0.0

# Start development server
CMD ["pnpm", "--filter", "@miniclaw/worker", "dev"]

# =============================================================================
# Stage 7: Testing Image (Optional)
# =============================================================================
FROM base AS test

# Install test dependencies
RUN apk add --no-cache git

# Install pnpm
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install all dependencies
RUN pnpm install

# Copy source code
COPY . .

# Build shared packages
RUN pnpm --filter @miniclaw/shared build
RUN pnpm --filter @miniclaw/types build

# Set environment
ENV NODE_ENV=test

# Run tests
CMD ["pnpm", "--filter", "@miniclaw/worker", "test"]

# =============================================================================
# Stage 8: Worker with Redis Sidecar (for development)
# =============================================================================
FROM base AS worker-with-redis

# Install Redis for local development
RUN apk add --no-cache redis

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy production artifacts
COPY --from=production --chown=nodejs:nodejs /app /app

# Copy Redis startup script
COPY --chown=nodejs:nodejs infrastructure/docker/start-worker-with-redis.sh /usr/local/bin/

RUN chmod +x /usr/local/bin/start-worker-with-redis.sh

# Set environment
ENV NODE_ENV=development \
    PORT=9090 \
    HOST=0.0.0.0 \
    QUEUE_REDIS_HOST=localhost \
    QUEUE_REDIS_PORT=6379

EXPOSE 9090 6379

USER nodejs

ENTRYPOINT ["dumb-init", "--"]
CMD ["start-worker-with-redis.sh"]
