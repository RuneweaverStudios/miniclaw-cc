/**
 * Pool Sync Worker - Periodically syncs pool state with DigitalOcean
 *
 * This ensures the pool doesn't have stale entries for destroyed droplets
 * and adds new droplets that are in DO but missing from Redis
 */

import { createWorker } from "../lib/queue.js";
import { poolManager } from "../services/pool-manager.js";

/**
 * Sync pool state with DigitalOcean API
 * Adds missing droplets and removes droplets that no longer exist
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
    const allDroplets = data.droplets || [];

    // Filter to pool droplets only
    const poolDroplets = allDroplets.filter((d: any) =>
      (d.tags && d.tags.includes("pool")) ||
      (d.tags && d.tags.includes("pool-server")) ||
      (d.name && d.name.includes("pool-"))
    );

    const activeDropletIds = new Set(poolDroplets.map((d: any) => d.id));
    const poolServerIds = new Set((await poolManager.getServers()).map((s) => s.dropletId));

    console.log(`[PoolSync] Found ${poolDroplets.length} pool droplets on DigitalOcean`);

    // Remove dead droplets from pool
    let removedCount = 0;
    for (const server of await poolManager.getServers()) {
      if (!activeDropletIds.has(server.dropletId)) {
        console.warn(`[PoolSync] Droplet ${server.dropletId} (${server.ipAddress}) no longer exists, removing from pool`);
        await poolManager.removeServer(server.dropletId);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(`[PoolSync] Removed ${removedCount} dead droplets from pool`);
    }

    // Add missing droplets to pool
    let addedCount = 0;
    for (const droplet of poolDroplets) {
      if (!poolServerIds.has(droplet.id)) {
        const ip = droplet.networks?.v4?.find((n: any) => n.type === "public")?.ip_address;
        if (!ip) {
          console.warn(`[PoolSync] Droplet ${droplet.id} (${droplet.name}) has no public IP, skipping`);
          continue;
        }

        // Determine stack from tags/name
        const isOpenClaw = (droplet.tags && droplet.tags.includes("openclaw")) ||
                           (droplet.name && droplet.name.includes("openclaw"));
        const stack: "nanobot" | "openclaw" = isOpenClaw ? "openclaw" : "nanobot";
        const stackVersion = stack === "nanobot" ? "0.1.3.post7" : "1.0.0";

        // Determine state from status
        const state = droplet.status === "active" ? "standby" : "provisioning";

        await poolManager.addServer({
          dropletId: droplet.id,
          dropletName: droplet.name,
          ipAddress: ip,
          region: droplet.region?.slug || "nyc1",
          size: droplet.size?.slug || "s-1vcpu-1gb",
          stack,
          stackVersion,
          state,
          healthStatus: "unknown",
          stateChangedAt: new Date(droplet.created_at),
          config: {
            monitoringEnabled: false,
            alertsEnabled: false,
            backupEnabled: false,
          },
        });

        console.log(`[PoolSync] Added droplet ${droplet.id} (${droplet.name}) to pool as ${state}`);
        addedCount++;
      }
    }

    if (addedCount > 0) {
      console.log(`[PoolSync] Added ${addedCount} missing droplets to pool`);
    }

    if (removedCount === 0 && addedCount === 0) {
      console.log("[PoolSync] Pool sync complete - all droplets verified");
    }

    // Log pool metrics
    const metrics = await poolManager.getMetrics();
    console.log(`[PoolSync] Pool metrics: ${metrics.standbyServers} standby, ${metrics.provisioningServers} provisioning, ${metrics.allocatedServers} allocated`);

    // Reconcile pool to target size (remove excess servers)
    console.log("[PoolSync] Reconciling pool to target size...");
    const reconcileResult = await poolManager.reconcileToTarget();
    if (reconcileResult.removed.length > 0) {
      console.log(`[PoolSync] Reconciled pool: removed ${reconcileResult.removed.length} excess servers`);
    }

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
