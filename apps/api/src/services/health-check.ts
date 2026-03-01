/**
 * Health Check Service - Server health monitoring
 *
 * Uses a two-phase check:
 * 1. SSH port pretest (TCP) - if not ready, return "unknown" and do not count as failure.
 * 2. Full check (SSH + service + HTTP) - only run when SSH is reachable; failures count.
 * Only servers that pass the full check are marked "healthy" and eligible for allocation.
 */

import { NodeSSH } from "node-ssh";
import type { StackType, HealthStatus, PoolServerConfig } from "@miniclaw/shared";
import { redis } from "../lib/redis.js";
import { poolManager } from "./pool-manager.js";

const SSH_PRETEST_TIMEOUT_MS = 5000;

export interface HealthCheckResult {
  healthy: boolean;
  status: HealthStatus;
  details: HealthDetails;
  timestamp: Date;
}

export interface HealthDetails {
  serviceRunning: boolean;
  httpHealthy: boolean;
  sshReachable?: boolean;
  responseTime?: number;
  error?: string;
  cpuUsage?: number;
  memoryUsage?: number;
  diskUsage?: number;
  uptime?: number;
}

/**
 * Pretest SSH port with a quick TCP connect (used by worker before full check).
 * Returns true only if the port is open within the timeout.
 */
export async function isSSHPortOpen(
  host: string,
  port: number,
  timeoutMs: number = SSH_PRETEST_TIMEOUT_MS
): Promise<boolean> {
  const { default: net } = await import("net");
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, timeoutMs);
    socket.on("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
    socket.connect({ host, port }, () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(true);
    });
  });
}

/**
 * Health Checker class
 */
export class HealthChecker {
  private checkIntervals = new Map<number, NodeJS.Timeout>();

  /**
   * Perform health check on a server.
   * Phase 1: SSH port pretest (TCP). If not open, return "unknown" and do not count as failure.
   * Phase 2: Full SSH + service + HTTP check. Only when this passes is the server "healthy".
   */
  async checkServer(server: PoolServerConfig): Promise<HealthCheckResult> {
    const { dropletId, ipAddress, stack } = server;
    const sshPort = server.sshPort || 22;

    const result: HealthCheckResult = {
      healthy: false,
      status: "unknown",
      details: {
        serviceRunning: false,
        httpHealthy: false,
      },
      timestamp: new Date(),
    };

    // Phase 1: SSH port pretest - worker verifies port is open before full check
    const sshPortOpen = await isSSHPortOpen(ipAddress, sshPort, SSH_PRETEST_TIMEOUT_MS);
    result.details.sshReachable = sshPortOpen;

    if (!sshPortOpen) {
      result.details.error = "SSH port not ready";
      return result;
    }

    // Load SSH key - support both direct key and path to key file
    let sshKey = process.env.SSH_PRIVATE_KEY;

    if (!sshKey && process.env.SSH_PRIVATE_KEY_PATH) {
      try {
        const fs = await import('fs');
        sshKey = fs.readFileSync(process.env.SSH_PRIVATE_KEY_PATH, 'utf8');
      } catch (err) {
        result.details.error = `Failed to read SSH key from file: ${(err as Error).message}`;
        return result;
      }
    }

    if (!sshKey) {
      result.details.error = "SSH key not configured (set SSH_PRIVATE_KEY or SSH_PRIVATE_KEY_PATH)";
      return result;
    }

    const ssh = new NodeSSH();

    try {
      // Connect via SSH
      await ssh.connect({
        host: ipAddress,
        username: "root",
        privateKey: sshKey,
        readyTimeout: 10000,
      });

      // Check service status
      const serviceName = stack === "openclaw" ? "openclaw" : "nanobot";
      const serviceResult = await ssh.execCommand(`systemctl is-active ${serviceName}`);
      result.details.serviceRunning = serviceResult.stdout.trim() === "active";

      // Check HTTP health endpoint
      if (result.details.serviceRunning) {
        const port = stack === "openclaw" ? 8080 : 3000;
        const startTime = Date.now();

        try {
          const healthResult = await ssh.execCommand(
            `curl -sf -w '\\n%{http_code}' --max-time 5 http://localhost:${port}/health || echo "failed"`
          );

          result.details.responseTime = Date.now() - startTime;

          const lines = healthResult.stdout.trim().split("\n");
          const httpCode = lines[lines.length - 1];

          if (httpCode === "200" || httpCode === "204") {
            result.details.httpHealthy = true;
          } else if (httpCode !== "failed") {
            result.details.httpHealthy = httpCode.startsWith("2");
          }

          if (!result.details.httpHealthy) {
            result.details.error = `HTTP ${httpCode}`;
          }

        } catch (error) {
          result.details.httpHealthy = false;
          result.details.error = (error as Error).message;
        }
      }

      // Get system metrics
      try {
        const statsResult = await ssh.execCommand(`
          cpu=$(top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1)
          mem=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}')
          disk=$(df -h / | tail -1 | awk '{print $5}' | cut -d'%' -f1)
          uptime=$(cat /proc/uptime | awk '{print $1}' | cut -d'.' -f1)
          echo "$cpu|$mem|$disk|$uptime"
        `);

        if (statsResult.stdout) {
          const [cpu, mem, disk, uptime] = statsResult.stdout.trim().split("|");
          result.details.cpuUsage = parseFloat(cpu) || 0;
          result.details.memoryUsage = parseFloat(mem) || 0;
          result.details.diskUsage = parseFloat(disk) || 0;
          result.details.uptime = parseInt(uptime) || 0;
        }
      } catch (error) {
        // Metrics collection failure is not critical
      }

    } catch (error) {
      result.details.error = (error as Error).message;
    } finally {
      try {
        ssh.dispose();
      } catch {
        // Ignore disposal errors
      }
    }

    // Determine overall health status
    result.healthy = result.details.serviceRunning && result.details.httpHealthy;

    if (result.healthy) {
      // Check for degraded state (high resource usage)
      if (
        (result.details.cpuUsage && result.details.cpuUsage > 90) ||
        (result.details.memoryUsage && result.details.memoryUsage > 90) ||
        (result.details.diskUsage && result.details.diskUsage > 90)
      ) {
        result.status = "degraded";
      } else {
        result.status = "healthy";
      }
    } else if (result.details.serviceRunning && !result.details.httpHealthy) {
      result.status = "degraded";
    } else {
      // SSH was reachable but service/HTTP failed - still allocatable (configure flow can fix)
      result.status = result.details.sshReachable ? "degraded" : "unhealthy";
    }

    return result;
  }

