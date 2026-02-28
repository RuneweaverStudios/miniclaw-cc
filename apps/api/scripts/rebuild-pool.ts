import { redis } from '../src/lib/redis.js';
import type { PoolServerConfig } from '@miniclaw/shared';

async function main() {
  console.log('=== Rebuilding Pool with Correct 10 Droplets ===\n');

  // Clear existing pool
  await redis.flushdb();
  console.log('✅ Redis cleared\n');

  const droplets = [
    // 5 Nanobot droplets (s-1vcpu-2gb)
    { dropletId: 554969181, ipAddress: '137.184.136.154', stack: 'nanobot', size: 's-1vcpu-2gb' },
    { dropletId: 554969251, ipAddress: '206.189.189.217', stack: 'nanobot', size: 's-1vcpu-2gb' },
    { dropletId: 554969338, ipAddress: '143.244.149.194', stack: 'nanobot', size: 's-1vcpu-2gb' },
    { dropletId: 554969381, ipAddress: '137.184.101.64', stack: 'nanobot', size: 's-1vcpu-2gb' },
    { dropletId: 554969412, ipAddress: '167.99.5.249', stack: 'nanobot', size: 's-1vcpu-2gb' },
    // 5 OpenClaw droplets (s-2vcpu-4gb)
    { dropletId: 554969443, ipAddress: '167.172.128.142', stack: 'openclaw', size: 's-2vcpu-4gb' },
    { dropletId: 554969476, ipAddress: '134.122.115.108', stack: 'openclaw', size: 's-2vcpu-4gb' },
    { dropletId: 554969516, ipAddress: '68.183.123.247', stack: 'openclaw', size: 's-2vcpu-4gb' },
    { dropletId: 554969575, ipAddress: '137.184.222.50', stack: 'openclaw', size: 's-2vcpu-4gb' },
    { dropletId: 554969607, ipAddress: '159.203.186.251', stack: 'openclaw', size: 's-2vcpu-4gb' },
  ];

  for (const droplet of droplets) {
    const config: PoolServerConfig = {
      dropletId: droplet.dropletId,
      dropletName: `pool-${droplet.stack}-nyc1-${droplet.dropletId}`,
      ipAddress: droplet.ipAddress,
      region: 'nyc1',
      size: droplet.size,
      stack: droplet.stack,
      state: 'provisioning',
      healthStatus: 'unknown',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await redis.set(`pool:server:id:${droplet.dropletId}`, JSON.stringify(config));
    await redis.set(`pool:server:provisioning:${droplet.dropletId}`, JSON.stringify(config));
    await redis.sadd(`pool:stack:${droplet.stack}`, droplet.dropletId.toString());
    await redis.sadd('pool:region:nyc1', droplet.dropletId.toString());

    console.log(`✅ Added ${droplet.stack} droplet ${droplet.dropletId} (${droplet.ipAddress})`);
  }

  console.log('\n=== Final Pool State ===');
  const nanobotCount = await redis.scard('pool:stack:nanobot');
  const openclawCount = await redis.scard('pool:stack:openclaw');
  const totalCount = await redis.keys('pool:server:id:*');

  console.log(`Nanobot (2GB): ${nanobotCount}`);
  console.log(`OpenClaw (4GB): ${openclawCount}`);
  console.log(`Total: ${totalCount.length}`);
  console.log('\n✅ Pool correctly configured: 5 Nanobot (2GB) + 5 OpenClaw (4GB) = 10 total');
}

main().catch(console.error);
