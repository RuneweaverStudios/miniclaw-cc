/**
 * Reclaim Job - Reclaim a server from a user
 */

import { Job } from "bullmq";
import { NodeSSH } from "node-ssh";
import type { StackType } from "@miniclaw/shared";

export interface ReclaimJobData {
  dropletId: number;
  userId: string;
  ipAddress: string;
  stack: StackType;
  backupBeforeReclaim?: boolean;
}

export interface ReclaimJobResult {
  reclaimed: boolean;
  backedUp?: boolean;
  backupPath?: string;
}

/**
 * Reclaim server from user
 */
export async function processReclaim(job: Job<ReclaimJobData>): Promise<ReclaimJobResult> {
  const { dropletId, userId, ipAddress, stack, backupBeforeReclaim } = job.data;
  const sshKey = process.env.SSH_PRIVATE_KEY;

  job.log(`Reclaiming droplet ${dropletId} from user ${userId}`);
  job.updateProgress(10);

  const result: ReclaimJobResult = {
    reclaimed: false,
  };

  const ssh = new NodeSSH();

  try {
    // Connect via SSH
    job.log("Connecting to server...");
    await ssh.connect({
      host: ipAddress,
      username: "root",
      privateKey: sshKey || "",
      readyTimeout: 30000,
    });
    job.updateProgress(20);

    // Backup user data if requested
    if (backupBeforeReclaim) {
      job.log("Backing up user data...");
      const backupResult = await backupUserData(ssh, userId, dropletId, job);
      result.backedUp = backupResult.success;
      result.backupPath = backupResult.backupPath;
      job.updateProgress(40);
    }

    // Stop the service
    const serviceName = stack === "openclaw" ? "openclaw" : "nanobot";
    job.log(`Stopping ${serviceName} service...`);
    await ssh.execCommand(`systemctl stop ${serviceName}`);
    job.updateProgress(50);

    // Clean up user configuration
    job.log("Cleaning up user configuration...");
    await ssh.execCommand(`
      rm -f /etc/miniclaw/users/current
      rm -rf /etc/miniclaw/users/${userId}
    `);
    job.updateProgress(60);

    // Remove admin user
    const username = `admin-${userId.substring(0, 8)}`;
    job.log(`Removing admin user ${username}...`);
    await ssh.execCommand(`
      userdel -r ${username} 2>/dev/null || true
      rm -rf /home/${username}
    `);
    job.updateProgress(70);

    // Clean up SSH keys
    job.log("Cleaning up SSH keys...");
    await ssh.execCommand(`
      rm -f /etc/miniclaw/ssh_host_*_key
      rm -f /etc/miniclaw/ssh_host_*_key.pub
    `);
    job.updateProgress(80);

    // Reset hostname
    job.log("Resetting hostname...");
    await ssh.execCommand(`
      hostnamectl set-hostname localhost
      sed -i '/${userId}/d' /etc/hosts
    `);
    job.updateProgress(90);

    // Clean up SSL certificates
    job.log("Cleaning up SSL certificates...");
    await ssh.execCommand(`
      certbot delete --non-interactive --cert-name $(hostname -f) 2>/dev/null || true
      rm -rf /etc/miniclaw/ssl
    `);

    result.reclaimed = true;
    job.log(`Reclamation completed for droplet ${dropletId}`);
    job.updateProgress(100);

  } catch (error) {
    job.log(`Reclamation error: ${(error as Error).message}`);
    throw error;
  } finally {
    ssh.dispose();
  }

  return result;
}

/**
 * Backup user data before reclamation
 */
async function backupUserData(
  ssh: NodeSSH,
  userId: string,
  dropletId: number,
  job: Job
): Promise<{ success: boolean; backupPath?: string }> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupName = `${userId}-${dropletId}-${timestamp}`;
  const backupPath = `/tmp/backups/${backupName}.tar.gz`;

  try {
    // Create backup directory
    await ssh.execCommand(`mkdir -p /tmp/backups`);

    // Create backup of user data
    const backupResult = await ssh.execCommand(`
      tar -czf ${backupPath} \\
        /etc/miniclaw/users/${userId} 2>/dev/null \\
        /etc/${userId}_config 2>/dev/null \\
        /opt/${stack}/data/${userId} 2>/dev/null \\
        || true
    `);

    if (backupResult.code !== 0) {
      job.log(`Backup warning: ${backupResult.stderr}`);
    }

    // Get backup size
    const sizeResult = await ssh.execCommand(`ls -lh ${backupPath} | awk '{print $5}'`);
    job.log(`Backup created: ${backupPath} (${sizeResult.stdout.trim()})`);

    // TODO: Upload backup to S3 or other storage
    // For now, backup is stored locally on the droplet

    return {
      success: true,
      backupPath,
    };

  } catch (error) {
    job.log(`Backup failed: ${(error as Error).message}`);
    return { success: false };
  }
}

/**
 * Hard reset - completely wipe and reset server
 */
export async function hardReset(
  ssh: NodeSSH,
  stack: StackType,
  job: Job
): Promise<void> {
  job.log("Performing hard reset...");

  const serviceName = stack === "openclaw" ? "openclaw" : "nanobot";

  // Stop service
  await ssh.execCommand(`systemctl stop ${serviceName}`);

  // Remove all user data
  await ssh.execCommand(`
    rm -rf /etc/miniclaw/users/*
    rm -rf /opt/${stack}/data/*
    rm -rf /etc/${stack}/*
  `);

  // Reset configuration
  await ssh.execCommand(`
    rm -f /etc/miniclaw/ssl/*
    rm -f /etc/miniclaw/ssh_host_*
  `);

  // Restart service (will start with clean state)
  await ssh.execCommand(`systemctl start ${serviceName}`);

  job.log("Hard reset completed");
}
