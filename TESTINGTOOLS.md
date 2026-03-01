# Testing Tools

This document describes all the testing and development tools available in MiniClaw-CC for local development and testing.

---

## Quick Reference

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `pnpm cleanup:testing` | Complete system reset | After manual testing, before prod push |
| `pnpm pool:prepare` | Basic data clear | Quick reset of users and allocations |
| `pnpm pool:check` | View pool status | Check available/allocated servers |
| `pnpm pool:refill` | Replenish standby pool | Add more servers to pool |
| `pnpm pool:reconcile` | Sync pool with DigitalOcean | Fix pool state mismatches |
| `pnpm pool:deallocate <dropletId>` | Deallocate specific server | Free up a stuck allocation |
| `pnpm pool:clear-allocations` | Clear all allocations | Reset all allocated servers |
| `pnpm test:onboarding` | Run E2E onboarding test | Test full signup → allocation flow |
| `pnpm db:studio` | Open database UI | View/edit database visually |

---

## 1. `cleanup:testing` - Complete Reset

**Location**: `apps/api/cleanup-after-testing.ts`

**Run**:
```bash
# From project root
pnpm cleanup:testing

# Or from apps/api
cd apps/api && pnpm cleanup:testing
```

**What it does**:

### Part 1: Database Cleanup
- Clears all `users` (cascades to all user-related tables)
- Clears `user_servers` (allocated servers)
- Clears `allocations` (allocation records)
- Clears `subscriptions` (Stripe subscriptions)
- Clears `invoices` (billing invoices)
- Clears `token_purchases` (token top-ups)
- Clears `audit_logs` (audit trail)

### Part 2: Deallocate Servers
- Finds all servers in `allocated` state
- Returns them to `standby` state
- Clears `allocatedTo` field
- Resets `healthStatus` to `healthy`

### Part 3: Redis Cache Cleanup
Clears all Redis keys:
- `checkout:session:*` - Idempotency caches for checkout sessions
- `allocation:expiry:*` - Allocation timeout tracking
- `openrouter:droplet:*` - Per-droplet API key mappings
- `pool:allocate:*` - Distributed allocation locks
- `allocations` - User allocation hash
- `pool:servers` - Pool server state
- `pool:metrics` - Pool metrics

### Part 4: Verification
- Confirms users table is empty
- Confirms user_servers table is empty
- Verifies all servers are in standby state
- Checks all Redis caches are cleared

**When to use**:
- After completing manual testing of the user signup flow
- Before pushing to production
- When you want a completely fresh start

**Example output**:
```
🧹 Cleanup After Testing - Complete Reset
============================================================

📊 PART 1: DATABASE CLEANUP
[1/7] Clearing audit logs...
   ✅ Cleared all audit logs
[2/7] Clearing token purchases...
   ✅ Cleared all token purchases
...

🔄 PART 2: DEALLOCATE SERVERS
[Checking] Finding allocated servers...
   Found 2 allocated server(s)
   ⏳ Deallocating pool-openclaw-nyc1-5794-mm5yb2ia-ovk8 (ID: 555011767)...
   ✅ Deallocated pool-openclaw-nyc1-5794-mm5yb2ia-ovk8
...

🔴 PART 3: REDIS CACHE CLEANUP
[Clearing] Checkout session caches...
   ✅ Cleared 3 checkout session caches
...

✅ PART 4: VERIFICATION
[Database] Checking for remaining data...
   ✅ Users table is empty
   ✅ User servers table is empty
[Pool] Checking pool state...
   📊 Total pool servers: 10
   📊 Standby servers: 10
   📊 Allocated servers: 0
   ✅ All servers are in standby state

============================================================
🎉 CLEANUP COMPLETE!
   Total changes made: 15
✅ System is ready for production deployment
```

---

## 2. `pool:prepare` - Basic Data Clear

**Location**: `apps/api/prepare-for-prod.ts`

**Run**:
```bash
pnpm pool:prepare
```

**What it does**:
- Clears `user_servers` table
- Clears `users` table
- Clears Redis `allocations` hash
- Clears `allocation:expiry:*` keys
- Clears `pool:servers` from Redis

