/**
 * Destroy broken droplets and provision fresh Nanobot ones
 */

import { redis } from '../src/lib/redis.js';
import { poolManager } from '../src/services/pool-manager.js';

const brokenDroplets = [
  555002477, 555002683, 555003020, 555003348, 555003531
];

async function destroyDroplet(dropletId: number) {
  const DIGITALOCEAN_TOKEN = process.env.DIGITALOCEAN_TOKEN;
  const response = await fetch(`https://api.digitalocean.com/v2/droplets/${dropletId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${DIGITALOCEAN_TOKEN}` },
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || `Failed to destroy droplet ${dropletId}`);
  }
  console.log(`  ✅ Destroyed droplet ${dropletId}`);
}

async function main() {
  const DIGITALOCEAN_TOKEN = process.env.DIGITALOCEAN_TOKEN;
  if (!DIGITALOCEAN_TOKEN) {
    console.error('❌ DIGITALOCEAN_TOKEN required');
    process.exit(1);
  }

  console.log('🗑️  Destroying broken OpenClaw droplets...');
  for (const id of brokenDroplets) {
    try {
      await destroyDroplet(id);
      await redis.del(`pool:server:id:${id}`);
      await redis.del(`pool:server:testing:${id}`);
      await redis.del(`pool:server:error:${id}`);
    } catch (error) {
      console.error(`  ⚠️  ${id}: ${(error as Error).message}`);
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\n✅ Destroyed all broken droplets');
  console.log('🔄 The replenisher will now create fresh Nanobot droplets');
  console.log('   Nanobot uses Python/pip which is more reliable than Node.js apt packages');

  // Trigger replenishment for nanobot only
  await poolManager.replenish('nanobot');

  console.log('\n📊 Monitor: tail -f /tmp/miniclaw-api.log');
  process.exit(0);
}

main();
