/**
 * Install OpenClaw Job - Install and configure OpenClaw on a server
 */

import { Job } from "bullmq";
import { NodeSSH } from "node-ssh";
import type { StackType } from "@miniclaw/shared";

export interface InstallJobData {
  dropletId: number;
  ipAddress: string;
  stack: StackType;
  version: string;
  sshKey?: string;
}

const OPENCLAW_INSTALL_SCRIPT = `#!/bin/bash
set -euo pipefail

# Install OpenClaw
echo "Installing OpenClaw..."
curl -fsSL https://openclaw.ai/install.sh | bash

# Wait for installation to complete
echo "Waiting for OpenClaw to start..."
for i in {1..30}; do
    if curl -sf http://localhost:8080/health > /dev/null 2>&1; then
        echo "OpenClaw is healthy!"
        exit 0
    fi
    echo "Waiting... ($i/30)"
    sleep 2
done

echo "OpenClaw health check timed out"
exit 1
`;

/**
 * Install OpenClaw via SSH
 */
export async function processInstallOpenClaw(job: Job<InstallJobData>): Promise<void> {
  const { dropletId, ipAddress, stack, version } = job.data;
  const sshKey = process.env.SSH_PRIVATE_KEY;

  if (!sshKey) {
    throw new Error("SSH_PRIVATE_KEY environment variable is not set");
  }

  job.log(`Installing OpenClaw v${version} on droplet ${dropletId} (${ipAddress})`);
  job.updateProgress(10);

  const ssh = new NodeSSH();

  try {
    // Wait for SSH to be available
    job.log("Waiting for SSH to be available...");
    await waitForSSH(ipAddress, job);
    job.updateProgress(30);

    // Connect via SSH
    job.log(`Connecting to ${ipAddress}...`);
    await ssh.connect({
      host: ipAddress,
      username: "root",
      privateKey: sshKey,
      readyTimeout: 30000,
    });
    job.updateProgress(40);

    // Check if cloud-init completed
    job.log("Checking cloud-init status...");
    const cloudInitResult = await ssh.execCommand("cloud-init status --wait");
    if (cloudInitResult.stderr && !cloudInitResult.stderr.includes("finished")) {
      job.log(`Cloud-init status: ${cloudInitResult.stderr}`);
    }
    job.updateProgress(50);

    // Create install script
    job.log("Creating install script...");
    await ssh.putFile(
      Buffer.from(OPENCLAW_INSTALL_SCRIPT),
      "/tmp/install-openclaw.sh"
    );
    await ssh.execCommand("chmod +x /tmp/install-openclaw.sh");
    job.updateProgress(60);

    // Run installation
    job.log("Running OpenClaw installation...");
    const installResult = await ssh.execCommand("/tmp/install-openclaw.sh", {
      execOptions: { env: { OPENCLAW_VERSION: version } },
    });

    if (installResult.code !== 0) {
      job.log(`Installation error: ${installResult.stderr}`);
      throw new Error(`OpenClaw installation failed: ${installResult.stderr}`);
    }

    job.log(installResult.stdout);
    job.updateProgress(80);

    // Verify installation
    job.log("Verifying OpenClaw installation...");
    const healthResult = await ssh.execCommand("curl -sf http://localhost:8080/health");

    if (healthResult.code !== 0 || !healthResult.stdout) {
      throw new Error("OpenClaw health check failed after installation");
    }

    job.log(`Health check response: ${healthResult.stdout}`);

    // Create systemd service
    job.log("Configuring systemd service...");
    await createOpenClawService(ssh, version);
    job.updateProgress(90);

    // Clean up
    await ssh.execCommand("rm -f /tmp/install-openclaw.sh");

    job.updateProgress(100);
    job.log(`OpenClaw installation completed successfully on droplet ${dropletId}`);

  } finally {
    ssh.dispose();
  }
}

/**
 * Create systemd service for OpenClaw
 */
async function createOpenClawService(ssh: NodeSSH, version: string): Promise<void> {
  const serviceContent = `[Unit]
Description=OpenClaw AI Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/openclaw
ExecStart=/opt/openclaw/bin/openclaw start
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
`;

  await ssh.execCommand(`cat > /etc/systemd/system/openclaw.service << 'EOF'
${serviceContent}
EOF
`);

  await ssh.execCommand("systemctl daemon-reload");
  await ssh.execCommand("systemctl enable openclaw");
  // Don't start yet - let the pool manager handle it
}

/**
 * Wait for SSH to be available
 */
async function waitForSSH(ipAddress: string, job: Job, maxAttempts = 30): Promise<void> {
  const ssh = new NodeSSH();
  const sshKey = process.env.SSH_PRIVATE_KEY;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      await ssh.connect({
        host: ipAddress,
        username: "root",
        privateKey: sshKey!,
        readyTimeout: 5000,
      });
      ssh.dispose();
      job.log(`SSH is available after ${i + 1} attempts`);
      return;
    } catch (error) {
      job.log(`SSH not ready (${i + 1}/${maxAttempts}): ${(error as Error).message}`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  throw new Error(`SSH did not become available for ${ipAddress}`);
}
