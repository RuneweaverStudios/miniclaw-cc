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
    .parse();

  const options = program.opts();

  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                    POOL REFILL                                  ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('');

  const nanobotsToAdd = parseInt(options.nanobots);
  const openclawsToAdd = parseInt(options.openclaws);
  const useExisting = options.useExisting || false;

  // Get current pool state
  const currentServers = await poolManager.getServers();
  const currentNanobots = currentServers.filter(s => s.stack === 'nanobot' && s.state === 'standby' && s.healthStatus === 'healthy').length;
  const currentOpenclaws = currentServers.filter(s => s.stack === 'openclaw' && s.state === 'standby' && s.healthStatus === 'healthy').length;

  console.log(`Current pool state:`);
  console.log(`  Nanobots (standby + healthy): ${currentNanobots}/5`);
  console.log(`  OpenClaws (standby + healthy): ${currentOpenclaws}/5`);
  console.log('');

  // Calculate what's needed
  const neededNanobots = Math.max(0, nanobotsToAdd > 0 ? nanobotsToAdd : 5 - currentNanobots);
  const neededOpenclaws = Math.max(0, openclawsToAdd > 0 ? openclawsToAdd : 5 - currentOpenclaws);

  if (neededNanobots === 0 && neededOpenclaws === 0) {
    console.log('✅ Pool is already full! No refilling needed.');
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
  const finalNanobots = finalServers.filter(s => s.stack === 'nanobot' && s.state === 'standby' && s.healthStatus === 'healthy').length;
  const finalOpenclaws = finalServers.filter(s => s.stack === 'openclaw' && s.state === 'standby' && s.healthStatus === 'healthy').length;
  const totalHealthy = finalNanobots + finalOpenclaws;

  console.log(`  Nanobots (standby + healthy): ${finalNanobots}/5`);
  console.log(`  OpenClaws (standby + healthy): ${finalOpenclaws}/5`);
  console.log(`  Total ready for allocation: ${totalHealthy}/10`);
  console.log('');

  if (totalHealthy === 10) {
    console.log('✅✅✅ POOL IS FULL AND READY! ✅✅✅');
  } else {
    console.log(`⚠️  Pool needs ${10 - totalHealthy} more healthy servers`);
    console.log(`   Run: npm run test:onboarding -- --count ${10 - totalHealthy}`);
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
