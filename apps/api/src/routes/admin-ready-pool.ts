import { Hono } from 'hono';
import { getDb } from '../lib/db/index.js';
import { userServers, allocations, poolServers } from '../db/schema.js';
import { poolManager } from '../services/pool-manager.js';
import { redis } from '../lib/redis.js';

const app = new Hono();

/**
 * GET /api/admin/pool-state - Debug view of pool (what the allocator sees).
 * Returns counts by state, healthStatus, allocatable per stack, and last replenish time.
 */
app.get('/pool-state', async (c) => {
  try {
    const servers = await poolManager.getServers();
    const metrics = await poolManager.getMetrics();

    const byState: Record<string, number> = {};
    const byHealthStatus: Record<string, number> = {};
    const standbyByStack: Record<string, { healthy: number; degraded: number; unknown: number; allocatable: number }> = {
      nanobot: { healthy: 0, degraded: 0, unknown: 0, allocatable: 0 },
      openclaw: { healthy: 0, degraded: 0, unknown: 0, allocatable: 0 },
    };

    for (const s of servers) {
      byState[s.state] = (byState[s.state] || 0) + 1;
      byHealthStatus[s.healthStatus || 'unknown'] = (byHealthStatus[s.healthStatus || 'unknown'] || 0) + 1;

      if (s.state === 'standby' && (s.stack === 'nanobot' || s.stack === 'openclaw')) {
        const bucket = standbyByStack[s.stack];
        const status = s.healthStatus || 'unknown';
        if (status === 'healthy') bucket.healthy++;
        else if (status === 'degraded') bucket.degraded++;
        else bucket.unknown++;
        if (status !== 'unhealthy') bucket.allocatable++;
      }
    }

    const lastReplenishRaw = await redis.get('pool:last-replenish');
    const lastReplenishAt = lastReplenishRaw ? new Date(parseInt(lastReplenishRaw, 10)).toISOString() : null;

    const summary = servers.slice(0, 50).map((s) => ({
      dropletId: s.dropletId,
      state: s.state,
      healthStatus: s.healthStatus || 'unknown',
      stack: s.stack,
      ipAddress: s.ipAddress,
    }));

    return c.json({
      ok: true,
      metrics: {
        totalServers: metrics.totalServers,
        standbyServers: metrics.standbyServers,
        allocatedServers: metrics.allocatedServers,
        standbyByStack: metrics.standbyByStack,
        poolHealth: metrics.poolHealth,
      },
      byState,
      byHealthStatus,
      standbyAllocatableByStack: standbyByStack,
      lastReplenishAt,
      summary,
      hint: 'Allocator picks standby servers with stack match and healthStatus !== "unhealthy". Prefers healthy, then degraded/unknown.',
    });
  } catch (error) {
    console.error('[Admin] pool-state error:', error);
    return c.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to get pool state' },
      500
    );
  }
});

app.post('/ready-pool', async (c) => {
  try {
    const db = getDb();

    console.log('🧹 Cleaning up...');

    // Delete all user servers
    const result1 = await db.delete(userServers);
    console.log(`✓ Deleted user_servers records`);

    // Delete all allocations
    const result2 = await db.delete(allocations);
    console.log(`✓ Deleted allocation records`);

    // Clear existing pool servers
    await db.delete(poolServers);
    console.log(`✓ Cleared pool_servers records`);

    console.log('\n🚀 Pre-provisioning standby pool...');

    // Create test droplet - using real IP we set up
    const droplet = {
      dropletId: 1000000,
      dropletName: 'miniclaw-openclaw-test-1',
      state: 'standby',
      stack: 'openclaw',
      region: 'nyc1',
      size: 's-1vcpu-1gb',
      ipAddress: '159.223.129.50',
      sshPort: 22,
      createdAt: new Date(),
      stateChangedAt: new Date(),
      allocatedTo: null,
      healthStatus: 'healthy',
      healthCheckFailures: 0,
      stackVersion: '2026.2.26',
    };

    await db.insert(poolServers).values({
      dropletId: droplet.dropletId,
      dropletName: droplet.dropletName,
      state: droplet.state,
      stack: droplet.stack,
      region: droplet.region,
      size: droplet.size,
      ipAddress: droplet.ipAddress,
      sshPort: droplet.sshPort,
      createdAt: droplet.createdAt,
      stateChangedAt: droplet.stateChangedAt,
      allocatedTo: droplet.allocatedTo,
      healthStatus: droplet.healthStatus,
      healthCheckFailures: droplet.healthCheckFailures,
      stackVersion: droplet.stackVersion,
    });

    console.log(`\n✅ Standby pool ready!`);
    console.log(`   - 1 OpenClaw droplet (REAL droplet at ${droplet.ipAddress})`);
    console.log(`   - Ready for allocation and testing!`);

    return c.json({
      success: true,
      message: 'Pool ready with real droplet',
      poolStats: {
        totalDroplets: 1,
        openclawDroplets: 1,
        nanobotDroplets: 0,
        droplets: [droplet],
      },
    });
  } catch (error) {
    console.error('Error readying pool:', error);
    return c.json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to ready pool',
      },
    }, 500);
  }
});

export default app;
