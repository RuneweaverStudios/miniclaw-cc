/**
 * Pool Manager - Core pool orchestration service
 *
 * Manages the standby pool of pre-provisioned servers
 */

import { Redis } from "ioredis";
import { redis } from "../lib/redis.js";
import type { PoolServerConfig, PoolState, PoolMetrics, StackType, HealthStatus } from "@miniclaw/shared";
import { getPoolConfig, generatePoolServerName, REPLENISHMENT_SETTINGS } from "@miniclaw/config";
import { provisionDroplet, destroyDroplet } from "./provisioner.js";
import { allocator } from "./allocator.js";
import { healthChecker } from "./health-check.js";

/**
 * Pool Manager Class
 */
export class PoolManager {
  private redis: Redis;
  private config: ReturnType<typeof getPoolConfig>;

  constructor(redisInstance?: Redis) {
    this.redis = redisInstance || redis;
    this.config = getPoolConfig(process.env.NODE_ENV || "production");
  }

  /**
   * Get current pool metrics
   */
  async getMetrics(): Promise<PoolMetrics> {
    // Use getServers() to avoid duplicate counting
    const servers = await this.getServers();

    const metrics: PoolMetrics = {
      totalServers: servers.length,
      standbyServers: 0,
      allocatedServers: 0,
      provisioningServers: 0,
      testingServers: 0,
      errorServers: 0,
      terminatingServers: 0,
      standbyByStack: { openclaw: 0, nanobot: 0 },
      standbyByRegion: {},
      avgReplenishTime: 0,
      poolHealth: 0,
    };

    for (const server of servers) {
      switch (server.state) {
        case "standby":
          metrics.standbyServers++;
          metrics.standbyByStack[server.stack]++;
          metrics.standbyByRegion[server.region] =
            (metrics.standbyByRegion[server.region] || 0) + 1;
          break;
        case "allocated":
          metrics.allocatedServers++;
          break;
        case "provisioning":
          metrics.provisioningServers++;
          break;
        case "testing":
          metrics.testingServers++;
          break;
        case "error":
          metrics.errorServers++;
          break;
        case "terminating":
          metrics.terminatingServers++;
          break;
      }
    }

    // Calculate pool health
    const healthyServers = servers.filter(
      (s) => s.healthStatus === "healthy" && s.state !== "error"
    ).length;
    metrics.poolHealth = servers.length > 0 ? (healthyServers / servers.length) * 100 : 0;

    // Get average replenish time from Redis
    const replenishTimes = await this.redis.lrange("pool:replenish-times", 0, 9);
    if (replenishTimes.length > 0) {
      const sum = replenishTimes.reduce((acc, t) => acc + Number.parseInt(t), 0);
      metrics.avgReplenishTime = Math.floor(sum / replenishTimes.length);
    }

    return metrics;
  }

