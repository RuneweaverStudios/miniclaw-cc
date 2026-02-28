import 'dotenv/config';
import { destroyDroplet, provisionDroplet } from '../src/services/provisioner.js';
import { poolManager } from '../src/services/pool-manager.js';

// OpenClaw droplets with wrong size (2GB instead of 4GB)
const wrongSizeDroplets = [
  { dropletId: 554969208, ipAddress: '147.182.218.214' },
  { dropletId: 554969462, ipAddress: '159.223.119.74' },
  { dropletId: 554969654, ipAddress: '159.89.54.186' },
];

async function main() {
  console.log('=== Fixing OpenClaw Droplet Sizes ===\n');

  // Step 1: Destroy wrong-sized droplets
  console.log('Step 1: Destroying 3 OpenClaw droplets with wrong size (2GB)...');

  for (const droplet of wrongSizeDroplets) {
    try {
      console.log(`  Destroying droplet ${droplet.dropletId}...`);
      await destroyDroplet(droplet.dropletId);
      await poolManager.removeServer(droplet.dropletId);
      console.log(`  ✅ Destroyed`);
    } catch (error) {
      console.log(`  ⚠️  Error: ${error}`);
    }
  }

  // Step 2: Create 3 new OpenClaw droplets with correct size (4GB)
  console.log('\nStep 2: Creating 3 new OpenClaw droplets (s-2vcpu-4gb)...\n');

  for (let i = 0; i < 3; i++) {
    try {
      console.log(`[${i + 1}/3] Creating OpenClaw droplet...`);

      const result = await provisionDroplet({
        stack: 'openclaw',
        region: 'nyc1',
        size: 's-2vcpu-4gb',
        version: 'latest',
      });

      console.log(`  ✅ Created: ${result.dropletName} (${result.ipAddress})`);

      await poolManager.addServer({
        dropletId: result.dropletId,
        dropletName: result.dropletName,
        ipAddress: result.ipAddress,
        region: 'nyc1',
        size: 's-2vcpu-4gb',
        stack: 'openclaw',
        state: 'provisioning',
        healthStatus: 'unknown',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`  ✅ Added to pool\n`);

    } catch (error) {
      console.log(`  ❌ Error: ${error}\n`);
    }
  }

  // Summary
  console.log('=== Summary ===');
  console.log('Destroyed: 3 wrong-sized OpenClaw droplets (2GB)');
  console.log('Created: 3 new OpenClaw droplets (4GB)');
  console.log('\n✅ Pool now has 5 Nanobot (2GB) + 5 OpenClaw (4GB) = 10 total');
}

main().catch(console.error);
