/**
 * Pool Refill Script
 *
 * Quick script to refill the pool with healthy servers.
 * This is a simpler alternative to the full E2E test.
 *
 * Usage:
 *   npm run pool:refill                    # Refill to 10 servers (5 each)
 *   npm run pool:refill -- --nanobots 5   # Add 5 Nanobot servers
 *   npm run pool:refill -- --openclaws 3  # Add 3 OpenClaw servers
 */

import 'dotenv/config';
import { program } from 'commander';
import { poolManager } from './src/services/pool-manager.js';
import { nanobotService } from './src/services/nanobot.js';
import { openrouterService } from './src/services/openrouter.js';

interface DropletFromDO {
  id: number;
  name: string;
  status: string;
  region?: { slug: string };
  size?: { slug: string };
  networks?: {
    v4?: Array<{ ip_address: string; type: string }>;
  };
  tags?: string[];
}

async function main() {
  program
    .option('--nanobots <count>', 'Number of Nanobot servers to add', '0')
    .option('--openclaws <count>', 'Number of OpenClaw servers to add', '0')
    .option('--use-existing', 'Add existing DigitalOcean droplets instead of provisioning')
    .option('--reconcile', 'Remove excess servers to reach target before adding')
    .parse();

  const options = program.opts();

  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                    POOL REFILL                                  ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('');

  const nanobotsToAdd = parseInt(options.nanobots);
  const openclawsToAdd = parseInt(options.openclaws);
  const useExisting = options.useExisting || false;
  const reconcile = options.reconcile || false;

  const TARGET_PER_STACK = 5; // targetPoolSize / 2
  const TARGET_TOTAL = 10;

  // Get current pool state (all servers, not just healthy)
  const currentServers = await poolManager.getServers();
  const currentNanobots = currentServers.filter(s => s.stack === 'nanobot').length;
  const currentOpenclaws = currentServers.filter(s => s.stack === 'openclaw').length;

  console.log(`Current pool state (all servers):`);
  console.log(`  Nanobots: ${currentNanobots}/${TARGET_PER_STACK}`);
  console.log(`  OpenClaws: ${currentOpenclaws}/${TARGET_PER_STACK}`);
  console.log(`  Total: ${currentServers.length}/${TARGET_TOTAL}`);
  console.log('');

  // Reconcile if requested
  if (reconcile) {
    console.log('[Reconcile] Checking for excess servers...');
    const result = await poolManager.reconcileToTarget(true); // dry run first

    if (result.removed.length > 0) {
      console.log(`\n[Reconcile] Would remove ${result.removed.length} excess servers:`);
      for (const server of result.removed) {
        console.log(`  - ${server.dropletName} (${server.stack}): ${server.reason}`);
      }
      console.log('');

      // Ask for confirmation
      console.log('Run with --reconcile to actually remove. (Currently dry-run mode)');
      return;
    } else {
      console.log('[Reconcile] No excess servers found\n');
    }

    // Refresh counts after reconcile
    const refreshedServers = await poolManager.getServers();
    const refreshedNanobots = refreshedServers.filter(s => s.stack === 'nanobot').length;
    const refreshedOpenclaws = refreshedServers.filter(s => s.stack === 'openclaw').length;

    // Recalculate needed based on reconciled counts
    var neededNanobots = Math.max(0, Math.min(nanobotsToAdd || (TARGET_PER_STACK - refreshedNanobots), TARGET_PER_STACK - refreshedNanobots));
    var neededOpenclaws = Math.max(0, Math.min(openclawsToAdd || (TARGET_PER_STACK - refreshedOpenclaws), TARGET_PER_STACK - refreshedOpenclaws));
  } else {
    // Calculate what's needed (don't exceed target)
    const nanobotHeadroom = Math.max(0, TARGET_PER_STACK - currentNanobots);
    const openclawHeadroom = Math.max(0, TARGET_PER_STACK - currentOpenclaws);

    var neededNanobots = nanobotsToAdd > 0
      ? Math.min(nanobotsToAdd, nanobotHeadroom)
      : nanobotHeadroom;

    var neededOpenclaws = openclawsToAdd > 0
      ? Math.min(openclawsToAdd, openclawHeadroom)
      : openclawHeadroom;
  }

  if (currentNanobots >= TARGET_PER_STACK && nanobotsToAdd > 0) {
    console.log(`⚠️  Nanobots already at target (${currentNanobots}/${TARGET_PER_STACK}), not adding more`);
    var neededNanobots = 0;
  }

  if (currentOpenclaws >= TARGET_PER_STACK && openclawsToAdd > 0) {
    console.log(`⚠️  OpenClaws already at target (${currentOpenclaws}/${TARGET_PER_STACK}), not adding more`);
    var neededOpenclaws = 0;
  }

  if (neededNanobots === 0 && neededOpenclaws === 0) {
    console.log('✅ Pool is already at target! No refilling needed.');
    console.log(`   Nanobots: ${currentNanobots}/${TARGET_PER_STACK}`);
    console.log(`   OpenClaws: ${currentOpenclaws}/${TARGET_PER_STACK}`);
    return;
  }

  console.log(`Adding to pool:`);
  if (neededNanobots > 0) console.log(`  Nanobots: ${neededNanobots}`);
  if (neededOpenclaws > 0) console.log(`  OpenClaws: ${neededOpenclaws}`);
  console.log('');

  if (useExisting) {
    await addExistingDroplets(neededNanobots, neededOpenclaws);
  } else {
    console.log('ℹ️  To use existing DigitalOcean droplets, run with --use-existing');
    console.log('    Or use the full E2E test: npm run test:onboarding');
  }

  // Show final state
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Final pool state:');

  const finalServers = await poolManager.getServers();
  const finalNanobots = finalServers.filter(s => s.stack === 'nanobot').length;
  const finalOpenclaws = finalServers.filter(s => s.stack === 'openclaw').length;
  const totalCount = finalServers.length;

  console.log(`  Nanobots: ${finalNanobots}/${TARGET_PER_STACK}`);
  console.log(`  OpenClaws: ${finalOpenclaws}/${TARGET_PER_STACK}`);
  console.log(`  Total: ${totalCount}/${TARGET_TOTAL}`);
  console.log('');

  if (totalCount === TARGET_TOTAL && finalNanobots === TARGET_PER_STACK && finalOpenclaws === TARGET_PER_STACK) {
    console.log('✅✅✅ POOL IS AT TARGET SIZE! ✅✅✅');
  } else {
    const neededNanobots = Math.max(0, TARGET_PER_STACK - finalNanobots);
    const neededOpenclaws = Math.max(0, TARGET_PER_STACK - finalOpenclaws);
    if (neededNanobots > 0 || neededOpenclaws > 0) {
      console.log(`⚠️  Pool needs more servers to reach target:`);
      if (neededNanobots > 0) console.log(`   - ${neededNanobots} more nanobots`);
      if (neededOpenclaws > 0) console.log(`   - ${neededOpenclaws} more openclaws`);
    }
  }
}

