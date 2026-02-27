import { Hono } from 'hono';
import { getDb } from '../lib/db/index.js';
import { userServers, allocations, poolServers } from '../db/schema.js';

const app = new Hono();

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
