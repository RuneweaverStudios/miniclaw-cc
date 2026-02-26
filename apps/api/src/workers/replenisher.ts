/**
 * Replenisher Worker - Keeps the standby pool full
 *
 * This worker continuously monitors the pool and provisions new servers
 * when the standby count drops below the threshold.
 */

import { poolManager } from "../services/pool-manager.js";
import { getPoolConfig, REPLENISHMENT_SETTINGS } from "@miniclaw/config";

export interface ReplenisherOptions {
  interval?: number; // Check interval in milliseconds (default: 60000)
  minThreshold?: number; // Minimum threshold ratio (default: 0.3)
  batchSize?: number; // Number of servers to provision at once
}

/**
 * Replenisher class
 */
export class Replenisher {
  private interval: number;
  private minThreshold: number;
  private batchSize: number;
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(options: ReplenisherOptions = {}) {
    const config = getPoolConfig(process.env.NODE_ENV || "production");

    this.interval = options.interval || 60000; // 1 minute
    this.minThreshold = options.minThreshold || REPLENISHMENT_SETTINGS.thresholdRatio;
    this.batchSize = options.batchSize || config.replenishBatchSize;
  }

  /**
   * Start the replenisher
   */
  start(): void {
    if (this.running) {
      console.log("[Replenisher] Already running");
      return;
    }

    this.running = true;
    console.log(`[Replenisher] Started (interval: ${this.interval}ms, batch size: ${this.batchSize})`);

    // Run immediately
    this.run().catch((error) => {
      console.error("[Replenisher] Initial run failed:", error);
    });

    // Schedule periodic runs
    this.timer = setInterval(() => {
      this.run().catch((error) => {
        console.error("[Replenisher] Run failed:", error);
      });
    }, this.interval);
  }

  /**
   * Stop the replenisher
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

    console.log("[Replenisher] Stopped");
  }

  /**
   * Run a single replenishment cycle
   */
  private async run(): Promise<void> {
    if (!this.running) {
      return;
    }

    try {
      const metrics = await poolManager.getMetrics();

      console.log(`[Replenisher] Pool status: ${metrics.standbyServers}/${metrics.totalServers} standby`);

      // Check if we need to replenish
      const needsReplenishment = await this.needsReplenishment(metrics);

      if (!needsReplenishment) {
        console.log("[Replenisher] Pool is healthy, no replenishment needed");
        return;
      }

      console.log("[Replenisher] Pool needs replenishment, provisioning servers...");

      await this.replenish();

    } catch (error) {
      console.error("[Replenisher] Error in replenishment cycle:", error);
    }
  }

  /**
   * Check if pool needs replenishment
   */
  private async needsReplenishment(metrics: Awaited<ReturnType<typeof poolManager.getMetrics>>): Promise<boolean> {
    const config = getPoolConfig(process.env.NODE_ENV || "production");

    // Check minimum threshold
    if (metrics.standbyServers < config.minPoolSize) {
      console.log(`[Replenisher] Standby servers (${metrics.standbyServers}) below minimum (${config.minPoolSize})`);
      return true;
    }

    // Check threshold ratio
    const threshold = Math.floor(config.targetPoolSize * this.minThreshold);
    if (metrics.standbyServers < threshold) {
      console.log(`[Replenisher] Standby servers (${metrics.standbyServers}) below threshold (${threshold})`);
      return true;
    }

    // Check per-stack thresholds
    for (const [stack, count] of Object.entries(metrics.standbyByStack)) {
      const stackTarget = Math.floor(config.targetPoolSize / 2);
      const stackThreshold = Math.floor(stackTarget * this.minThreshold);

      if (count < stackThreshold) {
        console.log(`[Replenisher] ${stack} standby servers (${count}) below threshold (${stackThreshold})`);
        return true;
      }
    }

    return false;
  }

  /**
   * Replenish the pool
   */
  private async replenish(): Promise<void> {
    const metrics = await poolManager.getMetrics();
    const config = getPoolConfig(process.env.NODE_ENV || "production");

    // Calculate how many servers to provision per stack
    const stacks: Array<"openclaw" | "nanobot"> = ["openclaw", "nanobot"];

    for (const stack of stacks) {
      const current = metrics.standbyByStack[stack];
      const target = Math.floor(config.targetPoolSize / 2);
      const needed = Math.min(this.batchSize, target - current);

      if (needed > 0) {
        console.log(`[Replenisher] Provisioning ${needed} ${stack} servers...`);

        await poolManager.replenish(stack);

        // Wait a bit between stacks to avoid overwhelming the API
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    console.log("[Replenisher] Replenishment cycle completed");
  }

  /**
   * Force a replenishment cycle
   */
  async forceReplenish(stack?: "openclaw" | "nanobot"): Promise<void> {
    console.log(`[Replenisher] Force replenish${stack ? ` for ${stack}` : ""}`);

    await poolManager.replenish(stack);
  }

  /**
   * Get replenisher status
   */
  getStatus(): {
    running: boolean;
    interval: number;
    batchSize: number;
  } {
    return {
      running: this.running,
      interval: this.interval,
      batchSize: this.batchSize,
    };
  }
}

// Singleton instance
export const replenisher = new Replenisher();

/**
 * Start replenisher (call from app initialization)
 */
export function startReplenisher(): void {
  replenisher.start();
}

/**
 * Stop replenisher
 */
export function stopReplenisher(): void {
  replenisher.stop();
}
