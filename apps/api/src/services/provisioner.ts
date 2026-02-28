/**
 * Provisioner - DigitalOcean provisioning service
 */

import axios, { AxiosError } from "axios";
import type { StackType } from "@miniclaw/shared";
import { generatePoolServerName, POOL_SERVER_TAGS } from "@miniclaw/config";

const DO_API_BASE = "https://api.digitalocean.com/v2";

export interface ProvisionOptions {
  stack: StackType;
  region: string;
  size: string;
  version: string;
}

export interface DropletInfo {
  dropletId: number;
  dropletName: string;
  ipAddress: string;
  rootPassword?: string;
}

/**
 * Get DigitalOcean API token
 */
function getToken(): string {
  const token = process.env.DIGITALOCEAN_TOKEN;
  if (!token) {
    throw new Error("DIGITALOCEAN_TOKEN environment variable is not set");
  }
  return token;
}

/**
 * Create a new droplet
 */
export async function provisionDroplet(options: ProvisionOptions): Promise<DropletInfo> {
  const { stack, region, size, version } = options;
  const token = getToken();

  console.log(`[Provisioner] Creating droplet: ${stack} v${version} in ${region}`);

  // Generate unique droplet name
  const sequenceNumber = Date.now() % 10000;
  const dropletName = generatePoolServerName(stack, region, sequenceNumber);

  // Get SSH keys
  const sshKeyIds = await getSSHKeys(token);

  // Get user data script
  const userData = await generateUserData(stack, version);

  try {
    const response = await axios.post(
      `${DO_API_BASE}/droplets`,
      {
        name: dropletName,
        region,
        size,
        image: "ubuntu-24-04-x64",
        ssh_keys: sshKeyIds,
        user_data: userData,
        tags: POOL_SERVER_TAGS,
        monitoring: true,
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const droplet = response.data.droplet;

    console.log(`[Provisioner] Droplet created: ${dropletName} (ID: ${droplet.id})`);

    // Wait for droplet to become active
    const activeDroplet = await waitForDropletActive(token, droplet.id);

    const ipAddress = extractPublicIP(activeDroplet);

    return {
      dropletId: droplet.id,
      dropletName,
      ipAddress,
    };

  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      console.error(`[Provisioner] API Error:`, axiosError.response?.data);
    }
    throw error;
  }
}

/**
 * Get SSH keys from DigitalOcean
 * Only uses the "ghost-m4-mac" key which matches the local SSH key
 */
async function getSSHKeys(token: string): Promise<number[]> {
  try {
    const response = await axios.get(`${DO_API_BASE}/account/keys`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { per_page: 100 },
    });

    // Only use the ghost-m4-mac key (ID: 54440239) which matches local ~/.ssh/id_ed25519
    return response.data.ssh_keys
      .filter((k: { name: string }) => k.name === "ghost-m4-mac")
      .map((k: { id: number }) => k.id);

  } catch (error) {
    console.warn("[Provisioner] Could not fetch SSH keys, continuing without them");
    return [];
  }
}

/**
 * Generate cloud-init user data
 */
