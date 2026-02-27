/**
 * Installation Workers - Process installation jobs for OpenClaw and Nanobot
 */

import { createWorker } from "../lib/queue.js";
import { nanobotService } from "../services/nanobot.js";

interface InstallJobData {
  dropletId: number;
  ipAddress: string;
  stack: "openclaw" | "nanobot";
  version: string;
}

/**
 * Process OpenClaw installation job
 */
async function processOpenClawInstall(job: InstallJobData): Promise<void> {
  const { dropletId, ipAddress, stack, version } = job;

  console.log(`[InstallWorker] Starting ${stack} installation for droplet ${dropletId} at ${ipAddress}`);

  try {
    // Update state to "testing"
    const { poolManager } = await import("../services/pool-manager.js");
    await poolManager.updateServerState(dropletId, "testing");

    // Import OpenClaw service dynamically to avoid circular dependencies
    const { openclawService } = await import("../services/openclaw.js");

    // Install OpenClaw
    const installResult = await openclawService.install({
      ipAddress,
      version,
    });

    if (!installResult.success) {
      throw new Error(installResult.error || "OpenClaw installation failed");
    }

    console.log(`[InstallWorker] OpenClaw installation complete, testing gateway for droplet ${dropletId}`);

    // Test gateway and agent response
    const testResult = await openclawService.testGateway(ipAddress);
    if (!testResult.success) {
      throw new Error(testResult.error || "Gateway test failed");
    }

    console.log(`[InstallWorker] OpenClaw gateway test passed for droplet ${dropletId}`);
    // Update state to "standby" after successful installation and test
    await poolManager.updateServerState(dropletId, "standby", "healthy");
  } catch (error) {
    console.error(`[InstallWorker] OpenClaw installation failed for droplet ${dropletId}:`, error);
    // Update state to "error" on failure
    const { poolManager } = await import("../services/pool-manager.js");
    await poolManager.updateServerState(dropletId, "error", "unhealthy");
    throw error;
  }
}

/**
 * Process Nanobot installation job
 */
async function processNanobotInstall(job: InstallJobData): Promise<void> {
  const { dropletId, ipAddress, stack, version } = job;

  console.log(`[InstallWorker] Starting ${stack} installation for droplet ${dropletId} at ${ipAddress}`);

  try {
    // Update state to "testing"
    const { poolManager } = await import("../services/pool-manager.js");
    await poolManager.updateServerState(dropletId, "testing");

    // Install Nanobot (version 0.1.3.post7 from PyPI to avoid oauth-cli-kit)
    const installResult = await nanobotService.install({
      ipAddress,
      version: "0.1.3.post7", // Use PyPI stable version
    });

    if (!installResult.success) {
      throw new Error(installResult.error || "Nanobot installation failed");
    }

    console.log(`[InstallWorker] Nanobot installation complete, testing gateway for droplet ${dropletId}`);

    // Test gateway and agent response
    const testResult = await nanobotService.testGateway(ipAddress);
    if (!testResult.success) {
      throw new Error(testResult.error || "Gateway test failed");
    }

    console.log(`[InstallWorker] Nanobot gateway test passed for droplet ${dropletId}`);
    // Update state to "standby" after successful installation and test
    await poolManager.updateServerState(dropletId, "standby", "healthy");
  } catch (error) {
    console.error(`[InstallWorker] Nanobot installation failed for droplet ${dropletId}:`, error);
    // Update state to "error" on failure
    const { poolManager } = await import("../services/pool-manager.js");
    await poolManager.updateServerState(dropletId, "error", "unhealthy");
    throw error;
  }
}

/**
 * Start installation workers
 */
export function startInstallWorkers(): void {
  console.log("[InstallWorker] Starting installation workers...");

  // OpenClaw installation worker
  const openclawWorker = createWorker<InstallJobData>(
    "install-openclaw",
    processOpenClawInstall,
    { concurrency: 2 }
  );

  // Nanobot installation worker
  const nanobotWorker = createWorker<InstallJobData>(
    "install-nanobot",
    processNanobotInstall,
    { concurrency: 2 }
  );

  // Handle worker events
  const handleWorkerError = (queueName: string, error: Error) => {
    console.error(`[InstallWorker] Worker error for ${queueName}:`, error);
  };

  const handleWorkerReady = (queueName: string) => {
    console.log(`[InstallWorker] Worker ready for ${queueName}`);
  };

  openclawWorker.on("error", (error) => handleWorkerError("install-openclaw", error));
  openclawWorker.on("ready", () => handleWorkerReady("install-openclaw"));

  nanobotWorker.on("error", (error) => handleWorkerError("install-nanobot", error));
  nanobotWorker.on("ready", () => handleWorkerReady("install-nanobot"));

  console.log("[InstallWorker] Installation workers started");
}

/**
 * Stop installation workers
 */
export async function stopInstallWorkers(): Promise<void> {
  console.log("[InstallWorker] Stopping installation workers...");

  // Workers are automatically stopped when the process exits
  // But we could implement graceful shutdown here if needed
}
