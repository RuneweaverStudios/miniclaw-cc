# MiniClaw API Production Dockerfile for Render
FROM node:22-alpine AS base

# Install build dependencies
RUN apk add --no-cache \
    openssl \
    openssh-client \
    curl \
    bash \
    git \
    python3 \
    make \
    g++

# Set working directory
WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm@latest

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy package.json files for all workspace packages
COPY packages/shared/package.json ./packages/shared/
COPY packages/config/package.json ./packages/config/
COPY apps/api/package.json ./apps/api/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/shared ./packages/shared
COPY packages/config ./packages/config
COPY apps/api ./apps/api

# Build shared package
RUN pnpm --filter @miniclaw/shared build

# Set production environment
ENV NODE_ENV=production
ENV PORT=4000

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

# Start the application
WORKDIR /app/apps/api
CMD ["sh", "-c", "npx tsx src/index.ts"]
