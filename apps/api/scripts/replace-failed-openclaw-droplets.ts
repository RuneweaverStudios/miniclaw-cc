import 'dotenv/config';
import { provisionDroplet, destroyDroplet } from '../src/services/provisioner.js';
import { poolManager } from '../src/services/pool-manager.js';
import { openclawService } from '../src/services/openclaw.js';

// Failed droplets to delete and replace
const failedDroplets = [
  { dropletId: 554936340, ipAddress: '143.244.175.18' },
  { dropletId: 554936460, ipAddress: '134.209.71.67' },
  { dropletId: 554936508, ipAddress: '134.209.218.72' },
  { dropletId: 554937449, ipAddress: '162.243.162.24' },
];

async function main() {
  console.log('=== Replacing 4 Failed OpenClaw Droplets ===\n');

  // Step 1: Destroy failed droplets
  console.log('Step 1: Destroying failed droplets...');
  for (const droplet of failedDroplets) {
    try {
      console.log(`  Destroying droplet ${droplet.dropletId} (${droplet.ipAddress})...`);
      await destroyDroplet(droplet.dropletId);
      console.log(`  ✅ Destroyed`);
    } catch (error) {
      console.log(`  ⚠️  Error: ${error}`);
    }
  }

  console.log('\nStep 2: Creating 4 new OpenClaw droplets with non-interactive install...\n');

  // Step 2: Create 4 new droplets
  const newDroplets = [];
  for (let i = 0; i < 4; i++) {
    try {
      console.log(`[${i + 1}/4] Creating new OpenClaw droplet...`);

      const result = await provisionDroplet({
        stack: 'openclaw',
        region: 'nyc1',
        size: 's-1vcpu-1gb',
        version: 'latest',
      });

      console.log(`  ✅ Created: ${result.dropletName} (${result.ipAddress})`);

      newDroplets.push(result);

      // Add to pool in provisioning state
      await poolManager.addServer({
        dropletId: result.dropletId,
        dropletName: result.dropletName,
        ipAddress: result.ipAddress,
        region: 'nyc1',
        size: 's-1vcpu-1gb',
        stack: 'openclaw',
        state: 'provisioning',
        healthStatus: 'unknown',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      console.log(`  ✅ Added to pool in provisioning state\n`);

    } catch (error) {
      console.log(`  ❌ Error: ${error}\n`);
    }
  }

  console.log('=== Summary ===');
  console.log(`Destroyed: ${failedDroplets.length} droplets`);
  console.log(`Created: ${newDroplets.length} droplets`);
  console.log('\nNew droplets:');
  newDroplets.forEach(d => console.log(`  - ${d.dropletName} (${d.ipAddress})`));
  console.log('\nNote: OpenClaw is being installed via cloud-init. Check logs with:');
  console.log('  ssh root@<ip> "cloud-init status; journalctl -u cloud-final"');
}

main().catch(console.error);