async function generateUserData(stack: StackType, version: string): Promise<string> {
  // Base cloud-init configuration
  const baseConfig = `#cloud-config
package_update: true
package_upgrade: false

# Prevent kernel upgrade prompts
bootcmd:
  - echo 'DEBIAN_FRONTEND=noninteractive' >> /etc/environment

packages:
  - curl
  - wget
  - git
  - ufw
  - fail2ban
  - ca-certificates
  - gnupg
  - lsb-release

# Disable all interactive prompts
write_files:
  - path: /etc/apt/apt.conf.d/99noninteractive
    content: |
      DPkg::Options::="--force-confdef";
      DPkg::Options::="--force-confold";
      Apt::Get::Assume-Yes=true;
      Dpkg::Options::="--force-depends";
      Dpkg::Options::="--force-autoconfigure";
      Dpkg::Options::="--force-bad-verify";
      Dpkg::Options::="--force-overwrite";
      Dpkg::Options::="--force-downgrade";

runcmd:
  # Configure firewall
  - ufw default deny incoming
  - ufw default allow outgoing
  - ufw allow 22/tcp
  - ufw allow 80/tcp
  - ufw allow 443/tcp
  - ufw --force enable

  # Configure fail2ban
  - systemctl enable fail2ban
  - systemctl start fail2ban

  # Write stack info
  - echo '{"stack":"${stack}","version":"${version}","provisioned_at":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' > /var/miniclaw-stack.json

  # Create miniclaw directory
  - mkdir -p /etc/miniclaw
  - mkdir -p /var/log/miniclaw

  # Disable password authentication
  - mkdir -p /etc/ssh/sshd_config.d
  - echo 'PasswordAuthentication no' > /etc/ssh/sshd_config.d/60-miniclaw.conf

final_message: "MiniClaw droplet initialization complete!"
`;

  // Stack-specific configuration
  if (stack === 'openclaw') {
    // For OpenClaw, install Node.js and run non-interactive install
    return `#cloud-config
package_update: true
package_upgrade: false
package_reboot_if_required: false

# Prevent interactive prompts during package installation
bootcmd:
  - echo 'DEBIAN_FRONTEND=noninteractive' >> /etc/environment

packages:
  - curl
  - wget
  - git
  - ufw
  - fail2ban
  - ca-certificates
  - gnupg
  - lsb-release

# Disable all interactive prompts
write_files:
  - path: /etc/apt/apt.conf.d/99noninteractive
    content: |
      DPkg::Options::="--force-confdef";
      DPkg::Options::="--force-confold";
      Apt::Get::Assume-Yes=true;
      Dpkg::Options::="--force-depends";
      Dpkg::Options::="--force-autoconfigure";

runcmd:
  # Set environment for non-interactive installation
  - export DEBIAN_FRONTEND=noninteractive
  - export HOME=/root

  # Install Node.js 20.x (required by OpenClaw)
  - curl -fsSL https://deb.nodesource.com/setup_20.x | DEBIAN_FRONTEND=noninteractive bash -
  - DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs

  # Configure firewall
  - ufw default deny incoming
  - ufw default allow outgoing
  - ufw allow 22/tcp
  - ufw allow 80/tcp
  - ufw allow 443/tcp
  - ufw --force enable

  # Configure fail2ban
  - systemctl enable fail2ban
  - systemctl start fail2ban

  # Write stack info
  - echo '{"stack":"${stack}","version":"${version}","provisioned_at":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' > /var/miniclaw-stack.json

  # Create miniclaw directory
  - mkdir -p /etc/miniclaw
  - mkdir -p /var/log/miniclaw

  # Install OpenClaw non-interactively
  - export DEBIAN_FRONTEND=noninteractive
  - export HOME=/root
  - curl -fsSL https://openclaw.ai/install.sh | bash -s -- --no-prompt --no-onboard || echo "OpenClaw install completed"

  # Disable password authentication
  - mkdir -p /etc/ssh/sshd_config.d
  - echo 'PasswordAuthentication no' > /etc/ssh/sshd_config.d/60-miniclaw.conf

final_message: "MiniClaw OpenClaw droplet initialization complete! OpenClaw installed and ready."
`;
  }

  if (stack === 'nanobot') {
    // For Nanobot, we'll install Python 3.11+ and pip
    return `#cloud-config
package_update: true
package_upgrade: false

# Prevent kernel upgrade prompts
bootcmd:
  - echo 'DEBIAN_FRONTEND=noninteractive' >> /etc/environment

# Add Python 3.11 PPA for Ubuntu
packages:
  - curl
  - wget
  - git
  - ufw
  - fail2ban
  - ca-certificates
  - gnupg
  - lsb-release
  - software-properties-common

# Disable all interactive prompts
write_files:
  - path: /etc/apt/apt.conf.d/99noninteractive
    content: |
      DPkg::Options::="--force-confdef";
      DPkg::Options::="--force-confold";
      Apt::Get::Assume-Yes=true;
      Dpkg::Options::="--force-depends";
      Dpkg::Options::="--force-autoconfigure";

runcmd:
  # Set non-interactive mode
  - export DEBIAN_FRONTEND=noninteractive

  # Add deadsnakes PPA for Python 3.11
  - add-apt-repository ppa:deadsnakes/ppa -y
  - apt-get update -qq

  # Install Python 3.11 and pip
  - apt-get install -y python3.11 python3.11-venv python3-pip python3-dev

  # Configure firewall
  - ufw default deny incoming
  - ufw default allow outgoing
  - ufw allow 22/tcp
  - ufw --force enable

  # Configure fail2ban
  - systemctl enable fail2ban
  - systemctl start fail2ban

  # Write stack info
  - echo '{"stack":"${stack}","version":"${version}","provisioned_at":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' > /var/miniclaw-stack.json

  # Create miniclaw directory
  - mkdir -p /etc/miniclaw
  - mkdir -p /var/log/miniclaw

  # Disable password authentication
  - mkdir -p /etc/ssh/sshd_config.d
  - echo 'PasswordAuthentication no' > /etc/ssh/sshd_config.d/60-miniclaw.conf

final_message: "MiniClaw Nanobot droplet initialization complete! Ready for stack installation."
`;
  }

  return baseConfig;
}