**When to use**:
- Quick reset when you don't need full cleanup
- Clearing test users before running tests
- Resetting allocation state

---

## 3. `pool:check` - View Pool Status

**Location**: `apps/api/check-pool.ts`

**Run**:
```bash
pnpm pool:check
```

**What it does**:
- Displays all servers in the pool
- Shows server state (provisioning, testing, standby, allocated)
- Shows health status
- Displays allocation info

**When to use**:
- Checking pool health
- Verifying available servers
- Debugging allocation issues

**Example output**:
```
📊 Pool Status
=============

Standby Servers (8):
  • pool-nanobot-nyc1-1234-abc (ID: 555011767)
    Stack: nanobot | Region: nyc1 | Size: s-1vcpu-1gb
    Health: healthy | SSH Port: 22

  • pool-openclaw-nyc1-5678-def (ID: 555011768)
    Stack: openclaw | Region: nyc1 | Size: s-1vcpu-2gb
    Health: healthy | SSH Port: 22

Allocated Servers (2):
  • pool-nanobot-nyc1-9012-ghi (ID: 555011769)
    Stack: nanobot | Region: nyc1 | Size: s-1vcpu-1gb
    Health: healthy | Allocated to: user-uuid-123

Summary:
  Total: 10 servers
  Standby: 8 (5 nanobot, 3 openclaw)
  Allocated: 2
```

---

## 4. `pool:refill` - Replenish Standby Pool

**Location**: `apps/api/pool-refill.ts`

**Run**:
```bash
pnpm pool:refill
```

**What it does**:
- Checks current pool size
- Provisions new servers to reach target pool size
- Configures each server with OpenClaw or Nanobot
- Runs health checks
- Adds healthy servers to standby pool

**When to use**:
- After servers are allocated and pool is low
- Preparing for expected traffic
- Maintaining minimum pool levels

---

## 5. `pool:reconcile` - Sync with DigitalOcean

**Location**: `apps/api/reconcile-pool.ts`

**Run**:
```bash
pnpm pool:reconcile
```

**What it does**:
- Fetches all droplets from DigitalOcean API
- Compares with local pool state in Redis
- Removes servers from pool that no longer exist in DO
- Updates health status for mismatched states

**When to use**:
- Pool state is out of sync with reality
- Servers were manually deleted in DigitalOcean dashboard
- After DigitalOcean maintenance or issues

---

## 6. `pool:deallocate` - Deallocate Specific Server

**Location**: `apps/api/deallocate-server.ts`

**Run**:
```bash
pnpm pool:deallocate <dropletId>
```

**Example**:
```bash
pnpm pool:deallocate 555011767
```

**What it does**:
- Updates server state to `standby`
- Clears `allocatedTo` field
- Resets `healthStatus` to `healthy`
- Returns server to available pool

**When to use**:
- Server is stuck in allocated state
- User cancelled but server wasn't deallocated
- Manual intervention needed for a specific server

---

## 7. `pool:clear-allocations` - Clear All Allocations

**Location**: `apps/api/clear-all-allocations.ts`

**Run**:
```bash
pnpm pool:clear-allocations
```

**What it does**:
- Finds all servers in `allocated` state
- Deallocates all of them back to `standby`
- Clears all `allocatedTo` references
- Resets health status

**When to use**:
- Multiple servers stuck allocated
- Complete reset of allocation state
- Clearing out test allocations

---

## 8. `test:onboarding` - E2E Onboarding Test

**Location**: `apps/api/test-onboarding-flow.ts`

**Run**:
```bash
pnpm test:onboarding
```

**What it does**:
- Simulates complete user signup flow
- Tests server allocation from pool
- Verifies server health
- Tests configuration application
- Reports success/failure

**When to use**:
- After making changes to allocation logic
- Verifying pool health before deployment
- Testing end-to-end onboarding experience

---

## 9. `db:studio` - Database UI

**Run**:
```bash
pnpm db:studio
```

**What it does**:
- Opens Drizzle Studio web interface
- Visual database browser and editor
- View and edit all tables
- Run queries

**When to use**:
- Inspecting data during debugging
- Manually fixing data issues
- Understanding database state

