/**
 * Allocator - Server allocation service with distributed locking
 *
 * Handles allocating servers from the standby pool to users
 */

import { Redis } from "ioredis";
import type { PoolServerConfig, StackType } from "@miniclaw/shared";
import { poolManager } from "./pool-manager.js";
import { redis } from "../lib/redis.js";
import { randomBytes } from "crypto";
import { openrouterService } from "./openrouter.js";
import { db } from "../lib/db/index.js";
import { userServers } from "../db/schema.js";

/**
 * Allocation request
 */
export interface AllocationRequest {
  userId: string;
  stack: StackType;
  region?: string;
  hostname?: string;
}

/**
 * Allocation result
 */
export interface AllocationResult {
  success: boolean;
  server?: PoolServerConfig;
  allocatedAt: Date;
  reason?: string;
}

/**
 * Allocator class
 */
export class Allocator {
  private redis: Redis;
  private lockTimeout = 30000; // 30 seconds

  constructor(redisClient?: Redis) {
    this.redis = redisClient || redis;
  }

  /**
   * Allocate a server to a user
   */
  async allocate(request: AllocationRequest): Promise<AllocationResult> {
    const { userId, stack, region } = request;
    const lockKey = `pool:allocate:${stack}:${region || "any"}`;
    const lockValue = randomBytes(16).toString("hex");

    console.log(`[Allocator] Allocating ${stack} server to user ${userId}`);

    // Acquire distributed lock
    const lock = await this.acquireLock(lockKey, lockValue);

    if (!lock) {
      return {
        success: false,
        allocatedAt: new Date(),
        reason: "Could not acquire allocation lock (try again)",
      };
    }

    try {
      // STEP 1: Scan and sync pool with DigitalOcean before allocation
      console.log(`[Allocator] Scanning pool to verify droplets before allocation...`);
      const removedCount = await this.syncPoolWithDigitalOcean();
      if (removedCount > 0) {
        console.log(`[Allocator] Removed ${removedCount} dead droplets from pool`);
      }

      // STEP 2: Find available server from verified pool
      const server = await this.findAvailableServer(stack, region);

      if (!server) {
        return {
          success: false,
          allocatedAt: new Date(),
          reason: "No servers available in standby pool (after verifying droplet status)",
        };
      }

      // STEP 3: Final verification - double-check droplet exists before allocating
      const exists = await this.verifyDropletExists(server.dropletId);
      if (!exists) {
        console.warn(`[Allocator] Droplet ${server.dropletId} no longer exists, removing from pool`);
        await poolManager.removeServer(server.dropletId);
        return {
          success: false,
          allocatedAt: new Date(),
          reason: "Selected droplet no longer exists, please try again",
        };
      }

      // Update server state
      await poolManager.updateServerState(server.dropletId, "allocated");

      // Update server with user info
      server.allocatedTo = userId;
      server.state = "allocated";
      server.stateChangedAt = new Date();

      await poolManager.addServer(server);

      // Record allocation in database and Redis
      await this.recordAllocation(userId, server.dropletId, server);

      // Create OpenRouter API key for this droplet
      try {
        const openrouterKey = await openrouterService.createDropletKey(server.dropletId);
        console.log(`[Allocator] Created OpenRouter key ${openrouterKey} for droplet ${server.dropletId}`);

        // Store the key in the server config for retrieval
        server.config = {
          ...server.config,
          openrouterKey,
        };
      } catch (error) {
        console.error(`[Allocator] Failed to create OpenRouter key for droplet ${server.dropletId}:`, error);
        // Don't fail allocation if OpenRouter key creation fails
      }

      console.log(`[Allocator] Allocated server ${server.dropletId} to user ${userId}`);

      return {
        success: true,
        server,
        allocatedAt: new Date(),
      };

    } finally {
      // Release lock
      await this.releaseLock(lockKey, lockValue);
    }
  }

