/**
 * Health Check Job - Verify server health
 */

import { Job } from "bullmq";
import { NodeSSH } from "node-ssh";
import type { StackType, HealthStatus } from "@miniclaw/shared";

export interface HealthCheckJobData {
  dropletId: number;
  ipAddress: string;
  stack: StackType;
}

export interface HealthCheckResult {
  healthy: boolean;
  status: HealthStatus;
  details: HealthDetails;
}

export interface HealthDetails {
  serviceRunning: boolean;
  httpHealthy: boolean;
  responseTime?: number;
  error?: string;
  cpuUsage?: number;
  memoryUsage?: number;
  diskUsage?: number;
}

/**
 * Perform health check on a server
 */
export async function processHealthCheck(job: Job<HealthCheckJobData>): Promise<HealthCheckResult> {
  const { dropletId, ipAddress, stack } = job.data;
  const sshKey = process.env.SSH_PRIVATE_KEY;

  job.log(`Running health check for ${stack} on droplet ${dropletId} (${ipAddress})`);

  const details: HealthDetails = {
    serviceRunning: false,
    httpHealthy: false,
  };

  const ssh = new NodeSSH();

  try {
    // Connect via SSH
    await ssh.connect({
      host: ipAddress,
      username: "root",
      privateKey: sshKey || "",
      readyTimeout: 10000,
    });

    // Check if service is running
    const serviceName = stack === "openclaw" ? "openclaw" : "nanobot";
    const serviceResult = await ssh.execCommand(`systemctl is-active ${serviceName}`);
    details.serviceRunning = serviceResult.stdout.trim() === "active";

    job.log(`Service ${serviceName} status: ${serviceResult.stdout.trim()}`);

    // Check HTTP health endpoint
    if (details.serviceRunning) {
      const port = stack === "openclaw" ? 8080 : 3000;
      const startTime = Date.now();

      try {
        const healthResult = await ssh.execCommand(
          `curl -sf -w '\\n%{http_code}' http://localhost:${port}/health || echo "failed"`
        );

        details.responseTime = Date.now() - startTime;

        // Parse output (last line is HTTP code)
        const lines = healthResult.stdout.trim().split("\n");
        const httpCode = lines[lines.length - 1];

        if (httpCode === "200" || httpCode === "204") {
          details.httpHealthy = true;
        } else if (httpCode === "failed") {
          details.httpHealthy = false;
          details.error = "HTTP health endpoint not responding";
        } else {
          details.httpHealthy = httpCode.startsWith("2");
          if (!details.httpHealthy) {
            details.error = `HTTP ${httpCode}`;
          }
        }

        job.log(`HTTP health check: ${details.httpHealthy ? "OK" : "FAILED"} (${details.responseTime}ms)`);

      } catch (error) {
        details.httpHealthy = false;
        details.error = (error as Error).message;
        job.log(`HTTP health check error: ${details.error}`);
      }
    }

    // Get system metrics
    try {
      const statsResult = await ssh.execCommand(`
        cpu=$(top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1)
        mem=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}')
        disk=$(df -h / | tail -1 | awk '{print $5}' | cut -d'%' -f1)
        echo "$cpu|$mem|$disk"
      `);

      if (statsResult.stdout) {
        const [cpu, mem, disk] = statsResult.stdout.trim().split("|");
        details.cpuUsage = parseFloat(cpu) || 0;
        details.memoryUsage = parseFloat(mem) || 0;
        details.diskUsage = parseFloat(disk) || 0;

        job.log(`System: CPU ${details.cpuUsage}%, Mem ${details.memoryUsage}%, Disk ${details.diskUsage}%`);
      }
    } catch (error) {
      job.log(`Could not fetch system metrics: ${(error as Error).message}`);
    }

  } catch (error) {
    details.error = (error as Error).message;
    job.log(`Health check error: ${details.error}`);
  } finally {
    try {
      ssh.dispose();
    } catch {
      // Ignore disposal errors
    }
  }

  // Determine overall health status
  const healthy = details.serviceRunning && details.httpHealthy;
  let status: HealthStatus;

  if (healthy) {
    // Check for degraded state (high resource usage)
    if ((details.cpuUsage && details.cpuUsage > 90) ||
        (details.memoryUsage && details.memoryUsage > 90) ||
        (details.diskUsage && details.diskUsage > 90)) {
      status = "degraded";
    } else {
      status = "healthy";
    }
  } else if (details.serviceRunning && !details.httpHealthy) {
    status = "degraded";
  } else {
    status = "unhealthy";
  }

  job.log(`Health check result: ${status}`);

  return {
    healthy,
    status,
    details,
  };
}

/**
 * Get quick health status (HTTP only, no SSH required)
 */
export async function quickHealthCheck(
  ipAddress: string,
  stack: StackType,
  timeout = 5000
): Promise<boolean> {
  const port = stack === "openclaw" ? 8080 : 3000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`http://${ipAddress}:${port}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    clearTimeout(timeoutId);
    return false;
  }
}
