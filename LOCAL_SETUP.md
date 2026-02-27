# MiniClaw-CC Local Development Setup

## Quick Start

### 1. Start Services (Docker - Recommended)

```bash
# Start Redis and PostgreSQL in Docker
docker run -d --name miniclaw-redis -p 6379:6379 redis:alpine
docker run -d --name miniclaw-postgres -p 5432:5432 \
  -e POSTGRES_USER=miniclaw \
  -e POSTGRES_PASSWORD=miniclaw \
  -e POSTGRES_DB=miniclaw_dev \
  postgres:16-alpine
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Set Up Database

```bash
# Push database schema
pnpm --filter @miniclaw/api db:push
```

### 4. Start Services

```bash
# Terminal 1: API Server
cd apps/api
cp ../../.env.local .env
pnpm dev

# Terminal 2: Worker
cd apps/worker
cp ../../.env.local .env
pnpm dev

# Terminal 3: Web Dashboard
cd apps/web
cp ../../.env.local .env
pnpm dev
```

### 5. Access the App

- **Dashboard**: http://localhost:3000
- **API**: http://localhost:4000
- **Health Check**: http://localhost:4000/health

## Manual Service Setup (Alternative)

### Start Redis with Homebrew

```bash
brew install redis
brew services start redis
```

### Start PostgreSQL with Homebrew

```bash
brew install postgresql@16
brew services start postgresql@16

# Create database
psql postgres -c "CREATE USER miniclaw WITH PASSWORD 'miniclaw';"
psql postgres -c "CREATE DATABASE miniclaw_dev OWNER miniclaw;"
```

## Testing User Flow

### 1. Sign Up

```bash
# Test signup API
curl -X POST http://localhost:4000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpass123",
    "name": "Test User",
    "stack": "openclaw"
  }'
```

### 2. Check Pool Status

```bash
curl http://localhost:4000/api/pool/status
```

### 3. Allocate Server (after signup)

```bash
curl -X POST http://localhost:4000/api/servers/allocate \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "stack": "openclaw"
  }'
```

## Troubleshooting

### Redis Connection Error

```bash
# Check if Redis is running
redis-cli ping

# Should return: PONG
```

### PostgreSQL Connection Error

```bash
# Check if PostgreSQL is running
psql -U miniclaw -d miniclaw_dev -c "SELECT 1;"

# Should return: ?column?
#                1
```

### Port Already in Use

```bash
# Check what's using port 4000
lsof -i :4000

# Kill the process
kill -9 <PID>
```

## Clean Up

```bash
# Stop Docker services
docker stop miniclaw-redis miniclaw-postgres
docker rm miniclaw-redis miniclaw-postgres
```

## Environment Variables

Copy `.env.local` to each app directory:

```bash
cp .env.local apps/api/.env
cp .env.local apps/worker/.env
cp .env.local apps/web/.env
```
