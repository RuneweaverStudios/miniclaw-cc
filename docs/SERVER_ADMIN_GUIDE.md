# MiniClaw-CC Server Admin Guide

Complete guide for managing MiniClaw-CC VPS provisioning service, pool management, and troubleshooting.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Environment Setup](#environment-setup)
3. [Pool Management Scripts](#pool-management-scripts)
4. [User Onboarding Flow](#user-onboarding-flow)
5. [Daily Operations](#daily-operations)
6. [Testing Scenarios](#testing-scenarios)
7. [Production Operations](#production-operations)
8. [Troubleshooting](#troubleshooting)
9. [Quick Reference](#quick-reference)

---

## Architecture Overview

### Component Diagram

```
User Web UI → API Gateway → Allocator → Pool Manager → Redis Pool
                                      ↓
                              PostgreSQL (users, allocations)
                                      ↓
                        Health Monitor (SSH checks)
                                      ↓
                        Sync Worker (DO → Redis every 5min)
```

### Key Components

| Component | Purpose | Location |
|-----------|---------|----------|
| Redis Pool | Stores server state, allocations | `pool:servers` hash |
| PostgreSQL | User accounts, server records, billing | `user_servers`, `users` tables |
| Pool Manager | CRUD operations on pool state | `src/services/pool-manager.ts` |
| Allocator | Assigns servers from pool to users | `src/services/allocator.ts` |
| Health Monitor | Checks server health via SSH | `src/services/health-check.ts` |
| Sync Worker | Keeps Redis in sync with DigitalOcean | `src/workers/sync-pool.ts` |
| Nanobot Service | Installs/tests Nanobot on droplets | `src/services/nanobot.ts` |

### Pool Server States

```
provisioning → testing → standby → allocated
                        ↓
                    (reclaim to standby)
```

### Health Status Values

- `healthy` - Server ready for allocation
- `unhealthy` - Server has issues, don't allocate
- `pending` - New server, awaiting health check
- `unknown` - Status not yet determined

---

## Environment Setup

### Required Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/miniclaw

# Redis
REDIS_URL=redis://localhost:6379

# DigitalOcean
DIGITALOCEAN_TOKEN=your_do_api_token
DIGITALOCEAN_SSH_KEY_ID=your_ssh_key_fingerprint

# SSH (for droplet management)
SSH_PRIVATE_KEY="-----BEGIN OPENSSH PRIVATE KEY-----..."
SSH_PRIVATE_KEY_PATH=/path/to/key

# OpenRouter (for droplet API keys)
OPENROUTER_API_KEY=your_openrouter_key

# App
NODE_ENV=production
JWT_SECRET=your_jwt_secret
```

### Verify Setup

```bash
# Check Redis connection
redis-cli ping
# Should return: PONG

# Check database connection
cd apps/api
pnpm tsx -e "import {getDb} from './src/lib/db/index.js'; getDb().then(() => console.log('DB OK'))"

# Check DO API
curl -H "Authorization: Bearer $DIGITALOCEAN_TOKEN" \
  https://api.digitalocean.com/v2/droplets?per_page=1
```

---

## Pool Management Scripts

### Script Locations

All scripts are in `/apps/api/` directory:

**Scripts:**
- `prepare-for-prod.ts` - Clear ALL data for prod
- `clear-all-allocations.ts` - Clear allocations only
- `clean-resync-pool.ts` - Rebuild pool from DO
- `provision-nanobots.ts` - Create new droplets
- `complete-nanobots.ts` - Install & test droplets
- `destroy-excess-openclaws.ts` - Remove extra droplets

**Workers:**
- `src/workers/sync-pool.ts` - Sync DO → Redis
- `src/workers/sync-scheduler.ts` - Run sync every 5min

**Services:**
- `src/services/pool-manager.ts` - Pool CRUD
- `src/services/allocator.ts` - Server allocation
- `src/services/nanobot.ts` - Nanobot installation

---

### 1. View Current Pool State

```bash
cd apps/api

pnpm tsx -e "
import { poolManager } from './src/services/pool-manager.js';

(async () => {
  const servers = await poolManager.getServers();

  console.log('Total servers:', servers.length);

  const byStack = {};
  const byState = {};
  const byHealth = {};

  servers.forEach(s => {
    byStack[s.stack] = (byStack[s.stack] || 0) + 1;
    byState[s.state] = (byState[s.state] || 0) + 1;
    byHealth[s.healthStatus] = (byHealth[s.healthStatus] || 0) + 1;
  });

  console.log('By Stack:', JSON.stringify(byStack));
  console.log('By State:', JSON.stringify(byState));
  console.log('By Health:', JSON.stringify(byHealth));

  console.log('\\nSERVERS:');
  servers.forEach(s => {
    console.log(\`  \${s.dropletId} | \${s.stack} | \${s.state} | \${s.healthStatus} | \${s.ipAddress}\`);
  });
})();
"
```

---

### 2. Clear All Data (Production Reset)

**WARNING:** This deletes ALL users, allocations, and resets pool.

```bash
cd apps/api
pnpm tsx prepare-for-prod.ts
```

**Use cases:**
- Fresh production deployment
- Complete reset after testing
- Data migration preparation

---

### 3. Clear Allocations Only (Keep Users)

```bash
cd apps/api
pnpm tsx clear-all-allocations.ts
```

**Use cases:**
- Reclaim all allocated servers
- Testing allocation flow repeatedly
- Pool maintenance

---

### 4. Resync Pool from DigitalOcean

```bash
cd apps/api
pnpm tsx clean-resync-pool.ts
```

**Use cases:**
- Pool has duplicate/incorrect entries
- After manual DO operations
- Pool shows wrong server count

---

### 5. Provision New Droplets

```bash
cd apps/api
pnpm tsx provision-nanobots.ts
```

**Creates:** 4 new droplets with cloud-init (installs Nanobot automatically)

**Droplet specs:**
- Region: nyc1
- Size: s-1vcpu-1gb ($6/mo)
- Image: ubuntu-22-04-x64
- Tags: nanobot, pool

---

### 6. Complete Droplet Setup

```bash
cd apps/api
pnpm tsx complete-nanobots.ts
```

**What it does:**
1. Waits for droplets to get public IPs
2. Waits for Nanobot installation (cloud-init)
3. Verifies Nanobot is installed via SSH
4. Adds verified droplets to pool as standby/healthy

**Time required:** 5-10 minutes per droplet

---

### 7. Destroy Excess Droplets

```bash
cd apps/api
# Edit EXCESS_OPENCLAWS array in destroy-excess-openclaws.ts first
pnpm tsx destroy-excess-openclaws.ts
```

---

### 8. Run Pool Sync Manually

```bash
cd apps/api
pnpm tsx src/workers/sync-pool.ts
```

**What it does:**
1. Fetches all droplets from DO
2. Adds new droplets
3. Updates changed droplets
4. Removes deleted droplets
5. Runs health checks
6. Alerts on low standby count

---

### 9. Start Auto-Sync Scheduler

```bash
cd apps/api
pnpm tsx src/workers/sync-scheduler.ts
```

Runs pool sync automatically every 5 minutes. Stop with Ctrl+C.

---

## User Onboarding Flow

### Complete Flow

1. **Landing** - User selects model, framework
2. **Auth** - OAuth (Google/GitHub) or Email OTP
3. **Checkout** - Select plan, Stripe payment
4. **Allocate** - Server assigned from pool (API)
5. **Deploy Wizard** - Shows allocation progress
6. **Configure Telegram** - Bot token, model config
7. **Ready** - User can chat with bot

### API Endpoint Flow

**Checkout Success:**

```http
POST /api/billing/checkout-success
{
  "plan": "nanobot",
  "framework": "nanobot",
  "model": "minimax/minimax-m2.5",
  "channel": "telegram"
}
```

**Code Flow:**

```typescript
// billing.ts calls allocator
const allocation = await allocator.allocate({
  stack: selectedFramework,
  region: 'nyc1',
  userId: user.userId,
  model: selectedModel,  // NEW: Now includes model!
});

// allocator.ts
1. Find available server (standby + healthy)
2. Mark as allocated
3. Record in database
4. Create OpenRouter key
5. Return server details
```

**Configure Telegram:**

```http
POST /api/servers/:id/configure-telegram
{
  "botToken": "123456:ABC-DEF..."
}
```

**Code Flow:**

```typescript
// Get model from database (stored during allocation)
const model = server.model || server.config.model;

// SSH and configure
await configureNanobot(ssh, botToken, model);

// nanobot.ts creates config
{
  providers: {
    openrouter: { apiKey: dropletKey },
    default_provider: 'openrouter',
    model: model  // User's selected model!
  },
  channels: {
    telegram: { botToken: botToken }
  }
}
```

---

## Daily Operations

### Morning Checklist

```bash
# 1. Check pool health
cd apps/api
pnpm tsx -e "
import { poolManager } from './src/services/pool-manager.js';
poolManager.getServers().then(servers => {
  const healthy = servers.filter(s =>
    s.state === 'standby' && s.healthStatus === 'healthy'
  ).length;
  console.log(\`Healthy standby: \${healthy}/10\`);
  if (healthy < 4) console.log('⚠️  LOW POOL');
});
"

# 2. Check active allocations
redis-cli hlen allocations

# 3. Check API errors
tail -100 /tmp/miniclaw-api.log | grep -i error
```

---

### Evening Checklist

```bash
# 1. Run pool sync
pnpm tsx src/workers/sync-pool.ts

# 2. Check for orphaned servers
redis-cli keys "allocation:expiry:*" | wc -l

# 3. Verify droplet count (should be exactly 10)
curl -s -H "Authorization: Bearer $DIGITALOCEAN_TOKEN" \
  https://api.digitalocean.com/v2/droplets | jq '.droplets | length'
```

---

## Testing Scenarios

### Scenario 1: Fresh Test Allocation

```bash
# 1. Clear all test data
pnpm tsx clear-all-allocations.ts

# 2. Verify pool ready (should show 10 standby/healthy)
# (Use pool state check from above)

# 3. Test signup via web UI
# Go to http://localhost:3000
# Complete full flow

# 4. Verify allocation in database
psql -d miniclaw -c "SELECT * FROM user_servers ORDER BY allocated_at DESC LIMIT 1;"
```

---

### Scenario 2: Pool Exhaustion Test

```bash
# 1. Allocate all servers (complete signup 10x)

# 2. Attempt 11th signup
# Should show: "No servers available"

# 3. Replenish pool
pnpm tsx provision-nanobots.ts
pnpm tsx complete-nanobots.ts

# 4. Verify signup works again
```

---

### Scenario 3: Failed Health Check

```bash
# 1. Mark server as unhealthy
pnpm tsx -e "
import { poolManager } from './src/services/pool-manager.js';
poolManager.updateServerState(555009454, 'standby', 'unhealthy');
"

# 2. Attempt allocation
# Should skip unhealthy server

# 3. Recover server
ssh root@159.223.177.99 "systemctl restart nanobot"

# 4. Re-test and mark healthy
pnpm tsx -e "
import { poolManager } from './src/services/pool-manager.js';
poolManager.updateServerState(555009454, 'standby', 'healthy');
"
```

---

## Production Operations

### Deploy to Production

```bash
# 1. Clear test data
pnpm tsx prepare-for-prod.ts

# 2. Build production pool (10 droplets)
# - Provision 5 Nanobot + 5 OpenClaw
# - Run complete-nanobots.ts after each batch

# 3. Verify pool
# Should show: 10 total, all standby/healthy

# 4. Start services
pm2 start ecosystem.config.cjs

# 5. Start sync scheduler
pm2 start tsx --name "sync-scheduler" -- src/workers/sync-scheduler.ts
```

---

### Scaling Pool Up

**When:** Standby count < 4

```bash
# 1. Check current state
# (Use pool state check from above)

# 2. Provision what's needed
pnpm tsx provision-nanobots.ts

# 3. Wait for completion (5-10 min)
pnpm tsx complete-nanobots.ts

# 4. Verify added
```

---

### Scaling Pool Down

**When:** Too many idle servers

```bash
# 1. Identify excess
# Use pool state check to see which droplets to remove

# 2. Destroy via DO API or script
# (Edit destroy script with excess droplet IDs)

# 3. Verify pool count back to 10
```

---

## Troubleshooting

### Problem: "No servers available"

**Diagnose:**
```bash
# Check available servers
pnpm tsx -e "
import { poolManager } from './src/services/pool-manager.js';
poolManager.getServers().then(servers => {
  const available = servers.filter(s =>
    s.state === 'standby' && s.healthStatus === 'healthy'
  );
  console.log('Available:', available.length);
});
"
```

**Solutions:**
- Pool empty → Scale up
- All unhealthy → Fix health checks
- Wrong state → Resync pool

---

### Problem: Server Shows "unknown" Health

**Fix:**
```bash
# 1. Check SSH
ssh root@{IP_ADDRESS} "echo 'SSH OK'"

# 2. Check Nanobot installed
ssh root@{IP_ADDRESS} "which nanobot"

# 3. If installed, update status
pnpm tsx -e "
import { poolManager } from './src/services/pool-manager.js';
poolManager.updateServerState({dropletId}, 'standby', 'healthy');
"

# 4. If not installed, run completion
pnpm tsx complete-nanobots.ts
```

---

### Problem: Telegram Bot Not Responding

**Diagnose:**
```bash
# 1. Verify bot token
curl https://api.telegram.org/bot{TOKEN}/getMe

# 2. Check Nanobot logs
ssh root@{IP_ADDRESS} "journalctl -u nanobot -n 50"

# 3. Check config
ssh root@{IP_ADDRESS} "cat /root/.nanobot/config.json"

# 4. Verify model is set
ssh root@{IP_ADDRESS} "cat /root/.nanobot/config.json | grep model"
```

---

## Quick Reference

### Redis Commands

```bash
# View pool
redis-cli hgetall pool:servers

# Count servers
redis-cli hlen pool:servers

# Get specific server
redis-cli hget pool:servers {dropletId}

# View allocations
redis-cli hgetall allocations

# Clear allocations
redis-cli del allocations
```

### Database Queries

```bash
psql -d miniclaw

# Active allocations
SELECT droplet_id, stack, allocated_at
FROM user_servers
WHERE status = 'active'
ORDER BY allocated_at DESC;

# Stuck servers (>24h in provisioning)
SELECT droplet_id, allocated_at, NOW() - allocated_at as age
FROM user_servers
WHERE status = 'provisioning'
AND NOW() - allocated_at > INTERVAL '24 hours';

# Servers per user
SELECT user_id, COUNT(*) as server_count
FROM user_servers
GROUP BY user_id;
```

### DO API Commands

```bash
# List all droplets
curl -H "Authorization: Bearer $DIGITALOCEAN_TOKEN" \
  https://api.digitalocean.com/v2/droplets | jq '.droplets[] | {id, name, status}'

# Destroy droplet
curl -X DELETE -H "Authorization: Bearer $DIGITALOCEAN_TOKEN" \
  https://api.digitalocean.com/v2/droplets/{ID}
```

### Health Check Commands

```bash
# SSH check
ssh -o ConnectTimeout=5 root@{IP} "echo OK"

# Nanobot check
ssh root@{IP} "systemctl status nanobot"

# Port check
nc -zv {IP} 22  # SSH
nc -zv {IP} 80  # HTTP
```

---

## Best Practices

### Pool Management

1. **Always keep 8-10 healthy standby servers**
2. **Run sync every 5 minutes** (use scheduler)
3. **Monitor health continuously**
4. **Test allocations weekly**
5. **Scale proactively** - don't wait for exhaustion

### Cost Optimization

1. **Target pool size: 10 droplets** (~$60/mo)
2. **Destroy excess immediately**
3. **Reclaim unused allocated servers**
4. **Monitor droplet age** - rotate old ones

### Safety

1. **Never provision directly to production**
2. **Test in staging first**
3. **Backup database before operations**
4. **Use distributed locks for allocations**
5. **Have rollback plan ready**

---

## Monitoring Alerts

### Key Metrics

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| Standby pool | 8-10 | 4-7 | < 4 |
| Unhealthy servers | 0 | 1-2 | > 2 |
| Allocation time | < 1s | 1-3s | > 3s |
| Failed allocations/hr | 0 | 1-5 | > 5 |

### Alert Script Example

```bash
#!/bin/bash
STANDBY=$(pnpm tsx -e "
import { poolManager } from './src/services/pool-manager.js';
poolManager.getServers().then(servers => {
  const c = servers.filter(s => s.state === 'standby' && s.healthStatus === 'healthy').length;
  console.log(c);
});
" 2>/dev/null | tail -1)

if [ "$STANDBY" -lt 4 ]; then
  echo "ALERT: Only $STANDBY standby servers"
  # Send to monitoring service
fi
```

---

End of Server Admin Guide
