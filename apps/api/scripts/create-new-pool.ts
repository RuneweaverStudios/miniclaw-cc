import 'dotenv/config';
import { provisionDroplet } from '../src/services/provisioner.js';

async function main() {
  console.log('=== Creating New Pool with Correct Sizes ===\n');

  // Step 1: Create 5 Nanobot droplets (2GB)
  console.log('Step 1: Creating 5 Nanobot droplets (s-1vcpu-2gb)...\n');

  const nanobotDroplets = [];
  for (let i = 0; i < 5; i++) {
    try {
      console.log(`[${i + 1}/5] Creating Nanobot droplet...`);

      const result = await provisionDroplet({
        stack: 'nanobot',
        region: 'nyc1',
        size: 's-1vcpu-2gb',
        version: '0.1.3.post7',
      });

      console.log(`  ✅ Created: ${result.dropletName} (${result.ipAddress})`);
      nanobotDroplets.push(result);

      // Add to pool
      const { poolManager } = await import('../src/services/pool-manager.js');
      await poolManager.addServer({
        dropletId: result.dropletId,
        dropletName: result.dropletName,
        ipAddress: result.ipAddress,
        region: 'nyc1',
        size: 's-1vcpu-2gb',
        stack: 'nanobot',
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

  // Step 2: Create 5 OpenClaw droplets (4GB)
  console.log('Step 2: Creating 5 OpenClaw droplets (s-2vcpu-4gb)...\n');

  const openclawDroplets = [];
  for (let i = 0; i < 5; i++) {
    try {
      console.log(`[${i + 1}/5] Creating OpenClaw droplet...`);

      const result = await provisionDroplet({
        stack: 'openclaw',
        region: 'nyc1',
        size: 's-2vcpu-4gb',
        version: 'latest',
      });

      console.log(`  ✅ Created: ${result.dropletName} (${result.ipAddress})`);
      openclawDroplets.push(result);

      // Add to pool
      const { poolManager } = await import('../src/services/pool-manager.js');
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
  console.log(`Created Nanobot (2GB): ${nanobotDroplets.length} droplets`);
  console.log(`Created OpenClaw (4GB): ${openclawDroplets.length} droplets`);
  console.log(`\nTotal: ${nanobotDroplets.length + openclawDroplets.length} droplets`);
  console.log('\nNew Nanobot droplets:');
  nanobotDroplets.forEach(d => console.log(`  - ${d.dropletName} (${d.ipAddress})`));
  console.log('\nNew OpenClaw droplets:');
  openclawDroplets.forEach(d => console.log(`  - ${d.dropletName} (${d.ipAddress})`));

  console.log('\n✅ All droplets created with correct sizes!');
  console.log('Note: OpenClaw will be installed via cloud-init with --no-prompt --no-onboard');
}

main().catch(console.error);
