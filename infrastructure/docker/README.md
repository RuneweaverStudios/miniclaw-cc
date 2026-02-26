# Miniclaw Docker Images

This directory contains Dockerfile configurations for building Miniclaw service images.

## Available Images

### API Service (`api.Dockerfile`)

Multi-stage build for the API service built with Hono.js.

**Features:**
- Production-optimized Node.js 20 Alpine image
- Multi-stage build for minimal image size
- Security-focused non-root user
- Built-in health checks
- Support for development and testing stages

**Build Stages:**
1. `base` - Base image with dependencies
2. `dependencies` - Install all dependencies
3. `builder` - Build TypeScript code
4. `production-dependencies` - Install production deps only
5. `production` - Final production image
6. `development` - Development image with hot-reload
7. `test` - Testing image with test dependencies

**Build Command:**
```bash
docker build -f infrastructure/docker/api.Dockerfile -t miniclaw-api:latest .
```

**Build for Production:**
```bash
docker build -f infrastructure/docker/api.Dockerfile --target production -t miniclaw-api:prod .
```

**Build for Development:**
```bash
docker build -f infrastructure/docker/api.Dockerfile --target development -t miniclaw-api:dev .
```

**Run Container:**
```bash
docker run -p 8080:8080 \
  -e NODE_ENV=production \
  -e DATABASE_URL=postgresql://... \
  miniclaw-api:latest
```

**Run with Docker Compose:**
```bash
docker-compose up api
```

### Worker Service (`worker.Dockerfile`)

Multi-stage build for the background worker service.

**Features:**
- Production-optimized Node.js 20 Alpine image
- Multi-stage build for minimal image size
- Built-in Redis support for job queues
- Health check endpoints
- Multiple stages for dev/test/prod
- Optional local Redis sidecar for development

**Build Stages:**
1. `base` - Base image with dependencies
2. `dependencies` - Install all dependencies
3. `builder` - Build TypeScript code
4. `production-dependencies` - Install production deps only
5. `production` - Final production image
6. `development` - Development image
7. `test` - Testing image
8. `worker-with-redis` - Development image with local Redis

**Build Command:**
```bash
docker build -f infrastructure/docker/worker.Dockerfile -t miniclaw-worker:latest .
```

**Build for Production:**
```bash
docker build -f infrastructure/docker/worker.Dockerfile --target production -t miniclaw-worker:prod .
```

**Build with Local Redis (Development):**
```bash
docker build -f infrastructure/docker/worker.Dockerfile --target worker-with-redis -t miniclaw-worker:dev-redis .
```

**Run Container:**
```bash
docker run -p 9090:9090 \
  -e NODE_ENV=production \
  -e QUEUE_REDIS_HOST=redis \
  -e QUEUE_REDIS_PORT=6379 \
  miniclaw-worker:latest
```

## Environment Variables

### API Service

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Environment | `production` | No |
| `PORT` | Server port | `8080` | No |
| `HOST` | Server host | `0.0.0.0` | No |
| `LOG_LEVEL` | Logging level | `info` | No |
| `LOG_FORMAT` | Log format | `json` | No |
| `DATABASE_URL` | PostgreSQL connection | - | Yes |
| `REDIS_URL` | Redis connection | - | Yes |
| `JWT_SECRET` | JWT signing secret | - | Yes |
| `ENCRYPTION_KEY` | Data encryption key | - | Yes |

### Worker Service

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Environment | `production` | No |
| `PORT` | Health check port | `9090` | No |
| `HOST` | Server host | `0.0.0.0` | No |
| `LOG_LEVEL` | Logging level | `info` | No |
| `LOG_FORMAT` | Log format | `json` | No |
| `WORKER_CONCURRENCY` | Number of concurrent jobs | `5` | No |
| `QUEUE_REDIS_ENABLED` | Enable Redis queue | `true` | No |
| `QUEUE_REDIS_HOST` | Redis host | `redis` | Yes |
| `QUEUE_REDIS_PORT` | Redis port | `6379` | No |
| `DATABASE_URL` | PostgreSQL connection | - | Yes |

## Health Checks

Both services expose health check endpoints:

