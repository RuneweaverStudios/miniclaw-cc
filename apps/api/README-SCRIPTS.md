# MiniClaw-CC API Scripts

## Overview

This document describes the scripts available for managing the MiniClaw-CC VPS provisioning service.

## Available Scripts

### E2E Testing

#### `npm run test:onboarding`
**Full end-to-end onboarding flow test**

Tests the complete server provisioning and pool refill flow:
1. Provision new droplets with cloud-init
2. Wait for droplets to be ready (IP + cloud-init complete)
3. Install Nanobot/OpenClaw
4. Create per-droplet OpenRouter keys
5. Configure model and verify LLM connectivity
6. Test gateway health endpoint
7. Add to pool as standby + healthy

**Options:**
- `--count <number>` - Number of servers to test per stack type (default: 1)
- `--type <nanobot|openclaw|both>` - Stack type to test (default: both)
- `--region <region>` - DigitalOcean region (default: nyc1)
- `--skip-provision` - Use existing standby servers instead of provisioning
- `--skip-health-check` - Skip full health check
- `--destroy-after` - Destroy droplets after successful test

**Examples:**
```bash
npm run test:onboarding                                    # Test 1 server of each type
npm run test:onboarding -- --count 3                      # Test 3 servers of each type
npm run test:onboarding -- --type nanobot                 # Test only Nanobot
npm run test:onboarding -- --skip-provision               # Test existing pool servers
npm run test:onboarding -- --destroy-after --count 1     # Test and destroy (for CI)
```

### Pool Management

#### `npm run pool:check`
**Display comprehensive pool status**

Shows:
- Redis pool state (by stack, state, health)
- Server details with OpenRouter key indicators
- OpenRouter key usage and limits
- DigitalOcean droplet status
- Active allocations
- Suggested actions

**Example:**
```bash
npm run pool:check
```

#### `npm run pool:refill`
**Quick pool refill**

Adds existing DigitalOcean droplets to the pool.

**Options:**
- `--nanobots <count>` - Number of Nanobot servers to add
- `--openclaws <count>` - Number of OpenClaw servers to add
- `--use-existing` - Add existing DigitalOcean droplets instead of provisioning

**Examples:**
```bash
npm run pool:refill                                    # Auto-refill to 10 servers
npm run pool:refill -- --nanobots 3                   # Add 3 Nanobot servers
npm run pool:refill -- --use-existing                 # Use existing DO droplets
```

#### `npm run pool:deallocate`
**Deallocate a specific server**

Clears Telegram configuration, revokes OpenRouter key, returns server to pool.

**Usage:**
```bash
npm run pool:deallocate <dropletId>
```

**Example:**
```bash
npm run pool:deallocate 555084292
```

#### `npm run pool:clear-allocations`
**Clear all test allocations**

Removes all user allocations from database and Redis.

**Usage:**
```bash
npm run pool:clear-allocations
```

#### `npm run pool:prepare`
**Prepare for production**

Clears all test data:
- All users from database
- All allocations from database
- All Redis allocations

**Usage:**
```bash
npm run pool:prepare
```

## Deprecated Scripts (Removed)

The following scripts were removed and replaced with the E2E test:

- `provision-nanobots.ts` - Replaced by `test-onboarding-flow.ts`
- `complete-nanobots.ts` - Replaced by `test-onboarding-flow.ts`
- `balance-pool.ts` - Replaced by `test-onboarding-flow.ts` and `pool-refill.ts`
- `resync-pool.ts` - Replaced by `pool:check` and pool manager

## Active Scripts (Retained)

The following scripts remain active and useful:

- `clear-all-allocations.ts` → `npm run pool:clear-allocations`
- `prepare-for-prod.ts` → `npm run pool:prepare`
- `deallocate-server.ts` → `npm run pool:deallocate`
- `check-pool.ts` → `npm run pool:check` (enhanced)
- `drizzle.config.ts` - Drizzle ORM configuration

## Per-Droplet OpenRouter Keys

The E2E test now properly implements per-droplet OpenRouter keys:

1. **Key Creation**: Each droplet gets a unique key (`or-mini-{dropletId}-{uuid}`)
2. **Key Storage**: Stored in Redis and database (`server.config.openrouterKey`)
3. **Configuration**: Droplet-specific key is used when configuring Nanobot/OpenClaw
4. **Revocation**: Keys are revoked when servers are deallocated

**Key Locations:**
- Redis: `openrouter:droplet:{dropletId}` → key value
- Redis: `openrouter:keys` → hash of all key configs
- Database: `user_servers.config.openrouterKey`

## Health Check Flow

The health check service verifies:
1. SSH connectivity
2. Service status (systemd)
3. HTTP health endpoint
4. System metrics (CPU, memory, disk)

**Health Statuses:**
- `healthy` - All checks passing
- `degraded` - Running but with issues (high resource usage)
- `unhealthy` - Service down or unreachable
- `pending` - Not yet checked

## Pool States

- `provisioning` - Being created
- `testing` - Being tested
- `standby` - Ready for allocation
- `allocated` - Assigned to a user
- `error` - Needs attention

## Quick Start

1. **Check pool status:**
   ```bash
   npm run pool:check
   ```

2. **Refill pool if needed:**
   ```bash
   npm run test:onboarding -- --count 2
   ```

3. **Deallocate test servers:**
   ```bash
   npm run pool:deallocate <dropletId>
   ```

4. **Clear all test data:**
   ```bash
   npm run pool:prepare
   ```

## Environment Variables Required

```
DIGITALOCEAN_TOKEN=...              # DigitalOcean API token
SSH_PRIVATE_KEY=...                  # or SSH_PRIVATE_KEY_PATH
OPENROUTER_API_KEY=...               # Master OpenRouter key
DATABASE_URL=...                     # PostgreSQL connection
REDIS_URL=...                        # Redis connection
```

## Troubleshooting

**Pool shows servers but they're not healthy:**
- Run `npm run test:onboarding -- --skip-provision` to re-test existing servers

**OpenRouter keys not being created:**
- Check `OPENROUTER_API_KEY` is set
- Check Redis is running

**Droplets stuck in provisioning:**
- Check DigitalOcean status: `npm run pool:check`
- Verify SSH key is configured correctly

**Gateway health checks failing:**
- Check logs: `ssh root@<ip> tail -100 /tmp/gateway-test.log`
- Verify port is open: `ssh root@<ip> netstat -tln`
