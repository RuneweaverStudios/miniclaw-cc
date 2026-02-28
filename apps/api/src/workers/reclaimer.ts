/**
 * Reclaimer Worker - Reclaims unused or expired servers
 *
 * This worker monitors allocated servers and reclaims them when:
 * - Trial period expires
 * - User cancels subscription
 * - Server is idle for too long
 */

import { poolManager } from "../services/pool-manager.js";
import { clearServerConfiguration } from "../services/server-cleanup.js";
import { openrouterService } from "../services/openrouter.js";
import type { PoolServerConfig } from "@miniclaw/shared";

export interface ReclaimerOptions {
  interval?: number; // Check interval in milliseconds (default: 300000 = 5 minutes)
  trialDuration?: number; // Trial duration in milliseconds (default: 7 days)
  idleTimeout?: number; // Idle timeout in milliseconds (default: 24 hours)
}

export interface ServerExpiryInfo {
  dropletId: number;
  userId: string;
  allocatedAt: Date;
  expiresAt: Date;
  reason: "trial_expired" | "idle_timeout" | "subscription_cancelled";
}

/**
 * Reclaimer class
 */
export class Reclaimer {
  private interval: number;
  private trialDuration: number;
  private idleTimeout: number;
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(options: ReclaimerOptions = {}) {
    this.interval = options.interval || 300000; // 5 minutes
    this.trialDuration = options.trialDuration || 7 * 24 * 60 * 60 * 1000; // 7 days
    this.idleTimeout = options.idleTimeout || 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Start the reclaimer
   */
  start(): void {
    if (this.running) {
      console.log("[Reclaimer] Already running");
      return;
    }

    this.running = true;
    console.log(`[Reclaimer] Started (interval: ${this.interval}ms)`);

    // Run immediately
    this.run().catch((error) => {
      console.error("[Reclaimer] Initial run failed:", error);
    });

    // Schedule periodic runs
    this.timer = setInterval(() => {
      this.run().catch((error) => {
        console.error("[Reclaimer] Run failed:", error);
      });
    }, this.interval);
  }

  /**
   * Stop the reclaimer
   */
  stop(): void {
    if (!this.running) {
      return;
    }

    this.running = false;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }

    console.log("[Reclaimer] Stopped");
  }

  /**
   * Run a single reclamation cycle
   */
  private async run(): Promise<void> {
    if (!this.running) {
      return;
    }

    try {
      const servers = await poolManager.getServers("allocated");

      if (servers.length === 0) {
        return;
      }

      console.log(`[Reclaimer] Checking ${servers.length} allocated servers for reclamation...`);

      const expiringServers: ServerExpiryInfo[] = [];

      for (const server of servers) {
        const expiry = this.checkExpiry(server);

        if (expiry) {
          expiringServers.push(expiry);
        }
      }

      // Reclaim expired servers
      for (const expiry of expiringServers) {
        await this.reclaimServer(expiry);
      }

      if (expiringServers.length > 0) {
        console.log(`[Reclaimer] Reclaimed ${expiringServers.length} server(s)`);
      }

    } catch (error) {
      console.error("[Reclaimer] Error in reclamation cycle:", error);
    }
  }

  /**
   * Check if a server should be reclaimed
   */
  private checkExpiry(server: PoolServerConfig): ServerExpiryInfo | null {
    if (!server.allocatedTo || !server.allocatedAt) {
      return null;
    }

    const now = Date.now();
    const allocatedAt = server.allocatedAt.getTime();

    // Check trial expiration
    const trialExpiresAt = allocatedAt + this.trialDuration;
    if (now > trialExpiresAt) {
      return {
        dropletId: server.dropletId,
        userId: server.allocatedTo,
        allocatedAt: server.allocatedAt,
        expiresAt: new Date(trialExpiresAt),
        reason: "trial_expired",
      };
    }

    // Check idle timeout (if last activity was too long ago)
    // This would require tracking last activity - for now we use allocatedAt
    const idleExpiresAt = allocatedAt + this.idleTimeout;
    if (now > idleExpiresAt) {
      return {
        dropletId: server.dropletId,
        userId: server.allocatedTo,
        allocatedAt: server.allocatedAt,
        expiresAt: new Date(idleExpiresAt),
        reason: "idle_timeout",
      };
    }

    return null;
  }

