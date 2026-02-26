/**
 * Provision Job - Create a new DigitalOcean droplet
 */

import { Job } from "bullmq";
import axios from "axios";
import type { StackType } from "@miniclaw/shared";
import { generatePoolServerName, POOL_SERVER_TAGS } from "@miniclaw/config";

export interface ProvisionJobData {
  stack: StackType;
  region: string;
  size: string;
  version: string;
}

export interface ProvisionJobResult {
  dropletId: number;
  dropletName: string;
  ipAddress: string;
  rootPassword?: string;
}

const DO_API_BASE = "https://api.digitalocean.com/v2";

/**
 * Create a new DigitalOcean droplet
 */
export async function processProvision(job: Job<ProvisionJobData>): Promise<ProvisionJobResult> {
  const { stack, region, size, version } = job.data;
  const token = process.env.DIGITALOCEAN_TOKEN;

  if (!token) {
    throw new Error("DIGITALOCEAN_TOKEN environment variable is not set");
  }

  job.log(`Starting provision for ${stack} v${version} in ${region} (${size})`);
  job.updateProgress(10);

  // Generate unique droplet name
  const sequenceNumber = Date.now() % 1000;
  const dropletName = generatePoolServerName(stack, region, sequenceNumber);

  // Get SSH key IDs from DigitalOcean
  let sshKeyIds: number[] = [];
  try {
    const keysResponse = await axios.get(`${DO_API_BASE}/account/keys`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { per_page: 100 },
    });
    sshKeyIds = keysResponse.data.ssh_keys
      .filter((k: { name: string }) => k.name.includes("miniclaw"))
      .map((k: { id: number }) => k.id);
  } catch (error) {
    job.log(`Warning: Could not fetch SSH keys: ${error}`);
  }

  job.updateProgress(20);

  // Create droplet
  const userData = await getUserData(stack, version);

  const createResponse = await axios.post(
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

  const droplet = createResponse.data.droplet;
  const dropletId = droplet.id;

  job.log(`Droplet created: ${dropletName} (ID: ${dropletId})`);
  job.updateProgress(50);

  // Wait for droplet to become active
  job.log("Waiting for droplet to become active...");
  const activeDroplet = await waitForDropletStatus(token, dropletId, "active", job);
  job.updateProgress(80);

  const ipAddress = activeDroplet.networks.v4?.find((n: { type: string }) => n.type === "public")?.ip_address;

  if (!ipAddress) {
    throw new Error(`No public IP address found for droplet ${dropletId}`);
  }

  job.log(`Droplet is active at ${ipAddress}`);
  job.updateProgress(100);

  return {
    dropletId,
    dropletName,
    ipAddress,
  };
}

/**
 * Get cloud-init user data for the droplet
 */
async function getUserData(stack: StackType, version: string): Promise<string> {
  // Read cloud-init template
  // For now, return basic setup
  return `#cloud-config
package_update: true
package_upgrade: true
packages:
  - curl
  - wget
  - git
  - ufw
  - fail2ban

runcmd:
  - echo "${stack} ${version}" > /var/miniclaw_stack.txt
  - ufw allow 22/tcp
  - ufw allow 80/tcp
  - ufw allow 443/tcp
  - ufw --force enable
  - systemctl enable fail2ban
  - systemctl start fail2ban
`;
}

/**
 * Wait for droplet to reach desired status
 */
async function waitForDropletStatus(
  token: string,
  dropletId: number,
  desiredStatus: string,
  job: Job,
  maxAttempts = 60,
  interval = 5000
): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await axios.get(`${DO_API_BASE}/droplets/${dropletId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const droplet = response.data.droplet;

    if (droplet.status === desiredStatus) {
      return droplet;
    }

    if (droplet.status === "error") {
      throw new Error(`Droplet ${dropletId} entered error state`);
    }

    job.log(`Droplet status: ${droplet.status} (${i + 1}/${maxAttempts})`);
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Droplet ${dropletId} did not reach ${desiredStatus} status in time`);
}

/**
 * Destroy a droplet
 */
export async function destroyDroplet(dropletId: number, job?: Job): Promise<void> {
  const token = process.env.DIGITALOCEAN_TOKEN;

  if (!token) {
    throw new Error("DIGITALOCEAN_TOKEN environment variable is not set");
  }

  job?.log(`Destroying droplet ${dropletId}`);

  await axios.delete(`${DO_API_BASE}/droplets/${dropletId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  job?.log(`Droplet ${dropletId} destroyed`);
}
