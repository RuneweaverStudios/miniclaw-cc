import 'dotenv/config';
import { destroyDroplet, provisionDroplet } from '../src/services/provisioner.js';
import { redis } from '../src/lib/redis.js';

async function main() {
  console.log('=== Recreating All Droplets with Correct Sizes ===\n');

  // Step 1: Get all current droplets from pool
  const serverKeys = await redis.keys('pool:server:id:*');
  const dropletIds = serverKeys.map(key => parseInt(key.split(':')[3]));

  console.log(`Step 1: Destroying ${dropletIds.length} existing droplets...`);

  for (const dropletId of dropletIds) {
    try {
      console.log(`  Destroying droplet ${dropletId}...`);
      await destroyDroplet(dropletId);
      console.log(`  ✅ Destroyed`);
    } catch (error) {
      console.log(`  ⚠️  Error: ${error}`);
    }
  }

  // Step 2: Clear pool state
  console.log('\nStep 2: Clearing pool state...');
  await redis.flushdb();
  console.log('  ✅ Pool cleared');

  // Step 3: Create 5 Nanobot droplets (2GB)
  console.log('\nStep 3: Creating 5 Nanobot droplets (s-1vcpu-2gb)...');

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

  // Step 4: Create 5 OpenClaw droplets (4GB)
  console.log('Step 4: Creating 5 OpenClaw droplets (s-2vcpu-4gb)...');

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
  console.log(`Destroyed: ${dropletIds.length} droplets`);
  console.log(`Created Nanobot (2GB): ${nanobotDroplets.length} droplets`);
  console.log(`Created OpenClaw (4GB): ${openclawDroplets.length} droplets`);
  console.log(`\nTotal: ${nanobotDroplets.length + openclawDroplets.length} droplets`);
  console.log('\nNew Nanobot droplets:');
  nanobotDroplets.forEach(d => console.log(`  - ${d.dropletName} (${d.ipAddress})`));
  console.log('\nNew OpenClaw droplets:');
  openclawDroplets.forEach(d => console.log(`  - ${d.dropletName} (${d.ipAddress})`));

  console.log('\n✅ All droplets recreated with correct sizes!');
}

main().catch(console.error);