  /**
   * Check server and update pool state.
   * Persists health status to the pool server record so allocator only picks healthy (SSH-pretested) servers.
   */
  async checkAndUpdate(dropletId: number): Promise<void> {
    const server = await poolManager.getServer(dropletId);

    if (!server) {
      console.log(`[HealthChecker] Server ${dropletId} not found in pool`);
      return;
    }

    const result = await this.checkServer(server);

    const logDetail = result.details.sshReachable === false
      ? "SSH port not ready"
      : `${result.details.responseTime || 0}ms`;
    console.log(
      `[HealthChecker] Server ${dropletId}: ${result.status} (${logDetail})`
    );

    // Update health status in Redis (for dashboards / getHealthStatus)
    await this.updateHealthStatus(dropletId, result);

    // Sync health status to pool server record so allocator only uses healthy servers
    try {
      await poolManager.updateServerState(dropletId, server.state, result.status as HealthStatus);
    } catch (err) {
      console.error(`[HealthChecker] Failed to update server ${dropletId} health in pool:`, err);
    }

    // Only count failures when SSH was reachable but service/HTTP failed (not when SSH was not ready)
    if (result.status === "unhealthy") {
      await this.handleUnhealthyServer(server, result);
    }
  }

  /**
   * Update health status in Redis
   */
  private async updateHealthStatus(
    dropletId: number,
    result: HealthCheckResult
  ): Promise<void> {
    const healthKey = `pool:health:${dropletId}`;

    await redis.hset(healthKey, {
      status: result.status,
      healthy: result.healthy.toString(),
      lastCheck: result.timestamp.toISOString(),
      responseTime: (result.details.responseTime || 0).toString(),
      cpu: (result.details.cpuUsage || 0).toString(),
      memory: (result.details.memoryUsage || 0).toString(),
      disk: (result.details.diskUsage || 0).toString(),
    });

    await redis.expire(healthKey, 300); // Expire after 5 minutes
  }

  /**
   * Handle unhealthy server
   */
  private async handleUnhealthyServer(
    server: PoolServerConfig,
    result: HealthCheckResult
  ): Promise<void> {
    server.healthCheckFailures++;

    if (server.healthCheckFailures >= 3) {
      console.log(`[HealthChecker] Server ${server.dropletId} marked as error (too many failures)`);

      await poolManager.updateServerState(server.dropletId, "error", "unhealthy");

      // Remove from monitoring
      this.stopMonitoring(server.dropletId);
    } else {
      // Increment failure count
      await redis.hincrby(`pool:health:${server.dropletId}`, "failures", 1);
    }
  }

  /**
   * Start continuous monitoring for a server
   */
  startMonitoring(dropletId: number, interval = 30000): void {
    this.stopMonitoring(dropletId);

    const timer = setInterval(async () => {
      try {
        await this.checkAndUpdate(dropletId);
      } catch (error) {
        console.error(`[HealthChecker] Error checking server ${dropletId}:`, error);
      }
    }, interval);

    this.checkIntervals.set(dropletId, timer);

    console.log(`[HealthChecker] Started monitoring server ${dropletId}`);
  }

  /**
   * Stop monitoring a server
   */
  stopMonitoring(dropletId: number): void {
    const timer = this.checkIntervals.get(dropletId);

    if (timer) {
      clearInterval(timer);
      this.checkIntervals.delete(dropletId);
      console.log(`[HealthChecker] Stopped monitoring server ${dropletId}`);
    }
  }

  /**
   * Get health status for a server
   */
  async getHealthStatus(dropletId: number): Promise<HealthCheckResult | null> {
    const healthKey = `pool:health:${dropletId}`;
    const data = await redis.hgetall(healthKey);

    if (!data || Object.keys(data).length === 0) {
      return null;
    }

    return {
      healthy: data.healthy === "true",
      status: data.status as HealthStatus,
      details: {
        serviceRunning: data.healthy === "true",
        httpHealthy: data.healthy === "true",
        responseTime: data.responseTime ? parseInt(data.responseTime) : undefined,
        cpuUsage: data.cpu ? parseFloat(data.cpu) : undefined,
        memoryUsage: data.memory ? parseFloat(data.memory) : undefined,
        diskUsage: data.disk ? parseFloat(data.disk) : undefined,
        error: data.error,
      },
      timestamp: new Date(data.lastCheck),
    };
  }

  /**
   * Batch health check for all servers
   */
  async batchCheck(): Promise<void> {
    const servers = await poolManager.getServers();

    console.log(`[HealthChecker] Starting batch health check for ${servers.length} servers`);

    const checks = servers.map((server) =>
      this.checkAndUpdate(server.dropletId).catch((error) => {
        console.error(`[HealthChecker] Error checking server ${server.dropletId}:`, error);
      })
    );

    await Promise.allSettled(checks);

    console.log(`[HealthChecker] Batch health check completed`);
  }
}

// Singleton instance
export const healthChecker = new HealthChecker();
