/**
 * Clear all allocations and reset pool for reallocation
 */

import 'dotenv/config';
import { redis } from './src/lib/redis.js';
import { poolManager } from './src/services/pool-manager.js';
import { getDb } from './src/lib/db/index.js';
import { userServers } from './src/db/schema.js';
import { eq } from 'drizzle-orm';

async function main() {
  console.log('🧹 Clearing all allocations and resetting pool...\n');

  // Step 1: Clear database user_servers table
  console.log('[1/4] Clearing user servers from database...');
  try {
    const db = getDb();
    const deleted = await db.delete(userServers);
    console.log('✅ Cleared user_servers table');
  } catch (error) {
    console.error('❌ Failed to clear database:', error);
  }

  // Step 2: Clear Redis allocations
  console.log('\n[2/4] Clearing Redis allocations...');
  try {
    await redis.del('allocations');
    console.log('✅ Cleared allocations hash');
  } catch (error) {
    console.error('❌ Failed to clear allocations:', error);
  }

  // Step 3: Clear allocation expiry keys
  console.log('\n[3/4] Clearing allocation expiry keys...');
  try {
    const keys = await redis.keys('allocation:expiry:*');
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(`✅ Cleared ${keys.length} allocation expiry keys`);
    } else {
      console.log('✅ No allocation expiry keys found');
    }
  } catch (error) {
    console.error('❌ Failed to clear expiry keys:', error);
  }

  // Step 4: Get all servers and reset allocated ones to standby
  console.log('\n[4/4] Resetting allocated servers to standby...');
  try {
    const servers = await poolManager.getServers();
    let resetCount = 0;

    for (const server of servers) {
      if (server.state === 'allocated') {
        await poolManager.updateServerState(server.dropletId, 'standby', server.healthStatus || 'unknown');
        console.log(`  ↻ Reset droplet ${server.dropletId} (${server.ipAddress}) to standby`);
        resetCount++;
      }
    }

    if (resetCount === 0) {
      console.log('✅ No allocated servers to reset');
    } else {
      console.log(`✅ Reset ${resetCount} servers to standby`);
    }
  } catch (error) {
    console.error('❌ Failed to reset servers:', error);
  }

  // Show final pool state
  console.log('\n📊 Final pool state:');
  try {
    const servers = await poolManager.getServers();
    const byState = servers.reduce((acc, s) => {
      acc[s.state] = (acc[s.state] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byHealth = servers.reduce((acc, s) => {
      acc[s.healthStatus || 'unknown'] = (acc[s.healthStatus || 'unknown'] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log(`  Total servers: ${servers.length}`);
    console.log(`  By state: ${JSON.stringify(byState)}`);
    console.log(`  By health: ${JSON.stringify(byHealth)}`);
  } catch (error) {
    console.error('Failed to get pool state:', error);
  }

  console.log('\n✅✅✅ COMPLETE! Pool is ready for fresh allocations ✅✅✅');
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