  /**
   * Sync pool state with DigitalOcean API
   * Removes droplets from pool that no longer exist
   */
  private async syncPoolWithDigitalOcean(): Promise<number> {
    try {
      const token = process.env.DIGITALOCEAN_TOKEN;
      if (!token) {
        console.warn("[Allocator] No DIGITALOCEAN_TOKEN configured, skipping sync");
        return 0;
      }

      // Get all droplets from DigitalOcean
      const response = await fetch("https://api.digitalocean.com/v2/droplets?per_page=200", {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.error("[Allocator] Failed to fetch droplets from DO:", response.status);
        return 0;
      }

      const data = await response.json();
      const activeDropletIds = new Set(
        data.droplets.map((d: any) => d.id)
      );

      // Get all pool servers
      const poolServers = await poolManager.getServers();
      let removedCount = 0;

      for (const server of poolServers) {
        if (!activeDropletIds.has(server.dropletId)) {
          console.warn(`[Allocator] Droplet ${server.dropletId} (${server.ipAddress}) no longer exists, removing from pool`);
          await poolManager.removeServer(server.dropletId);
          removedCount++;
        }
      }

      return removedCount;
    } catch (error) {
      console.error("[Allocator] Error syncing pool with DigitalOcean:", error);
      return 0;
    }
  }

  /**
   * Verify a specific droplet exists via DigitalOcean API
   */
  private async verifyDropletExists(dropletId: number): Promise<boolean> {
    try {
      const token = process.env.DIGITALOCEAN_TOKEN;
      if (!token) {
        console.warn("[Allocator] No DIGITALOCEAN_TOKEN configured, assuming droplet exists");
        return true;
      }

      const response = await fetch(`https://api.digitalocean.com/v2/droplets/${dropletId}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (response.status === 404) {
        return false;
      }

      return response.ok;
    } catch (error) {
      console.error(`[Allocator] Error verifying droplet ${dropletId}:`, error);
      // On error, assume it exists to avoid false positives
      return true;
    }
  }

  /**
   * Find available server in standby pool
   */
  private async findAvailableServer(
    stack: StackType,
    region?: string
  ): Promise<PoolServerConfig | null> {
    const servers = await poolManager.getServers("standby");

    // Filter by stack
    const stackServers = servers.filter((s) => s.stack === stack && s.healthStatus === "healthy");

    if (stackServers.length === 0) {
      return null;
    }

    // Prefer requested region
    if (region) {
      const regionalServer = stackServers.find((s) => s.region === region);
      if (regionalServer) {
        return regionalServer;
      }
    }

    // Return least recently allocated server
    const sortedServers = [...stackServers].sort(
      (a, b) => a.stateChangedAt.getTime() - b.stateChangedAt.getTime()
    );

    return sortedServers[0];
  }

  /**
   * Acquire distributed lock
   */
  private async acquireLock(key: string, value: string): Promise<boolean> {
    const result = await this.redis.set(
      key,
      value,
      "PX",
      this.lockTimeout,
      "NX"
    );

    return result === "OK";
  }

  /**
   * Release distributed lock
   */
  private async releaseLock(key: string, value: string): Promise<void> {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    await this.redis.eval(script, 1, key, value);
  }

  /**
   * Record allocation in database and Redis
   */
  private async recordAllocation(userId: string, dropletId: number, server: PoolServerConfig): Promise<void> {
    try {
      // Insert into database
      await db.insert(userServers).values({
        userId,
        dropletId,
        hostname: server.dropletName,
        stack: server.stack,
        stackVersion: server.stackVersion,
        region: server.region,
        size: server.size,
        ipAddress: server.ipAddress,
        sshPort: server.sshPort || 22,
        status: 'active',
        allocatedAt: new Date(),
        healthStatus: server.healthStatus || 'unknown',
        config: server.config || {
          monitoringEnabled: false,
          alertsEnabled: false,
          backupEnabled: false,
          customDomains: [],
          environmentVariables: {},
        },
      });
      console.log(`[Allocator] Recorded allocation in database for droplet ${dropletId}`);
    } catch (error) {
      console.error(`[Allocator] Failed to record allocation in database:`, error);
      // Don't fail allocation if database insert fails
    }

    // Also store in Redis for quick lookup
    await this.redis.hset("allocations", `${userId}:${dropletId}`, Date.now().toString());
  }

  /**
   * Release server back to pool (reclaim)
   */
  async release(dropletId: number, returnToPool = true): Promise<void> {
    const server = await poolManager.getServer(dropletId);

    if (!server) {
      throw new Error(`Server ${dropletId} not found in pool`);
    }

    if (server.state !== "allocated") {
      throw new Error(`Server ${dropletId} is not allocated`);
    }

    console.log(`[Allocator] Releasing server ${dropletId}`);

    // Queue reclamation job
    const { getReclaimQueue } = await import("../lib/queue.js");
    const queue = getReclaimQueue();
    await queue.add(
      {
        dropletId,
        userId: server.allocatedTo,
        ipAddress: server.ipAddress,
        stack: server.stack,
      },
      {
        jobId: `reclaim-${dropletId}`,
      }
    );

    if (returnToPool) {
      // Update state to testing before returning to standby
      await poolManager.updateServerState(dropletId, "testing", "unknown");
    } else {
      // Mark for termination
      await poolManager.updateServerState(dropletId, "terminating");
    }
  }

  /**
   * Check allocation availability
   */
  async getAvailability(stack?: StackType): Promise<{
    available: number;
    byStack: Record<string, number>;
    byRegion: Record<string, number>;
  }> {
    const metrics = await poolManager.getMetrics();

    const byRegion: Record<string, number> = {};
    const servers = await poolManager.getServers("standby");

    for (const server of servers) {
      byRegion[server.region] = (byRegion[server.region] || 0) + 1;
    }

    return {
      available: metrics.standbyServers,
      byStack: metrics.standbyByStack,
      byRegion,
    };
  }

  /**
   * Get user's allocated servers
   */
  async getUserAllocations(userId: string): Promise<PoolServerConfig[]> {
    const servers = await poolManager.getServers("allocated");

    return servers.filter((s) => s.allocatedTo === userId);
  }

  /**
   * Extend allocation (prevent reclamation)
   */
  async extendAllocation(dropletId: number, duration = 86400000): Promise<void> {
    const server = await poolManager.getServer(dropletId);

    if (!server) {
      throw new Error(`Server ${dropletId} not found in pool`);
    }

    // Update expiry time
    await this.redis.setex(
      `allocation:expiry:${dropletId}`,
      Math.ceil(duration / 1000),
      Date.now() + duration
    );

    console.log(`[Allocator] Extended allocation for server ${dropletId}`);
  }
}

// Singleton instance
export const allocator = new Allocator();