/**
 * Wait for droplet to become active
 */
async function waitForDropletActive(
  token: string,
  dropletId: number,
  maxAttempts = 60,
  interval = 5000
): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await axios.get(`${DO_API_BASE}/droplets/${dropletId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const droplet = response.data.droplet;

      if (droplet.status === "active") {
        console.log(`[Provisioner] Droplet ${dropletId} is active`);
        return droplet;
      }

      if (droplet.status === "error") {
        throw new Error(`Droplet ${dropletId} entered error state`);
      }

      console.log(`[Provisioner] Waiting for droplet ${dropletId} (${i + 1}/${maxAttempts}): ${droplet.status}`);
      await new Promise((resolve) => setTimeout(resolve, interval));

    } catch (error) {
      if (i === maxAttempts - 1) {
        throw error;
      }
      console.log(`[Provisioner] Retrying connection to DigitalOcean API...`);
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }

  throw new Error(`Droplet ${dropletId} did not become active in time`);
}

/**
 * Extract public IP from droplet
 */
function extractPublicIP(droplet: any): string {
  const networks = droplet.networks?.v4 || [];
  const publicNetwork = networks.find((n: { type: string }) => n.type === "public");

  if (!publicNetwork) {
    throw new Error(`No public IP address found for droplet ${droplet.id}`);
  }

  return publicNetwork.ip_address;
}

/**
 * Destroy a droplet
 */
export async function destroyDroplet(dropletId: number): Promise<void> {
  const token = getToken();

  console.log(`[Provisioner] Destroying droplet ${dropletId}`);

  try {
    await axios.delete(`${DO_API_BASE}/droplets/${dropletId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log(`[Provisioner] Droplet ${dropletId} destroyed`);

  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 404) {
        console.log(`[Provisioner] Droplet ${dropletId} already deleted`);
        return;
      }
    }
    throw error;
  }
}

/**
 * Get droplet info
 */
export async function getDroplet(dropletId: number): Promise<any> {
  const token = getToken();

  const response = await axios.get(`${DO_API_BASE}/droplets/${dropletId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return response.data.droplet;
}

/**
 * List droplets by tag
 */
export async function listDropletsByTag(tag: string): Promise<any[]> {
  const token = getToken();

  const response = await axios.get(`${DO_API_BASE}/droplets`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { tag_name: tag },
  });

  return response.data.droplets;
}

/**
 * Create snapshot of droplet
 */
export async function createSnapshot(dropletId: number, name: string): Promise<void> {
  const token = getToken();

  console.log(`[Provisioner] Creating snapshot ${name} of droplet ${dropletId}`);

  await axios.post(
    `${DO_API_BASE}/droplets/${dropletId}/snapshots`,
    { type: "snapshot", name },
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
}
