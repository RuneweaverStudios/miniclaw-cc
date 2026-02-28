/**
 * Prepare for Production - Clear all data and ready the pool
 */

import 'dotenv/config';
import { redis } from './src/lib/redis.js';
import { poolManager } from './src/services/pool-manager.js';
import { getDb } from './src/lib/db/index.js';
import { userServers, users } from './src/db/schema.js';

async function main() {
  console.log('🚀 Preparing for Production - Clearing all data...\n');

  // Step 1: Clear user_servers table
  console.log('[1/6] Clearing user servers from database...');
  try {
    const db = getDb();
    await db.delete(userServers);
    console.log('✅ Cleared all user servers');
  } catch (error) {
    console.error('❌ Failed to clear user servers:', error);
  }

  // Step 2: Clear all users
  console.log('\n[2/6] Clearing users from database...');
  try {
    const db = getDb();
    await db.delete(users);
    console.log('✅ Cleared all users');
  } catch (error) {
    console.error('❌ Failed to clear users:', error);
  }

  // Step 3: Clear Redis allocations
  console.log('\n[3/6] Clearing Redis allocations...');
  try {
    await redis.del('allocations');
    console.log('✅ Cleared allocations hash');
  } catch (error) {
    console.error('❌ Failed to clear allocations:', error);
  }

  // Step 4: Clear allocation expiry keys
  console.log('\n[4/6] Clearing allocation expiry keys...');
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

  // Step 5: Clear all pool servers from Redis
  console.log('\n[5/6] Clearing all pool servers from Redis...');
  try {
    await redis.del('pool:servers');
    console.log('✅ Cleared pool servers');
  } catch (error) {
    console.error('❌ Failed to clear pool servers:', error);
  }

  // Step 6: Verify pool is empty
  console.log('\n[6/6] Verifying pool state...');
  try {
    const servers = await poolManager.getServers();
    console.log(`📊 Pool now has ${servers.length} servers`);
  } catch (error) {
    console.error('Failed to verify pool state:', error);
  }

  console.log('\n✅✅✅ PRODUCTION READY! All data cleared ✅✅✅');
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