  /**
   * Get all servers in pool (optionally filtered by state)
   */
  async getServers(state?: PoolState): Promise<PoolServerConfig[]> {
    // When filtering by state, use state-specific keys
    // When getting all servers, only use id keys to avoid duplicates
    const pattern = state ? `pool:server:${state}:*` : `pool:server:id:*`;
    const keys = await this.redis.keys(pattern);

    const servers: PoolServerConfig[] = [];
    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        servers.push(JSON.parse(data));
      }
    }

    return servers;
  }

  /**
   * Get server by droplet ID
   */
  async getServer(dropletId: number): Promise<PoolServerConfig | null> {
    const key = `pool:server:id:${dropletId}`;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Add server to pool
   */
  async addServer(server: PoolServerConfig): Promise<void> {
    // Store by droplet ID
    const idKey = `pool:server:id:${server.dropletId}`;
    await this.redis.set(idKey, JSON.stringify(server));

    // Store by state
    const stateKey = `pool:server:${server.state}:${server.dropletId}`;
    await this.redis.set(stateKey, JSON.stringify(server));

    // Add to stack index
    await this.redis.sadd(`pool:stack:${server.stack}`, server.dropletId.toString());

    // Add to region index
    await this.redis.sadd(`pool:region:${server.region}`, server.dropletId.toString());

    console.log(`[PoolManager] Added server ${server.dropletId} to pool (${server.state})`);
  }

  /**
   * Update server state
   */
  async updateServerState(
    dropletId: number,
    newState: PoolState,
    healthStatus?: HealthStatus
  ): Promise<void> {
    const server = await this.getServer(dropletId);
    if (!server) {
      throw new Error(`Server ${dropletId} not found in pool`);
    }

    // Remove old state key
    const oldStateKey = `pool:server:${server.state}:${dropletId}`;
    await this.redis.del(oldStateKey);

    // Update server
    server.state = newState;
    server.stateChangedAt = new Date();
    if (healthStatus) {
      server.healthStatus = healthStatus;
    }

    // Add new state key
    const newStateKey = `pool:server:${newState}:${dropletId}`;
    await this.redis.set(newStateKey, JSON.stringify(server));

    // Update by ID
    const idKey = `pool:server:id:${dropletId}`;
    await this.redis.set(idKey, JSON.stringify(server));

    console.log(`[PoolManager] Server ${dropletId}: ${server.state} -> ${newState}`);
  }

  /**
   * Remove server from pool
   */
  async removeServer(dropletId: number): Promise<void> {
    const server = await this.getServer(dropletId);
    if (!server) {
      return;
    }

    // Remove all keys
    await this.redis.del(`pool:server:id:${dropletId}`);
    await this.redis.del(`pool:server:${server.state}:${dropletId}`);
    await this.redis.srem(`pool:stack:${server.stack}`, dropletId.toString());
    await this.redis.srem(`pool:region:${server.region}`, dropletId.toString());

    console.log(`[PoolManager] Removed server ${dropletId} from pool`);
  }

  /**
   * Check if pool needs replenishment
   *
   * For specific stack: checks if that stack is below threshold
   * For general: checks if total pool is below minimum
   */
  async needsReplenishment(stack?: StackType): Promise<boolean> {
    const metrics = await this.getMetrics();
    const perStackTarget = Math.ceil(this.config.targetPoolSize / 2);

    if (stack) {
      const standby = metrics.standbyByStack[stack];
      const threshold = Math.floor(perStackTarget * REPLENISHMENT_SETTINGS.thresholdRatio);
      return standby < threshold;
    }

    // For general replenishment, check if either stack is below threshold
    for (const s of ["openclaw", "nanobot"] as StackType[]) {
      const standby = metrics.standbyByStack[s];
      const threshold = Math.floor(perStackTarget * REPLENISHMENT_SETTINGS.thresholdRatio);
      if (standby < threshold) {
        return true;
      }
    }

    return metrics.standbyServers < this.config.minPoolSize;
  }

  /**
   * Replenish pool
   *
   * Provisions equal numbers of nanobot and openclaw servers
   * Target pool size is divided equally between the two stacks
   */
  async replenish(stack?: StackType): Promise<void> {
    if (!this.config.autoReplenish) {
      console.log("[PoolManager] Auto-replenish is disabled");
      return;
    }

    const metrics = await this.getMetrics();

    // Check cooldown
    const lastReplenish = await this.redis.get("pool:last-replenish");
    if (lastReplenish) {
      const elapsed = Date.now() - Number.parseInt(lastReplenish);
      if (elapsed < REPLENISHMENT_SETTINGS.cooldownMs) {
        console.log("[PoolManager] Replenish cooldown active");
        return;
      }
    }

    // Check if we need to replenish
    if (!this.needsReplenishment(stack)) {
      return;
    }

    console.log(`[PoolManager] Starting replenishment${stack ? ` for ${stack}` : ""}`);

    // Calculate per-stack target (divide total target equally)
    const perStackTarget = Math.ceil(this.config.targetPoolSize / 2);
    const batchSize = this.config.replenishBatchSize;

    // If specific stack requested, only provision that stack
    if (stack) {
      const needed = Math.min(batchSize, perStackTarget - metrics.standbyByStack[stack]);
      if (needed > 0) {
        await this.provisionServers(stack, needed);
      }
    } else {
      // Provision both stacks to maintain equal numbers
      const stacks: StackType[] = ["openclaw", "nanobot"];
      for (const s of stacks) {
        const needed = Math.min(
          Math.ceil(batchSize / 2), // Split batch between stacks
          perStackTarget - metrics.standbyByStack[s]
        );

        if (needed > 0) {
          await this.provisionServers(s, needed);
        }
      }
    }

    await this.redis.set("pool:last-replenish", Date.now().toString());
  }

  /**
   * Provision new servers
   */
  private async provisionServers(stack: StackType, count: number): Promise<void> {
    const startTime = Date.now();

    console.log(`[PoolManager] Provisioning ${count} ${stack} servers`);

    const regions = this.config.regions;
    const size = this.config.defaultSize;

    for (let i = 0; i < count; i++) {
      const region = regions[i % regions.length];

      try {
        const droplet = await provisionDroplet({
          stack,
          region,
          size,
          version: "latest",
        });

        const server: PoolServerConfig = {
          dropletId: droplet.dropletId,
          dropletName: droplet.dropletName,
          state: "provisioning",
          stack,
          region,
          size,
          ipAddress: droplet.ipAddress,
          sshPort: 22,
          createdAt: new Date(),
          stateChangedAt: new Date(),
          healthStatus: "unknown",
          healthCheckFailures: 0,
          stackVersion: "latest",
        };

        await this.addServer(server);

        // Queue installation job
        await this.queueInstallJob(server);

      } catch (error) {
        console.error(`[PoolManager] Failed to provision ${stack} server:`, error);
      }
    }

    const elapsed = Date.now() - startTime;
    await this.redis.lpush("pool:replenish-times", elapsed.toString());
    await this.redis.ltrim("pool:replenish-times", 0, 9);

    console.log(`[PoolManager] Provisioned ${count} ${stack} servers in ${elapsed}ms`);
  }

  /**
   * Queue installation job for a server
   */
  private async queueInstallJob(server: PoolServerConfig): Promise<void> {
    const { getInstallOpenClawQueue, getInstallNanobotQueue } = await import("../lib/queue.js");

    const queue = server.stack === "openclaw" ? getInstallOpenClawQueue() : getInstallNanobotQueue();

    await queue.add(
      {
        dropletId: server.dropletId,
        ipAddress: server.ipAddress,
        stack: server.stack,
        version: server.stackVersion,
      },
      {
        jobId: `install-${server.dropletId}`,
      }
    );
  }

  /**
   * Cleanup unhealthy servers
   */
  async cleanupUnhealthy(): Promise<void> {
    const servers = await this.getServers("error");
    const now = Date.now();

    for (const server of servers) {
      const changedAt = server.stateChangedAt instanceof Date
        ? server.stateChangedAt.getTime()
        : new Date((server.stateChangedAt as string) || 0).getTime();
      const timeSinceError = now - changedAt;
      const errorThreshold = 30 * 60 * 1000; // 30 minutes

      if (timeSinceError > errorThreshold) {
        console.log(`[PoolManager] Removing unhealthy server ${server.dropletId}`);

        try {
          await destroyDroplet(server.dropletId);
          await this.removeServer(server.dropletId);
        } catch (error) {
          console.error(`[PoolManager] Failed to cleanup server ${server.dropletId}:`, error);
        }
      }
    }
  }

  /**
   * Reconcile pool to target size by removing excess servers
   *
   * Strategy:
   * 1. Remove servers with unhealthy/pending health status first
   * 2. Remove allocated servers that are past their trial period
   * 3. Remove oldest standby servers (by stateChangedAt)
   * 4. Balance between stacks to maintain equal distribution
   *
   * @param dryRun - Log what would be removed without actually removing
   * @returns Summary of removed servers
   */
  async reconcileToTarget(dryRun = false): Promise<{
    removed: Array<{ dropletId: number; dropletName: string; stack: string; reason: string }>;
    nanobotCount: number;
    openclawCount: number;
    totalCount: number;
  }> {
    const targetTotal = this.config.targetPoolSize;
    const targetPerStack = Math.ceil(targetTotal / 2);

    const removed: Array<{ dropletId: number; dropletName: string; stack: string; reason: string }> = [];

    // Get all servers
    const allServers = await this.getServers();

    // Count by stack and state
    const nanobotServers = allServers.filter(s => s.stack === 'nanobot');
    const openclawServers = allServers.filter(s => s.stack === 'openclaw');

    // Determine excess by stack
    const nanobotExcess = Math.max(0, nanobotServers.length - targetPerStack);
    const openclawExcess = Math.max(0, openclawServers.length - targetPerStack);

    const totalExcess = nanobotExcess + openclawExcess;

    if (totalExcess === 0) {
      console.log(`[PoolManager] Pool is at target size (${allServers.length}/${targetTotal})`);
      return {
        removed: [],
        nanobotCount: nanobotServers.length,
        openclawCount: openclawServers.length,
        totalCount: allServers.length,
      };
    }

    console.log(`[PoolManager] Reconciling pool: ${allServers.length} → ${targetTotal} (excess: ${totalExcess})`);
    console.log(`[PoolManager] Nanobots: ${nanobotServers.length}/${targetPerStack} (excess: ${nanobotExcess})`);
    console.log(`[PoolManager] OpenClaws: ${openclawServers.length}/${targetPerStack} (excess: ${openclawExcess})`);

    // Helper to sort servers by removal priority
    const sortByRemovalPriority = (servers: typeof allServers) => {
      return servers.sort((a, b) => {
        // Priority 1: Unhealthy or pending health (remove first)
        const aPriority = a.healthStatus === 'healthy' ? 0 : 1;
        const bPriority = b.healthStatus === 'healthy' ? 0 : 1;
        if (aPriority !== bPriority) return bPriority - aPriority;

        // Priority 2: Allocated vs standby (prefer keeping standby)
        const aStatePriority = a.state === 'standby' ? 0 : 1;
        const bStatePriority = b.state === 'standby' ? 0 : 1;
        if (aStatePriority !== bStatePriority) return bStatePriority - aStatePriority;

        // Priority 3: Oldest first (by stateChangedAt)
        // Handle both Date objects and ISO strings
        const aTime = a.stateChangedAt instanceof Date
          ? a.stateChangedAt.getTime()
          : new Date(a.stateChangedAt).getTime();
        const bTime = b.stateChangedAt instanceof Date
          ? b.stateChangedAt.getTime()
          : new Date(b.stateChangedAt).getTime();
        return aTime - bTime;
      });
    };

    // Remove excess nanobots
    if (nanobotExcess > 0) {
      const sortedNanobots = sortByRemovalPriority(nanobotServers);
      const toRemove = sortedNanobots.slice(0, nanobotExcess);

      for (const server of toRemove) {
        const reason = server.healthStatus !== 'healthy'
          ? `unhealthy (${server.healthStatus})`
          : server.state !== 'standby'
            ? `state: ${server.state}`
            : 'oldest standby server';

        console.log(`[PoolManager] ${dryRun ? '[DRY RUN] Would remove' : 'Removing'} nanobot ${server.dropletId} (${server.dropletName}) - ${reason}`);

        if (!dryRun) {
          try {
            await this.removeServer(server.dropletId);
            // Don't destroy the droplet, just remove from pool
            // User can manually destroy droplets via DO dashboard
          } catch (error) {
            console.error(`[PoolManager] Failed to remove server ${server.dropletId}:`, error);
          }
        }

        removed.push({
          dropletId: server.dropletId,
          dropletName: server.dropletName,
          stack: server.stack,
          reason,
        });
      }
    }

    // Remove excess openclaws
    if (openclawExcess > 0) {
      const sortedOpenclaws = sortByRemovalPriority(openclawServers);
      const toRemove = sortedOpenclaws.slice(0, openclawExcess);

      for (const server of toRemove) {
        const reason = server.healthStatus !== 'healthy'
          ? `unhealthy (${server.healthStatus})`
          : server.state !== 'standby'
            ? `state: ${server.state}`
            : 'oldest standby server';

        console.log(`[PoolManager] ${dryRun ? '[DRY RUN] Would remove' : 'Removing'} openclaw ${server.dropletId} (${server.dropletName}) - ${reason}`);

        if (!dryRun) {
          try {
            await this.removeServer(server.dropletId);
          } catch (error) {
            console.error(`[PoolManager] Failed to remove server ${server.dropletId}:`, error);
          }
        }

        removed.push({
          dropletId: server.dropletId,
          dropletName: server.dropletName,
          stack: server.stack,
          reason,
        });
      }
    }

    // Get final counts
    const finalServers = await this.getServers();
    const finalNanobots = finalServers.filter(s => s.stack === 'nanobot').length;
    const finalOpenclaws = finalServers.filter(s => s.stack === 'openclaw').length;

    console.log(`[PoolManager] Reconciliation complete: ${finalServers.length}/${targetTotal} (${removed.length} removed)`);

    return {
      removed,
      nanobotCount: finalNanobots,
      openclawCount: finalOpenclaws,
      totalCount: finalServers.length,
    };
  }
}

// Singleton instance
export const poolManager = new PoolManager();
