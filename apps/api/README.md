# MiniClaw-CC API

Hono.js backend API for the MiniClaw-CC VPS provisioning service.

## Overview

The API handles:
- User authentication (OAuth, email/password)
- Server allocation from standby pool
- Pool management and monitoring
- Server configuration (Telegram, models)
- OpenRouter key management (per-droplet)
- Billing integration (Stripe)

## Quick Start

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
pnpm db:push

# Start development server
pnpm dev
```

## Available Scripts

### Development
```bash
pnpm dev              # Start development server (with hot reload)
pnpm build            # Build TypeScript
pnpm start            # Start production server
```

### Database
```bash
pnpm db:generate      # Generate migrations
pnpm db:migrate       # Run migrations
pnpm db:push          # Push schema changes
pnpm db:studio        # Open Drizzle Studio
```

### Pool Management
```bash
pnpm pool:check       # Check pool status
pnpm pool:refill      # Refill pool with existing droplets
pnpm test:onboarding  # Run E2E onboarding test
```

### Maintenance
```bash
pnpm pool:deallocate <id>       # Deallocate a server
pnpm pool:clear-allocations     # Clear all allocations
pnpm pool:prepare              # Clear all test data
```

## API Routes

### Authentication

#### `POST /api/auth/signup`
Create a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe",
  "stack": "nanobot"
}
```

**Response:**
```json
{
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "name": "John Doe",
    "plan": "free",
    "status": "active"
  },
  "token": "jwt-token-here"
}
```

#### `POST /api/auth/signin`
Sign in with email/password.

#### `POST /api/auth/sync`
Sync user from OAuth provider (Supabase).

**Request:**
```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "avatar": "https://avatar-url",
  "provider": "google",
  "providerId": "google-subject-id"
}
```

#### `GET /api/auth`
Get current user from JWT token.

**Header:** `Authorization: Bearer <token>`

### Pool Management

#### `GET /api/pool/status`
Get current pool status.

**Response:**
```json
{
  "total": 10,
  "byStack": {
    "nanobot": 5,
    "openclaw": 5
  },
  "byState": {
    "standby": 9,
    "allocated": 1
  },
  "byHealth": {
    "healthy": 10,
    "degraded": 0,
    "unhealthy": 0
  },
  "allocatable": 9
}
```

#### `POST /api/pool/replenish`
Trigger pool replenishment (admin only).

### Server Allocation

#### `POST /api/servers/allocate`
Allocate a server from the standby pool.

**Request:**
```json
{
  "framework": "nanobot",
  "model": "minimax/minimax-m2.5",
  "channel": "telegram"
}
```

**Response:**
```json
{
  "dropletId": 555084292,
  "name": "pool-nanobot-nyc1-12345",
  "ipAddress": "137.184.57.147",
  "status": "provisioning",
  "sshCommand": "ssh root@137.184.57.147"
}
```

#### `GET /api/servers/:id/status`
Check server provisioning status.

#### `POST /api/servers/:id/configure-telegram`
Configure Telegram bot on allocated server.

**Request:**
```json
{
  "botToken": "123456:ABC-DEF1234ghikl..."
}
```

**Response:**
```json
{
  "success": true,
  "botInfo": {
    "id": 123456789,
    "username": "MyBot",
    "firstName": "My Bot"
  },
  "directLink": "https://t.me/MyBot"
}
```

#### `GET /api/servers/:id/configure-telegram/stream`
SSE stream for real-time configuration progress.

### Billing

#### `POST /api/billing/create-checkout`
Create Stripe checkout session.

#### `POST /api/billing/webhook`
Handle Stripe webhooks.

## Services

### Pool Manager (`src/services/pool-manager.ts`)

Manages the server pool state in Redis.

```typescript
// Get servers by state
const standbyServers = await poolManager.getServers('standby');

// Get specific server
const server = await poolManager.getServer(dropletId);

// Add server to pool
await poolManager.addServer(serverConfig);

// Update server state
await poolManager.updateServerState(dropletId, 'allocated', 'healthy');

// Remove server from pool
await poolManager.removeServer(dropletId);
```

### Allocator (`src/services/allocator.ts`)

Handles server allocation with distributed locking.

