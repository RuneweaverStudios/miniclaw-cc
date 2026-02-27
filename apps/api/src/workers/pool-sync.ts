/**
 * Pool Sync Worker - Periodically syncs pool state with DigitalOcean
 *
 * This ensures the pool doesn't have stale entries for destroyed droplets
 */

import { createWorker } from "../lib/queue.js";
import { poolManager } from "../services/pool-manager.js";

/**
 * Sync pool state with DigitalOcean API
 * Removes droplets from pool that no longer exist
 */
async function syncPoolWithDigitalOcean(): Promise<void> {
  try {
    const token = process.env.DIGITALOCEAN_TOKEN;
    if (!token) {
      console.warn("[PoolSync] No DIGITALOCEAN_TOKEN configured, skipping sync");
      return;
    }

    // Get all droplets from DigitalOcean
    console.log("[PoolSync] Fetching droplets from DigitalOcean...");
    const response = await fetch("https://api.digitalocean.com/v2/droplets?per_page=200", {
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.error("[PoolSync] Failed to fetch droplets from DO:", response.status);
      return;
    }

    const data = await response.json();
    const activeDropletIds = new Set(
      data.droplets.map((d: any) => d.id)
    );

    console.log(`[PoolSync] Found ${activeDropletIds.size} active droplets on DigitalOcean`);

    // Get all pool servers
    const poolServers = await poolManager.getServers();
    let removedCount = 0;

    for (const server of poolServers) {
      if (!activeDropletIds.has(server.dropletId)) {
        console.warn(`[PoolSync] Droplet ${server.dropletId} (${server.ipAddress}) no longer exists, removing from pool`);
        await poolManager.removeServer(server.dropletId);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(`[PoolSync] Removed ${removedCount} dead droplets from pool`);
    } else {
      console.log("[PoolSync] Pool sync complete - all droplets verified");
    }

    // Log pool metrics
    const metrics = await poolManager.getMetrics();
    console.log(`[PoolSync] Pool metrics: ${metrics.standbyServers} standby, ${metrics.provisioningServers} provisioning, ${metrics.allocatedServers} allocated`);

  } catch (error) {
    console.error("[PoolSync] Error syncing pool with DigitalOcean:", error);
  }
}

/**
 * Start pool sync worker
 */
export async function startPoolSyncWorker(): Promise<void> {
  console.log("[PoolSync] Starting pool sync worker...");

  const worker = createWorker(
    "pool-sync",
    async () => {
      await syncPoolWithDigitalOcean();
    },
    { concurrency: 1 }
  );

  // Handle worker events
  worker.on("completed", (job) => {
    console.log(`[PoolSync] Sync job ${job.id} completed`);
  });

  worker.on("failed", (job, error) => {
    console.error(`[PoolSync] Sync job ${job?.id} failed:`, error);
  });

  // Add recurring sync job (every 5 minutes)
  const { Queue } = await import("bullmq");
  const { getRedis } = await import("../lib/redis.js");

  const syncQueue = new Queue("pool-sync", {
    connection: {
      host: getRedis().options.host || "localhost",
      port: getRedis().options.port || 6379,
      db: getRedis().options.db || 0,
      password: getRedis().options.password,
      maxRetriesPerRequest: null,
    },
  });

  // Add recurring job
  syncQueue.add(
    "sync",
    {},
    {
      repeat: {
        every: 300000, // Every 5 minutes
      },
      jobId: "periodic-sync",
    }
  );

  console.log("[PoolSync] Pool sync worker started (syncs every 5 minutes)");
}

/**
 * Stop pool sync worker
 */
export async function stopPoolSyncWorker(): Promise<void> {
  const { Queue } = await import("bullmq");
  const { getRedis } = await import("../lib/redis.js");

  const syncQueue = new Queue("pool-sync", {
    connection: {
      host: getRedis().options.host || "localhost",
      port: getRedis().options.port || 6379,
      db: getRedis().options.db || 0,
      password: getRedis().options.password,
      maxRetriesPerRequest: null,
    },
  });

  // Remove recurring job
  await syncQueue.removeRepeatable("sync", {});

  console.log("[PoolSync] Stopped pool sync worker");
}

/**
 * Manual sync trigger (for testing or immediate sync)
 */
export async function triggerPoolSync(): Promise<void> {
  console.log("[PoolSync] Triggering manual pool sync...");
  await syncPoolWithDigitalOcean();
}
