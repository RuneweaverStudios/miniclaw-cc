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
    // Import OpenClaw service dynamically to avoid circular dependencies
    const { openclawService } = await import("../services/openclaw.js");

    // Install OpenClaw
    const result = await openclawService.install({
      ipAddress,
      version,
    });

    if (result.success) {
      console.log(`[InstallWorker] OpenClaw installation complete for droplet ${dropletId}`);
    } else {
      throw new Error(result.error || "OpenClaw installation failed");
    }
  } catch (error) {
    console.error(`[InstallWorker] OpenClaw installation failed for droplet ${dropletId}:`, error);
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
    // Install Nanobot (version 0.1.3.post7 from PyPI to avoid oauth-cli-kit)
    const result = await nanobotService.install({
      ipAddress,
      version: "0.1.3.post7", // Use PyPI stable version
    });

    if (result.success) {
      console.log(`[InstallWorker] Nanobot installation complete for droplet ${dropletId}`);
    } else {
      throw new Error(result.error || "Nanobot installation failed");
    }
  } catch (error) {
    console.error(`[InstallWorker] Nanobot installation failed for droplet ${dropletId}:`, error);
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