  /**
   * Reclaim a server
   */
  private async reclaimServer(expiry: ServerExpiryInfo): Promise<void> {
    console.log(
      `[Reclaimer] Reclaiming server ${expiry.dropletId} from user ${expiry.userId} (${expiry.reason})`
    );

    try {
      // TODO: Send notification to user
      // TODO: Backup user data if needed

      // Get server details before reclaiming
      const server = await poolManager.getServer(expiry.dropletId);
      if (!server) {
        console.warn(`[Reclaimer] Server ${expiry.dropletId} not found in pool`);
        return;
      }

      console.log(`[Reclaimer] Cleaning up server ${expiry.dropletId} before returning to pool...`);

      // Clear Telegram configuration and other user data
      const cleanupResult = await clearServerConfiguration(server);

      if (!cleanupResult.success) {
        console.warn(`[Reclaimer] Cleanup had issues but continuing: ${cleanupResult.message}`);
      }

      // Revoke the OpenRouter API key for this droplet
      console.log(`[Reclaimer] Revoking OpenRouter API key for droplet ${expiry.dropletId}...`);
      await openrouterService.revokeDropletKey(expiry.dropletId);
      console.log(`[Reclaimer] OpenRouter API key revoked for droplet ${expiry.dropletId}`);

      // Return server to pool as standby + healthy (not removed)
      await poolManager.updateServerState(expiry.dropletId, 'standby', 'healthy');

      // Clear user allocation info
      await poolManager.releaseAllocation(expiry.userId, expiry.dropletId, false);

      console.log(`[Reclaimer] Server ${expiry.dropletId} returned to pool as standby+healthy`);

    } catch (error) {
      console.error(`[Reclaimer] Failed to reclaim server ${expiry.dropletId}:`, error);
    }
  }

  /**
   * Get reclaimer status
   */
  getStatus(): {
    running: boolean;
    interval: number;
    trialDuration: number;
    idleTimeout: number;
  } {
    return {
      running: this.running,
      interval: this.interval,
      trialDuration: this.trialDuration,
      idleTimeout: this.idleTimeout,
    };
  }

  /**
   * Force reclamation of a specific server
   */
  async forceReclaim(dropletId: number, reason: ServerExpiryInfo["reason"] = "idle_timeout"): Promise<void> {
    const server = await poolManager.getServer(dropletId);

    if (!server) {
      throw new Error(`Server ${dropletId} not found`);
    }

    if (!server.allocatedTo) {
      throw new Error(`Server ${dropletId} is not allocated`);
    }

    await this.reclaimServer({
      dropletId,
      userId: server.allocatedTo,
      allocatedAt: server.allocatedAt || new Date(),
      expiresAt: new Date(),
      reason,
    });
  }

  /**
   * Get servers approaching expiry
   */
  async getExpiringServers(within = 86400000): Promise<ServerExpiryInfo[]> {
    const servers = await poolManager.getServers("allocated");
    const expiring: ServerExpiryInfo[] = [];
    const now = Date.now();

    for (const server of servers) {
      if (!server.allocatedTo || !server.allocatedAt) {
        continue;
      }

      const trialExpiresAt = server.allocatedAt.getTime() + this.trialDuration;
      const timeUntilExpiry = trialExpiresAt - now;

      if (timeUntilExpiry > 0 && timeUntilExpiry <= within) {
        expiring.push({
          dropletId: server.dropletId,
          userId: server.allocatedTo,
          allocatedAt: server.allocatedAt,
          expiresAt: new Date(trialExpiresAt),
          reason: "trial_expired",
        });
      }
    }

    return expiring.sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime());
  }
}

// Singleton instance
export const reclaimer = new Reclaimer();

/**
 * Start reclaimer (call from app initialization)
 */
export function startReclaimer(): void {
  reclaimer.start();
}

/**
 * Stop reclaimer
 */
export function stopReclaimer(): void {
  reclaimer.stop();
}
