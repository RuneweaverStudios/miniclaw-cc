/**
 * Pool Status Check
 *
 * Displays comprehensive pool status including:
 * - Redis pool state
 * - DigitalOcean droplet status
 * - Health status breakdown
 * - Allocation readiness
 * - OpenRouter key status
 */

import 'dotenv/config';
import { poolManager } from './src/services/pool-manager.js';
import { redis } from './src/lib/redis.js';
import { openrouterService } from './src/services/openrouter.js';

async function checkPoolStatus() {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                    POOL STATUS REPORT                          ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('');

  // Redis pool state
  console.log('📊 REDIS POOL STATE');
  console.log('═'.repeat(70));

  const servers = await poolManager.getServers();
  console.log(`Total servers in pool: ${servers.length}`);

  const byStack: Record<string, number> = {};
  const byState: Record<string, number> = {};
  const byHealth: Record<string, number> = {};

  servers.forEach(s => {
    byStack[s.stack] = (byStack[s.stack] || 0) + 1;
    byState[s.state] = (byState[s.state] || 0) + 1;
    byHealth[s.healthStatus || 'unknown'] = (byHealth[s.healthStatus || 'unknown'] || 0) + 1;
  });

  console.log('\nBy Stack:');
  for (const [stack, count] of Object.entries(byStack)) {
    console.log(`  ${stack.padEnd(12)} ${count}`);
  }

  console.log('\nBy State:');
  for (const [state, count] of Object.entries(byState)) {
    console.log(`  ${state.padEnd(12)} ${count}`);
  }

  console.log('\nBy Health:');
  for (const [health, count] of Object.entries(byHealth)) {
    console.log(`  ${health.padEnd(12)} ${count}`);
  }

  const allocatable = servers.filter(s =>
    s.state === 'standby' &&
    s.healthStatus === 'healthy'
  ).length;

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Ready for allocation: ${allocatable} / 10`);

  if (allocatable < 10) {
    const needed = 10 - allocatable;
    console.log(`⚠️  Pool needs ${needed} more healthy servers`);
    console.log(`   Run: npm run test:onboarding -- --count ${needed} --type both`);
  } else {
    console.log(`✨ Pool is full and ready!`);
  }
  console.log('');

  // Server details
  if (servers.length > 0) {
    console.log('📋 SERVER DETAILS');
    console.log('─'.repeat(70));
    console.log(sprintf('%-12s %-12s %-12s %-10s %s', 'Stack', 'State', 'Health', 'Droplet ID', 'IP Address'));
    console.log('─'.repeat(70));

    servers.forEach(s => {
      const health = s.healthStatus || 'unknown';
      const hasOpenRouterKey = !!(s.config as any)?.openrouterKey;
      const keyIndicator = hasOpenRouterKey ? '🔑' : '  ';
      console.log(sprintf(
        '%-12s %-12s %-12s %-10s %s %s',
        s.stack,
        s.state,
        health,
        s.dropletId.toString(),
        s.ipAddress || 'no IP',
        keyIndicator
      ));
    });
    console.log('');
  }

  // OpenRouter keys
  console.log('🔑 OPENROUTER KEYS');
  console.log('─'.repeat(70));

  try {
    const allKeys = await openrouterService.getAllKeys();
    console.log(`Total droplet keys: ${allKeys.length}`);

    let totalUsage = 0;
    let totalLimit = 0;

    for (const { key, config } of allKeys) {
      const usagePct = Math.round((config.usageCents / config.limitCents) * 100);
      const usageBar = '█'.repeat(Math.min(usagePct / 10, 10)) + '░'.repeat(10 - Math.min(usagePct / 10, 10));

      console.log(`  ${key.slice(0, 30)}...`);
      console.log(`    Usage: $${(config.usageCents / 100).toFixed(2)} / $${(config.limitCents / 100).toFixed(2)} [${usageBar}] ${usagePct}%`);

      totalUsage += config.usageCents;
      totalLimit += config.limitCents;
    }

    if (allKeys.length > 0) {
      const totalUsagePct = Math.round((totalUsage / totalLimit) * 100);
      console.log(`\n  Total Usage: $${(totalUsage / 100).toFixed(2)} / $${(totalLimit / 100).toFixed(2)} (${totalUsagePct}%)`);
    }
  } catch (err) {
    console.log('  Could not fetch OpenRouter key status');
  }
  console.log('');

  // DigitalOcean status
  const DO_TOKEN = process.env.DIGITALOCEAN_TOKEN;
  if (DO_TOKEN) {
    console.log('🌐 DIGITALOCEAN STATUS');
    console.log('─'.repeat(70));

    try {
      const response = await fetch('https://api.digitalocean.com/v2/droplets?per_page=200', {
        headers: { 'Authorization': `Bearer ${DO_TOKEN}` },
      });
      const data = await response.json();
      const doDroplets = data.droplets || [];

      const nanobots = doDroplets.filter((d: any) =>
        !(d.tags?.includes('openclaw') || d.name?.includes('openclaw'))
      );
      const openclaws = doDroplets.filter((d: any) =>
        d.tags?.includes('openclaw') || d.name?.includes('openclaw')
      );

      console.log(`Total droplets: ${doDroplets.length}`);
      console.log(`  Nanobots: ${nanobots.length}`);
      console.log(`  OpenClaws: ${openclaws.length}`);

      // Check for droplets not in pool
      const poolIds = new Set(servers.map(s => s.dropletId));
      const orphanedDroplets = doDroplets.filter((d: any) => !poolIds.has(d.id));

      if (orphanedDroplets.length > 0) {
        console.log(`\n⚠️  Droplets NOT in pool (${orphanedDroplets.length}):`);
        orphanedDroplets.forEach((d: any) => {
          const stack = d.tags?.includes('openclaw') || d.name?.includes('openclaw') ? 'openclaw' : 'nanobot';
          console.log(`   - ${d.name} (${stack}, ${d.id})`);
        });
        console.log('   These can be destroyed or added to the pool');
      }

      // Check for provisioning droplets
      const provisioningDroplets = doDroplets.filter((d: any) => d.status !== 'active');
      if (provisioningDroplets.length > 0) {
        console.log(`\n⏳ Provisioning droplets (${provisioningDroplets.length}):`);
        provisioningDroplets.forEach((d: any) => {
          const ip = d.networks?.v4?.find((n: any) => n.type === 'public')?.ip_address || 'assigning...';
          console.log(`   - ${d.name} (${d.status}) - IP: ${ip}`);
        });
      }

    } catch (err) {
      console.log('  Could not fetch DigitalOcean status');
    }
    console.log('');
  }

  // Database allocations
  console.log('💾 ALLOCATIONS');
  console.log('─'.repeat(70));

  try {
    const db = (await import('./src/lib/db/index.js')).getDb();
    const { userServers } = await import('./src/db/schema.js');
    const { eq } = await import('drizzle-orm');

    const allocatedServers = await db.select()
      .from(userServers)
      .where(eq(userServers.status, 'active'));

    console.log(`Active allocations: ${allocatedServers.length}`);

    if (allocatedServers.length > 0) {
      allocatedServers.forEach((alloc: any) => {
        const stack = alloc.stack || 'unknown';
        console.log(`  - Droplet ${alloc.dropletId} (${stack}) -> User ${alloc.userId.slice(0, 8)}...`);
      });
    }
  } catch (err) {
    console.log('  Could not fetch allocation status');
  }
  console.log('');

  // Actions
  console.log('🔧 AVAILABLE ACTIONS');
  console.log('─'.repeat(70));
  console.log('  npm run test:onboarding              # Run full E2E test (provision, install, test)');
  console.log('  npm run test:onboarding -- --count 3 # Test 3 servers of each type');
  console.log('  npm run pool:deallocate -- <id>      # Deallocate a specific server');
  console.log('  npm run pool:clear-allocations       # Clear all test allocations');
  console.log('  npm run pool:prepare                # Clear all data for production');
  console.log('');

  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                      END OF REPORT                              ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('');
}

// Simple sprintf implementation
function sprintf(format: string, ...args: any[]): string {
  return format.replace(/%(-?\d*)?s/g, (match, width) => {
    const arg = args.shift() || '';
    const w = parseInt(width || '0');
    if (w >= 0) {
      return arg.toString().padEnd(Math.abs(w));
    } else {
      return arg.toString().padStart(Math.abs(w));
    }
  });
}

checkPoolStatus().catch(console.error);