```typescript
// Allocate server to user
const result = await allocator.allocate({
  userId: 'user-id',
  stack: 'nanobot',
  model: 'minimax/minimax-m2.5',
  region: 'nyc1'
});

// Release allocation
await allocator.releaseAllocation(userId, dropletId);
```

### Provisioner (`src/services/provisioner.ts`)

Creates new DigitalOcean droplets.

```typescript
const droplet = await provisionDroplet({
  stack: 'nanobot',
  region: 'nyc1',
  size: 's-1vcpu-1gb',
  version: '0.1.3.post7'
});
```

### Health Checker (`src/services/health-check.ts`)

Performs health checks on pool servers.

```typescript
const result = await healthChecker.checkServer(server);
// Returns: { healthy: true, status: 'healthy', details: {...} }
```

### Nanobot Service (`src/services/nanobot.ts`)

Manages Nanobot installation and configuration.

```typescript
// Install Nanobot
await nanobotService.install({
  ipAddress: '1.2.3.4',
  version: '0.1.3.post7'
});

// Verify installation
const status = await nanobotService.verify('1.2.3.4');

// Test gateway
await nanobotService.testGateway('1.2.3.4');
```

### OpenRouter Service (`src/services/openrouter.ts`)

Manages per-droplet OpenRouter API keys.

```typescript
// Create key for droplet
const key = await openrouterService.createDropletKey(dropletId);
// Returns: "or-mini-555084292-d6e3c6c4..."

// Get droplet key
const key = await openrouterService.getDropletKey(dropletId);

// Get usage stats
const usage = await openrouterService.getDropletUsage(dropletId);
// Returns: { limitCents: 2500, usageCents: 125, percentage: 5 }

// Revoke key
await openrouterService.revokeDropletKey(dropletId);

// Add credit
await openrouterService.addCredit(dropletId, 2500); // $25

// Reset usage (monthly)
await openrouterService.resetUsage(dropletId);
```

### Server Cleanup (`src/services/server-cleanup.ts`)

Cleans user configuration on deallocation.

```typescript
await clearServerConfiguration(server, onProgress);
// Removes:
// - Telegram bot tokens
// - Gateway processes
// - Sensitive log files
```

## Workers

### Replenisher (`src/workers/replenisher.ts`)

Maintains pool size by provisioning new servers.

```typescript
import { replenisher } from './workers/replenisher.js';

replenisher.start({
  interval: 300000,        // Check every 5 minutes
  targetSize: 10,          // Target pool size
  nanobotRatio: 0.5        // 50% Nanobot, 50% OpenClaw
});
```

### Health Monitor (`src/workers/health-monitor.ts`)

Performs periodic health checks on all servers.

```typescript
import { healthMonitor } from './workers/health-monitor.js';

healthMonitor.start({
  interval: 60000,         // Check every minute
  unhealthyThreshold: 3    // Mark as unhealthy after 3 failures
});
```

### Reclaimer (`src/workers/reclaimer.ts`)

Reclaims servers from expired allocations.

```typescript
import { reclaimer } from './workers/reclaimer.js';

reclaimer.start({
  interval: 300000,        // Check every 5 minutes
  trialDuration: 7 * 24 * 60 * 60 * 1000,  // 7 days
  idleTimeout: 24 * 60 * 60 * 1000         // 24 hours
});

// Force reclaim specific server
await reclaimer.forceReclaim(dropletId, 'idle_timeout');

// Get servers approaching expiry
const expiring = await reclaimer.getExpiringServers(86400000); // Within 24h
```

## Database Schema

### Tables

#### `users`
User accounts and authentication.

```typescript
{
  id: string;           // UUID
  email: string;        // Unique
  passwordHash: string; // Bcrypt hash
  name: string;
  plan: string;         // free, basic, pro, enterprise
  planStatus: string;   // trial, active, past_due, cancelled
  status: string;       // active, suspended, deleted
  avatar?: string;
  provider?: string;    // google, github
  providerId?: string;
  emailVerified: boolean;
  createdAt: Date;
  lastLoginAt: Date;
}
```

#### `user_servers`
User server allocations.

