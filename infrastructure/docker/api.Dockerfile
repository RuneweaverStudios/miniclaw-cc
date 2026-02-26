################################################################################
# Multi-stage Dockerfile for Miniclaw API Service
# This creates an optimized production-ready Docker image for the API
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
COPY packages/api/package.json ./packages/api/
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

# Build the shared packages and API
RUN pnpm --filter @miniclaw/shared build
RUN pnpm --filter @miniclaw/types build
RUN pnpm --filter @miniclaw/api build

# =============================================================================
# Stage 4: Production Dependencies
# =============================================================================
FROM base AS production-dependencies

# Install pnpm
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY packages/api/package.json ./packages/api/
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
COPY --from=builder --chown=nodejs:nodejs /app/packages/api/dist ./packages/api/dist
COPY --from=builder --chown=nodejs:nodejs /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=nodejs:nodejs /app/packages/types/dist ./packages/types/dist

# Copy configuration files
COPY --chown=nodejs:nodejs packages/api/.env.production ./packages/api/.env.production

# Create log directory
RUN mkdir -p /var/log/miniclaw && \
    chown -R nodejs:nodejs /var/log/miniclaw

# Set environment variables
ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0 \
    LOG_LEVEL=info \
    LOG_FORMAT=json

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Switch to non-root user
USER nodejs

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "packages/api/dist/index.js"]

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
EXPOSE 8080

# Set environment
ENV NODE_ENV=development \
    PORT=8080 \
    HOST=0.0.0.0

# Start development server
CMD ["pnpm", "--filter", "@miniclaw/api", "dev"]

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
CMD ["pnpm", "--filter", "@miniclaw/api", "test"]
