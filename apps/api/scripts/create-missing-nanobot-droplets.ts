import 'dotenv/config';
import { provisionDroplet } from '../src/services/provisioner.js';
import { poolManager } from '../src/services/pool-manager.js';

async function main() {
  console.log('=== Creating 3 Missing Nanobot Droplets ===\n');

  const newDroplets = [];
  for (let i = 0; i < 3; i++) {
    try {
      console.log(`[${i + 1}/3] Creating new Nanobot droplet...`);

      const result = await provisionDroplet({
        stack: 'nanobot',
        region: 'nyc1',
        size: 's-1vcpu-1gb',
        version: '0.1.3.post7',
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
        stack: 'nanobot',
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
  console.log(`Created: ${newDroplets.length} Nanobot droplets`);
  console.log('\nNew droplets:');
  newDroplets.forEach(d => console.log(`  - ${d.dropletName} (${d.ipAddress})`));
  console.log('\nPool now has 5 Nanobot + 5 OpenClaw = 10 total droplets');
}

main().catch(console.error);
