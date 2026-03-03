/**
 * Remove all allocations and BullMQ jobs from the database and Redis.
 * - DB: deletes user_servers, allocations; sets pool_servers.allocated_to to null.
 * - Redis: obliterates all BullMQ queues (provision, destroy, health-checks, backups, reclaims, install-openclaw, install-nanobot) and deletes the "allocations" hash.
 *
 * Requires DATABASE_URL and Redis (REDIS_HOST/REDIS_PORT or REDIS_URL).
 * Run: cd apps/api && pnpm exec tsx clear-allocations-and-jobs.ts
 * Or:   pnpm --filter @miniclaw/api clear-allocations-and-jobs
 */
import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { getDb } from './src/lib/db/index.js';
import { userServers, allocations, poolServers } from './src/db/schema.js';
import { getRedis } from './src/lib/redis.js';
import {
  getProvisionQueue,
  getDestroyQueue,
  getHealthCheckQueue,
  getBackupQueue,
  getReclaimQueue,
  getInstallOpenClawQueue,
  getInstallNanobotQueue,
} from './src/lib/queue.js';

async function clearDb() {
  const db = getDb();
  console.log('Clearing DB allocations and user_servers...');

  await db.delete(userServers);
  console.log('  ✓ user_servers');

  await db.delete(allocations);
  console.log('  ✓ allocations');

  await db.update(poolServers).set({ allocatedTo: null }).where(sql`1=1`);
  console.log('  ✓ pool_servers.allocated_to set to null');
}

async function clearRedisJobs() {
  const redis = getRedis();

  // Delete the allocations hash used by allocator
  await redis.del('allocations');
  console.log('  ✓ Redis key "allocations"');

  const queues = [
    getProvisionQueue(),
    getDestroyQueue(),
    getHealthCheckQueue(),
    getBackupQueue(),
    getReclaimQueue(),
    getInstallOpenClawQueue(),
    getInstallNanobotQueue(),
  ];

  for (const queue of queues) {
    const name = queue.name;
    try {
      await queue.obliterate({ force: true });
      console.log(`  ✓ queue "${name}"`);
    } catch (err) {
      console.warn(`  ⚠ queue "${name}":`, (err as Error).message);
    }
  }
}

async function main() {
  console.log('Removing all allocations and jobs...\n');

  try {
    await clearDb();
  } catch (err) {
    console.error('DB error:', err);
    process.exitCode = 1;
  }

  console.log('\nClearing Redis jobs...');
  try {
    await clearRedisJobs();
  } catch (err) {
    console.error('Redis error:', err);
    process.exitCode = 1;
  }

  console.log('\nDone.');
}

main();