async function addExistingDroplets(neededNanobots: number, neededOpenclaws: number) {
  const DO_TOKEN = process.env.DIGITALOCEAN_TOKEN;
  if (!DO_TOKEN) {
    console.error('❌ DIGITALOCEAN_TOKEN not set');
    process.exit(1);
  }

  // Fetch all droplets from DO
  console.log('\n[1/3] Fetching droplets from DigitalOcean...');
  const response = await fetch('https://api.digitalocean.com/v2/droplets?per_page=200', {
    headers: { 'Authorization': `Bearer ${DO_TOKEN}` },
  });

  if (!response.ok) {
    console.error('❌ Failed to fetch droplets');
    process.exit(1);
  }

  const data = await response.json();
  const allDroplets: DropletFromDO[] = data.droplets || [];

  // Filter active droplets not already in pool
  const poolServers = await poolManager.getServers();
  const poolIds = new Set(poolServers.map(s => s.dropletId));

  const availableNanobots = allDroplets.filter(d =>
    d.status === 'active' &&
    !poolIds.has(d.id) &&
    !(d.tags?.includes('openclaw') || d.name?.includes('openclaw'))
  );

  const availableOpenclaws = allDroplets.filter(d =>
    d.status === 'active' &&
    !poolIds.has(d.id) &&
    (d.tags?.includes('openclaw') || d.name?.includes('openclaw'))
  );

  console.log(`  Found ${availableNanobots.length} available Nanobots`);
  console.log(`  Found ${availableOpenclaws.length} available OpenClaws`);

  // Add Nanobots
  if (neededNanobots > 0) {
    console.log(`\n[2/3] Adding ${Math.min(neededNanobots, availableNanobots.length)} Nanobots to pool...`);
    const toAdd = availableNanobots.slice(0, neededNanobots);

    for (const droplet of toAdd) {
      const ipAddress = droplet.networks?.v4?.find((n: any) => n.type === 'public')?.ip_address;
      if (!ipAddress) {
        console.log(`  ⚠️  Skipping ${droplet.name} - no IP`);
        continue;
      }

      // Create OpenRouter key
      const openrouterKey = await openrouterService.createDropletKey(droplet.id);

      await poolManager.addServer({
        dropletId: droplet.id,
        dropletName: droplet.name,
        ipAddress,
        region: droplet.region?.slug || 'nyc1',
        size: droplet.size?.slug || 's-1vcpu-1gb',
        stack: 'nanobot',
        stackVersion: '0.1.3.post7',
        state: 'standby',
        healthStatus: 'healthy',
        stateChangedAt: new Date(),
        config: {
          monitoringEnabled: false,
          alertsEnabled: false,
          backupEnabled: false,
          openrouterKey,
        },
      });

      console.log(`  ✅ ${droplet.name} (${ipAddress})`);
    }
  }

  // Add OpenClaws
  if (neededOpenclaws > 0) {
    console.log(`\n[3/3] Adding ${Math.min(neededOpenclaws, availableOpenclaws.length)} OpenClaws to pool...`);
    const toAdd = availableOpenclaws.slice(0, neededOpenclaws);

    for (const droplet of toAdd) {
      const ipAddress = droplet.networks?.v4?.find((n: any) => n.type === 'public')?.ip_address;
      if (!ipAddress) {
        console.log(`  ⚠️  Skipping ${droplet.name} - no IP`);
        continue;
      }

      // Create OpenRouter key
      const openrouterKey = await openrouterService.createDropletKey(droplet.id);

      await poolManager.addServer({
        dropletId: droplet.id,
        dropletName: droplet.name,
        ipAddress,
        region: droplet.region?.slug || 'nyc1',
        size: droplet.size?.slug || 's-1vcpu-1gb',
        stack: 'openclaw',
        stackVersion: '1.0.0',
        state: 'standby',
        healthStatus: 'healthy',
        stateChangedAt: new Date(),
        config: {
          monitoringEnabled: false,
          alertsEnabled: false,
          backupEnabled: false,
          openrouterKey,
        },
      });

      console.log(`  ✅ ${droplet.name} (${ipAddress})`);
    }
  }

  console.log('\n✅ Pool refill complete!');
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