### API Health Check
```bash
curl http://localhost:8080/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00Z",
  "uptime": 3600,
  "memory": {
    "used": 123456789,
    "total": 2147483648
  }
}
```

### Worker Health Check
```bash
curl http://localhost:9090/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00Z",
  "jobs_processed": 1234,
  "jobs_failed": 5,
  "queue_size": 42
}
```

## Docker Compose

Example `docker-compose.yml`:

```yaml
version: '3.8'

services:
  api:
    build:
      context: ..
      dockerfile: infrastructure/docker/api.Dockerfile
      target: production
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:8080/health')"]
      interval: 30s
      timeout: 10s
      retries: 3

  worker:
    build:
      context: ..
      dockerfile: infrastructure/docker/worker.Dockerfile
      target: production
    ports:
      - "9090:9090"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - QUEUE_REDIS_HOST=redis
      - QUEUE_REDIS_PORT=6379
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:9090/health')"]
      interval: 30s
      timeout: 10s
      retries: 3

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=miniclaw
      - POSTGRES_USER=miniclaw
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

## Security Best Practices

1. **Use Non-Root User**: All images use a non-root user (nodejs)
2. **Minimal Base Image**: Using Alpine Linux for smaller attack surface
3. **Security Scans**: Run `docker scan` before deployment
4. **Secret Management**: Use environment variables or secret management
5. **Read-Only Root**: Consider adding `read_only: true` in compose
6. **Resource Limits**: Set CPU and memory limits

Example resource limits:
```yaml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

## Optimization

### Image Size Optimization

Current approximate sizes:
- API Production: ~200MB
- Worker Production: ~200MB

To further reduce size:
- Use `.dockerignore` to exclude unnecessary files
- Combine `RUN` commands to reduce layers
- Use multi-stage builds
- Remove development dependencies in production

### Build Cache

Leverage Docker build cache:
1. Copy `package.json` and install dependencies first
2. Copy source code afterwards
3. Changes to source code won't reinstall dependencies

### BuildKit Features

Enable BuildKit for better performance:
```bash
DOCKER_BUILDKIT=1 docker build -f infrastructure/docker/api.Dockerfile -t miniclaw-api:latest .
```

## Testing

### Test API Image
```bash
docker build -f infrastructure/docker/api.Dockerfile --target test -t miniclaw-api:test .
docker run --rm miniclaw-api:test
```

### Test Worker Image
```bash
docker build -f infrastructure/docker/worker.Dockerfile --target test -t miniclaw-worker:test .
docker run --rm miniclaw-worker:test
```

## Deployment

### Push to Container Registry

```bash
# Login to registry
docker login ghcr.io

# Tag images
docker tag miniclaw-api:latest ghcr.io/your-org/miniclaw-api:latest
docker tag miniclaw-worker:latest ghcr.io/your-org/miniclaw-worker:latest

# Push images
docker push ghcr.io/your-org/miniclaw-api:latest
docker push ghcr.io/your-org/miniclaw-worker:latest
```

### Deploy to Kubernetes

Example deployment manifests are available in `infrastructure/kubernetes/`.

## Troubleshooting

### Build Issues

**Out of Memory During Build:**
```bash
docker build --memory=4g -f infrastructure/docker/api.Dockerfile .
```

**Dependency Installation Failures:**
```bash
# Clear Docker build cache
docker builder prune -a
```

### Runtime Issues

**Container Crashes Immediately:**
```bash
# Check logs
docker logs miniclaw-api

# Run with shell access
docker run -it --entrypoint sh miniclaw-api:latest
```

**Health Check Failures:**
```bash
# Test health endpoint manually
docker run -p 8080:8080 miniclaw-api:latest
curl http://localhost:8080/health
```

## Maintenance

### Update Dependencies

1. Update `package.json` in the respective package
2. Rebuild Docker images
3. Test thoroughly before deploying

### Version Tagging

```bash
docker build -f infrastructure/docker/api.Dockerfile -t miniclaw-api:1.0.0 .
docker tag miniclaw-api:1.0.0 miniclaw-api:latest
```

### Cleanup

```bash
# Remove old images
docker image prune -a

# Remove build cache
docker builder prune -a

# Remove unused volumes
docker volume prune
```
