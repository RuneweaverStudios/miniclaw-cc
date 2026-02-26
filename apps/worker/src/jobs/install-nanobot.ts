/**
 * Install Nanobot Job - Install and configure Nanobot on a server
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

const NANOBOT_INSTALL_SCRIPT = `#!/bin/bash
set -euo pipefail

NANOBOT_VERSION=${1:-latest}

# Update system and install Python
echo "Installing dependencies..."
apt-get update
apt-get install -y python3 python3-pip python3-venv git

# Create virtual environment
echo "Creating Python virtual environment..."
python3 -m venv /opt/nanobot
source /opt/nanobot/bin/activate

# Install Nanobot
echo "Installing Nanobot ${NANOBOT_VERSION}..."
if [ "$NANOBOT_VERSION" = "latest" ]; then
    pip install nanobot-ai
else
    pip install nanobot-ai==${NANOBOT_VERSION}
fi

# Create configuration directory
mkdir -p /etc/nanobot

# Wait for Nanobot to initialize
echo "Waiting for Nanobot to initialize..."
sleep 5

# Run health check
echo "Running health check..."
nanobot-cli health-check || echo "Health check not available yet, will verify later"

echo "Nanobot installation completed!"
`;

/**
 * Install Nanobot via SSH
 */
export async function processInstallNanobot(job: Job<InstallJobData>): Promise<void> {
  const { dropletId, ipAddress, stack, version } = job.data;
  const sshKey = process.env.SSH_PRIVATE_KEY;

  if (!sshKey) {
    throw new Error("SSH_PRIVATE_KEY environment variable is not set");
  }

  job.log(`Installing Nanobot v${version} on droplet ${dropletId} (${ipAddress})`);
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
      Buffer.from(NANOBOT_INSTALL_SCRIPT),
      "/tmp/install-nanobot.sh"
    );
    await ssh.execCommand("chmod +x /tmp/install-nanobot.sh");
    job.updateProgress(60);

    // Run installation
    job.log("Running Nanobot installation...");
    const installResult = await ssh.execCommand(`/tmp/install-nanobot.sh ${version}`, {
      execOptions: {
        cwd: "/root",
      },
    });

    if (installResult.code !== 0) {
      job.log(`Installation error: ${installResult.stderr}`);
      throw new Error(`Nanobot installation failed: ${installResult.stderr}`);
    }

    job.log(installResult.stdout);
    job.updateProgress(80);

    // Verify installation
    job.log("Verifying Nanobot installation...");
    const verifyResult = await ssh.execCommand(
      "source /opt/nanobot/bin/activate && pip show nanobot-ai"
    );

    if (verifyResult.code !== 0) {
      throw new Error("Nanobot package not found after installation");
    }

    job.log(`Nanobot package info: ${verifyResult.stdout}`);

    // Create systemd service
    job.log("Configuring systemd service...");
    await createNanobotService(ssh, version);
    job.updateProgress(90);

    // Clean up
    await ssh.execCommand("rm -f /tmp/install-nanobot.sh");

    job.updateProgress(100);
    job.log(`Nanobot installation completed successfully on droplet ${dropletId}`);

  } finally {
    ssh.dispose();
  }
}

/**
 * Create systemd service for Nanobot
 */
async function createNanobotService(ssh: NodeSSH, version: string): Promise<void> {
  const serviceContent = `[Unit]
Description=Nanobot AI Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/nanobot
Environment="PATH=/opt/nanobot/bin:/usr/local/bin:/usr/bin:/bin"
Environment="NANOBOT_HOME=/etc/nanobot"
ExecStart=/opt/nanobot/bin/nanobot start --config /etc/nanobot/config.yaml
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
`;

  await ssh.execCommand(`cat > /etc/systemd/system/nanobot.service << 'EOF'
${serviceContent}
EOF
`);

  await ssh.execCommand("systemctl daemon-reload");
  await ssh.execCommand("systemctl enable nanobot");
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
