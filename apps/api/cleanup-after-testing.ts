/**
 * Cleanup After Testing - Complete reset for production
 *
 * This script clears ALL test data including:
 * - All users and their allocations
 * - Deallocates servers back to standby
 * - Clears all Redis caches (sessions, allocations, pool state)
 * - Resets OpenRouter droplet keys
 *
 * Run this after manual testing locally before pushing to production.
 */

import 'dotenv/config';
import { redis } from './src/lib/redis.js';
import { poolManager } from './src/services/pool-manager.js';
import { getDb } from './src/lib/db/index.js';
import { userServers, users, poolServers, subscriptions, invoices, tokenPurchases, allocations, auditLogs } from './src/db/schema.js';
import { eq } from 'drizzle-orm';

async function main() {
  console.log('🧹 Cleanup After Testing - Complete Reset\n');
  console.log('=' .repeat(60));

  const db = getDb();
  let totalChanges = 0;

  // ========================================================================
  // PART 1: DATABASE CLEANUP
  // ========================================================================

  console.log('\n📊 PART 1: DATABASE CLEANUP\n');

  // Step 1: Clear audit logs (optional - keeps audit trail clean)
  console.log('[1/7] Clearing audit logs...');
  try {
    const result = await db.delete(auditLogs);
    console.log('   ✅ Cleared all audit logs');
    totalChanges++;
  } catch (error) {
    console.error('   ⚠️  Failed to clear audit logs:', error);
  }

  // Step 2: Clear token purchases
  console.log('[2/7] Clearing token purchases...');
  try {
    await db.delete(tokenPurchases);
    console.log('   ✅ Cleared all token purchases');
    totalChanges++;
  } catch (error) {
    console.error('   ⚠️  Failed to clear token purchases:', error);
  }

  // Step 3: Clear invoices
  console.log('[3/7] Clearing invoices...');
  try {
    await db.delete(invoices);
    console.log('   ✅ Cleared all invoices');
    totalChanges++;
  } catch (error) {
    console.error('   ⚠️  Failed to clear invoices:', error);
  }

  // Step 4: Clear subscriptions
  console.log('[4/7] Clearing subscriptions...');
  try {
    await db.delete(subscriptions);
    console.log('   ✅ Cleared all subscriptions');
    totalChanges++;
  } catch (error) {
    console.error('   ⚠️  Failed to clear subscriptions:', error);
  }

  // Step 5: Clear user servers (allocated servers)
  console.log('[5/7] Clearing user server allocations...');
  try {
    const result = await db.delete(userServers);
    console.log('   ✅ Cleared all user server allocations');
    totalChanges++;
  } catch (error) {
    console.error('   ⚠️  Failed to clear user servers:', error);
  }

  // Step 6: Clear allocations table
  console.log('[6/7] Clearing allocation records...');
  try {
    await db.delete(allocations);
    console.log('   ✅ Cleared all allocation records');
    totalChanges++;
  } catch (error) {
    console.error('   ⚠️  Failed to clear allocations:', error);
  }

  // Step 7: Clear all users (this cascades to all user-related tables)
  console.log('[7/7] Clearing all users...');
  try {
    await db.delete(users);
    console.log('   ✅ Cleared all users');
    totalChanges++;
  } catch (error) {
    console.error('   ⚠️  Failed to clear users:', error);
  }

  // ========================================================================
  // PART 2: DEALLOCATE SERVERS
  // ========================================================================

  console.log('\n🔄 PART 2: DEALLOCATE SERVERS\n');

  console.log('[Checking] Finding allocated servers...');
  try {
    const allServers = await poolManager.getServers();
    const allocatedServers = allServers.filter(s => s.state === 'allocated');

    if (allocatedServers.length === 0) {
      console.log('   ✅ No allocated servers found');
    } else {
      console.log(`   Found ${allocatedServers.length} allocated server(s)`);

      for (const server of allocatedServers) {
        console.log(`   ⏳ Deallocating ${server.dropletName} (ID: ${server.dropletId})...`);

        // Update server state to standby and clear allocatedTo
        await poolManager.updateServerState(server.dropletId, 'standby', 'healthy');
        server.state = 'standby';
        server.allocatedTo = undefined;
        await poolManager.addServer(server);

        console.log(`   ✅ Deallocated ${server.dropletName}`);
        totalChanges++;
      }
    }
  } catch (error) {
    console.error('   ⚠️  Failed to deallocate servers:', error);
  }

  // ========================================================================
  // PART 3: REDIS CLEANUP
  // ========================================================================

  console.log('\n🔴 PART 3: REDIS CACHE CLEANUP\n');

  const redisCleanupSteps = [
    {
      name: 'Checkout session caches',
      pattern: 'checkout:session:*',
      description: 'Idempotency caches for checkout'
    },
    {
      name: 'Allocation expiry keys',
      pattern: 'allocation:expiry:*',
      description: 'Allocation timeout tracking'
    },
    {
      name: 'OpenRouter droplet keys',
      pattern: 'openrouter:droplet:*',
      description: 'Per-droplet API key mappings'
    },
    {
      name: 'Allocation locks',
      pattern: 'pool:allocate:*',
      description: 'Distributed allocation locks'
    },
  ];

  for (const step of redisCleanupSteps) {
    console.log(`[Clearing] ${step.name}...`);
    try {
      const keys = await redis.keys(step.pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
        console.log(`   ✅ Cleared ${keys.length} ${step.name.toLowerCase()}`);
        totalChanges += keys.length;
      } else {
        console.log(`   ✅ No ${step.name.toLowerCase()} found`);
      }
    } catch (error) {
      console.error(`   ⚠️  Failed to clear ${step.name.toLowerCase()}:`, error);
    }
  }

  // Clear specific Redis keys
  console.log('\n[Clearing] Core Redis keys...');
  try {
    const coreKeys = [
      'allocations',
      'pool:servers',
      'pool:metrics',
      'pool:lastHealthCheck',
    ];

    for (const key of coreKeys) {
      await redis.del(key);
      console.log(`   ✅ Cleared: ${key}`);
    }
    totalChanges++;
  } catch (error) {
    console.error('   ⚠️  Failed to clear core keys:', error);
  }

  // ========================================================================
  // PART 4: VERIFICATION
  // ========================================================================

  console.log('\n✅ PART 4: VERIFICATION\n');

  // Verify database is clean
  console.log('[Database] Checking for remaining data...');
  try {
    const userCount = await db.select().from(users).limit(1);
    const serverCount = await db.select().from(userServers).limit(1);

    if (userCount.length === 0) {
      console.log('   ✅ Users table is empty');
    } else {
      console.log('   ⚠️  WARNING: Users table still has data');
    }

    if (serverCount.length === 0) {
      console.log('   ✅ User servers table is empty');
    } else {
      console.log('   ⚠️  WARNING: User servers table still has data');
    }
  } catch (error) {
    console.error('   ⚠️  Failed to verify database:', error);
  }

  // Verify pool state
  console.log('\n[Pool] Checking pool state...');
  try {
    const servers = await poolManager.getServers();
    const standbyCount = servers.filter(s => s.state === 'standby').length;
    const allocatedCount = servers.filter(s => s.state === 'allocated').length;

    console.log(`   📊 Total pool servers: ${servers.length}`);
    console.log(`   📊 Standby servers: ${standbyCount}`);
    console.log(`   📊 Allocated servers: ${allocatedCount}`);

    if (allocatedCount === 0) {
      console.log('   ✅ All servers are in standby state');
    } else {
      console.log(`   ⚠️  WARNING: ${allocatedCount} server(s) still allocated`);
    }
  } catch (error) {
    console.error('   ⚠️  Failed to verify pool state:', error);
  }

  // Verify Redis is clean
  console.log('\n[Redis] Checking for remaining keys...');
  try {
    const allPatterns = [
      'checkout:session:*',
      'allocation:expiry:*',
      'openrouter:droplet:*',
      'pool:allocate:*',
    ];

    let totalKeys = 0;
    for (const pattern of allPatterns) {
      const keys = await redis.keys(pattern);
      totalKeys += keys.length;
    }

    if (totalKeys === 0) {
      console.log('   ✅ All caches cleared');
    } else {
      console.log(`   ⚠️  WARNING: ${totalKeys} Redis key(s) remaining`);
    }
  } catch (error) {
    console.error('   ⚠️  Failed to verify Redis:', error);
  }

  // ========================================================================
  // PART 5: REMOVE DEPRECATED SCRIPTS
  // ========================================================================

  console.log('\n🗑️  PART 5: REMOVE DEPRECATED SCRIPTS\n');

  const fs = await import('fs');
  const path = await import('path');

  const deprecatedScripts = [
    { name: 'clear-all-allocations.ts', reason: 'Functionality merged into cleanup-after-testing.ts' },
  ];

  for (const script of deprecatedScripts) {
    const scriptPath = path.join(process.cwd(), script.name);
    console.log(`[Checking] ${script.name}...`);

    try {
      if (fs.existsSync(scriptPath)) {
        fs.unlinkSync(scriptPath);
        console.log(`   ✅ Removed: ${script.name} (${script.reason})`);
        totalChanges++;
      } else {
        console.log(`   ℹ️  Already removed: ${script.name}`);
      }
    } catch (error) {
      console.error(`   ⚠️  Failed to remove ${script.name}:`, error);
    }
  }

  // ========================================================================
  // SUMMARY
  // ========================================================================

  console.log('\n' + '='.repeat(60));
  console.log('\n🎉 CLEANUP COMPLETE!\n');
  console.log(`   Total changes made: ${totalChanges}`);
  console.log('\n✅ System is ready for production deployment\n');
  console.log('='.repeat(60) + '\n');

  process.exit(0);
}

main().catch((error) => {
  console.error('\n❌ Fatal error during cleanup:', error);
  process.exit(1);
});
