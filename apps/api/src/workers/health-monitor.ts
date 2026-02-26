/**
 * Health Monitor Worker - Continuous health monitoring of pooled servers
 *
 * This worker continuously checks the health of all servers in the pool
 * and updates their status based on health check results.
 */

import { healthChecker } from "../services/health-check.js";
import { poolManager } from "../services/pool-manager.js";
import type { PoolServerConfig } from "@miniclaw/shared";

export interface HealthMonitorOptions {
  interval?: number; // Check interval in milliseconds (default: 30000)
  concurrentChecks?: number; // Number of concurrent health checks (default: 5)
}

/**
 * Health Monitor class
 */
export class HealthMonitor {
  private interval: number;
  private concurrentChecks: number;
  private timer?: NodeJS.Timeout;
  private running = false;
  private activeChecks = new Set<number>();

  constructor(options: HealthMonitorOptions = {}) {
    this.interval = options.interval || 30000; // 30 seconds
    this.concurrentChecks = options.concurrentChecks || 5;
  }

  /**
   * Start the health monitor
   */
  start(): void {
    if (this.running) {
      console.log("[HealthMonitor] Already running");
      return;
    }

    this.running = true;
    console.log(`[HealthMonitor] Started (interval: ${this.interval}ms)`);

    // Run immediately
    this.run().catch((error) => {
      console.error("[HealthMonitor] Initial run failed:", error);
    });

    // Schedule periodic runs
    this.timer = setInterval(() => {
      this.run().catch((error) => {
        console.error("[HealthMonitor] Run failed:", error);
      });
    }, this.interval);
  }

  /**
   * Stop the health monitor
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

    // Wait for active checks to complete
    if (this.activeChecks.size > 0) {
      console.log(`[HealthMonitor] Waiting for ${this.activeChecks.size} active checks...`);
    }

    console.log("[HealthMonitor] Stopped");
  }

  /**
   * Run a single health check cycle
   */
  private async run(): Promise<void> {
    if (!this.running) {
      return;
    }

    try {
      const servers = await poolManager.getServers();

      // Filter out servers in terminal states
      const serversToCheck = servers.filter(
        (s) => s.state !== "terminating" && s.state !== "error"
      );

      console.log(`[HealthMonitor] Checking ${serversToCheck.length} servers...`);

      // Run health checks in batches
      const batches = this.createBatches(serversToCheck, this.concurrentChecks);

      for (const batch of batches) {
        await Promise.allSettled(
          batch.map((server) => this.checkServer(server))
        );
      }

      // Cleanup unhealthy servers
      await poolManager.cleanupUnhealthy();

      console.log("[HealthMonitor] Health check cycle completed");

    } catch (error) {
      console.error("[HealthMonitor] Error in health check cycle:", error);
    }
  }

  /**
   * Check a single server
   */
  private async checkServer(server: PoolServerConfig): Promise<void> {
    const { dropletId } = server;

    // Skip if already being checked
    if (this.activeChecks.has(dropletId)) {
      return;
    }

    this.activeChecks.add(dropletId);

    try {
      await healthChecker.checkAndUpdate(dropletId);
    } catch (error) {
      console.error(`[HealthMonitor] Error checking server ${dropletId}:`, error);
    } finally {
      this.activeChecks.delete(dropletId);
    }
  }

  /**
   * Create batches of servers for concurrent checking
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }

    return batches;
  }

  /**
   * Get health monitor status
   */
  getStatus(): {
    running: boolean;
    interval: number;
    activeChecks: number;
  } {
    return {
      running: this.running,
      interval: this.interval,
      activeChecks: this.activeChecks.size,
    };
  }

  /**
   * Force a health check on a specific server
   */
  async forceCheck(dropletId: number): Promise<void> {
    const server = await poolManager.getServer(dropletId);

    if (!server) {
      throw new Error(`Server ${dropletId} not found`);
    }

    await this.checkServer(server);
  }

  /**
   * Force a full health check cycle
   */
  async forceCheckAll(): Promise<void> {
    console.log("[HealthMonitor] Running forced health check...");

    await this.run();
  }
}

// Singleton instance
export const healthMonitor = new HealthMonitor();

/**
 * Start health monitor (call from app initialization)
 */
export function startHealthMonitor(): void {
  healthMonitor.start();
}

/**
 * Stop health monitor
 */
export function stopHealthMonitor(): void {
  healthMonitor.stop();
}