```typescript
{
  id: string;              // UUID
  userId: string;          // Foreign key to users
  dropletId: number;       // DigitalOcean droplet ID
  hostname: string;        // Droplet name
  fqdn: string;            // Fully qualified domain
  stack: string;           // nanobot, openclaw
  stackVersion: string;
  region: string;
  size: string;
  ipAddress: string;
  sshPort: number;
  status: string;          // active, suspended, deleted
  allocatedAt: Date;
  healthStatus: string;
  model?: string;          // Selected AI model
  config: {
    telegram?: {
      botToken: string;
      botInfo: object;
      configuredAt: string;
      dropletConfigured: boolean;
    };
    openrouterKey?: string; // Per-droplet key
    model?: string;
    monitoringEnabled: boolean;
    alertsEnabled: boolean;
    backupEnabled: boolean;
  };
}
```

## Redis Keys

### Pool State
```
pool:servers              # Hash of all servers
pool:server:{dropletId}   # Individual server data
pool:health:{dropletId}   # Health check results
```

### Allocations
```
pool:allocations           # Set of allocated droplet IDs
pool:allocation:{userId}:{dropletId}  # Allocation metadata
```

### OpenRouter Keys
```
openrouter:keys           # Hash of all droplet keys
openrouter:droplet:{dropletId}  # Map droplet → key
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection | ✅ |
| `REDIS_HOST` | Redis host | ✅ |
| `REDIS_PORT` | Redis port | - |
| `JWT_SECRET` | JWT signing secret | ✅ |
| `DIGITALOCEAN_TOKEN` | DO API token | ✅ |
| `OPENROUTER_API_KEY` | Master OpenRouter key | ✅ |
| `SSH_PRIVATE_KEY` | SSH private key | ✅ |
| `SSH_PRIVATE_KEY_PATH` | Path to SSH key | ✅ |
| `STRIPE_SECRET_KEY` | Stripe secret | - |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret | - |

## Testing

### Run Tests
```bash
# E2E test (provisions real droplets)
pnpm test:onboarding

# Test existing pool servers
pnpm test:onboarding -- --skip-provision

# Test multiple servers
pnpm test:onboarding -- --count 3

# Test specific stack
pnpm test:onboarding -- --type nanobot
```

### Manual Testing with curl

```bash
# Check pool status
curl http://localhost:4000/api/pool/status

# Sign up new user
curl -X POST http://localhost:4000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Allocate server (requires auth token)
curl -X POST http://localhost:4000/api/servers/allocate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"framework":"nanobot","model":"minimax/minimax-m2.5","channel":"telegram"}'
```

## Deployment

### Build
```bash
pnpm build
```

### Production Start
```bash
NODE_ENV=production pnpm start
```

### Docker
```bash
docker build -t miniclaw-api .
docker run -p 4000:4000 --env-file .env miniclaw-api
```

## Monitoring

### Health Endpoint
```bash
curl http://localhost:4000/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-02-28T22:00:00.000Z",
  "services": {
    "api": "healthy",
    "redis": "healthy"
  },
  "uptime": 3600
}
```

### Metrics (Prometheus)
```
# Pool metrics
miniclaw_pool_size_total
miniclaw_pool_size_by_state{state="standby"}
miniclaw_pool_size_by_health{health="healthy"}

# Allocation metrics
miniclaw_allocations_total
miniclaw_allocation_duration_seconds

# Health check metrics
miniclaw_health_check_duration_seconds
miniclaw_health_check_failures_total
```

## Troubleshooting

### API not starting
```bash
# Check database connection
pnpm db:push

# Check Redis
redis-cli ping

# Check environment variables
cat .env
```

### Pool not refilling
```bash
# Check pool status
pnpm pool:check

# Check DO token
echo $DIGITALOCEAN_TOKEN

# Manual refill
pnpm pool:refill -- --use-existing
```

### Allocation failing
```bash
# Check pool has standby servers
pnpm pool:check

# Check allocator logs
# Look for: "No available servers in pool"

# Run E2E test to verify provisioning
pnpm test:onboarding -- --count 1
```

## See Also

- [Main README](../../README.md)
- [Scripts Reference](./README-SCRIPTS.md)
- [Plan Document](./.claude/plans/lexical-sprouting-cake.md)
