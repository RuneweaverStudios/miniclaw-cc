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
    const keys = await this.redis.keys("pool:server:*");

    const servers: PoolServerConfig[] = [];
    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        servers.push(JSON.parse(data));
      }
    }

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
    const pattern = state ? `pool:server:${state}:*` : `pool:server:*`;
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
      const timeSinceError = now - server.stateChangedAt.getTime();
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
}

// Singleton instance
export const poolManager = new PoolManager();