---

## Database Schema Reference

### Tables

| Table | Purpose |
|-------|---------|
| `users` | User accounts (OAuth, email, plan) |
| `user_servers` | Servers allocated to users |
| `pool_servers` | Servers in the standby pool |
| `allocations` | Allocation records |
| `subscriptions` | Stripe subscriptions |
| `invoices` | Billing invoices |
| `token_purchases` | Token top-up purchases |
| `audit_logs` | Audit trail |

### Pool Server States

- `provisioning` - Being created in DigitalOcean
- `testing` - Health checks running
- `standby` - Available for allocation
- `allocated` - Assigned to a user
- `terminating` - Being destroyed

### Health Statuses

- `healthy` - Server is healthy
- `unhealthy` - Server has issues
- `unknown` - Status not yet determined

---

## Redis Keys Reference

| Key Pattern | Purpose | TTL |
|-------------|---------|-----|
| `pool:servers` | All pool servers (JSON) | None |
| `pool:metrics` | Pool metrics (counts) | None |
| `allocations` | User allocations (hash) | None |
| `checkout:session:{sessionId}` | Idempotency cache | 1 hour |
| `allocation:expiry:{dropletId}` | Allocation timeout | Variable |
| `openrouter:droplet:{dropletId}` | Per-droplet API keys | None |
| `pool:allocate:{stack}:{region}` | Allocation lock | 60 seconds |

---

## Testing Workflow

### Typical Local Testing Session

1. **Start fresh**:
   ```bash
   pnpm cleanup:testing
   ```

2. **Verify pool state**:
   ```bash
   pnpm pool:check
   ```

3. **Start dev server**:
   ```bash
   pnpm dev
   ```

4. **Test the flow**:
   - Go to http://localhost:5173
   - Sign up with OAuth
   - Select framework and model
   - Complete checkout
   - Verify server allocation

5. **Inspect results** (optional):
   ```bash
   pnpm db:studio
   ```

6. **Clean up**:
   ```bash
   pnpm cleanup:testing
   ```

### Before Production Deployment

1. **Clean up test data**:
   ```bash
   pnpm cleanup:testing
   ```

2. **Verify pool is ready**:
   ```bash
   pnpm pool:check
   ```

3. **Run E2E test** (optional):
   ```bash
   pnpm test:onboarding
   ```

4. **Check for stuck allocations**:
   ```bash
   pnpm pool:reconcile
   ```

5. **Replenish if needed**:
   ```bash
   pnpm pool:refill
   ```

---

## Troubleshooting

### Server Won't Allocate

**Symptom**: `Could not acquire allocation lock (try again)`

**Solutions**:
1. Check for stuck locks in Redis:
   ```bash
   redis-cli KEYS "pool:allocate:*"
   ```
2. Clear stuck locks:
   ```bash
   redis-cli DEL pool:allocate:nanobot:nyc1
   ```
3. Or just run:
   ```bash
   pnpm cleanup:testing
   ```

### Pool Shows Servers That Don't Exist

**Symptom**: `pool:check` shows servers that are deleted in DigitalOcean

**Solution**:
```bash
pnpm pool:reconcile
```

### Database Has Stale Data

**Symptom**: Old users or allocations showing up

**Solution**:
```bash
pnpm cleanup:testing
```

### Can't Allocate Due to "No Servers Available"

**Symptom**: Pool is empty or all servers allocated

**Solution**:
```bash
pnpm pool:refill
```

---

## Environment Variables Required

All testing tools require these environment variables in `.env`:

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/miniclaw

# Redis
REDIS_URL=redis://localhost:6379

# DigitalOcean
DIGITALOCEAN_TOKEN=your_do_token

# OpenRouter (for per-droplet keys)
OPENROUTER_API_KEY=your_openrouter_key

# Stripe (for billing tests)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# App
PUBLIC_URL=http://localhost:5173
JWT_SECRET=your_jwt_secret
```

---

## See Also

- [README.md](./README.md) - Main project documentation
- [docs/architecture.md](./docs/architecture.md) - System architecture
- [docs/api.md](./docs/api.md) - API documentation
