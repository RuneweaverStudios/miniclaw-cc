/**
 * Allocate Job - Allocate a pooled server to a user
 */

import { Job } from "bullmq";
import { NodeSSH } from "node-ssh";
import type { StackType } from "@miniclaw/shared";

export interface AllocateJobData {
  userId: string;
  dropletId: number;
  hostname: string;
  fqdn: string;
  ipAddress: string;
  stack: StackType;
  region: string;
}

export interface AllocateJobResult {
  sshPort: number;
  sshUser: string;
  configUrl: string;
}

/**
 * Allocate server to user
 */
export async function processAllocate(job: Job<AllocateJobData>): Promise<AllocateJobResult> {
  const { userId, dropletId, hostname, fqdn, ipAddress, stack, region } = job.data;
  const sshKey = process.env.SSH_PRIVATE_KEY;
  const cloudflareToken = process.env.CLOUDFLARE_TOKEN;
  const cloudflareZone = process.env.CLOUDFLARE_ZONE;

  job.log(`Allocating droplet ${dropletId} (${hostname}) to user ${userId}`);
  job.updateProgress(10);

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

    // Update hostname
    job.log(`Setting hostname to ${hostname}...`);
    await ssh.execCommand(`hostnamectl set-hostname ${hostname}`);
    await ssh.execCommand(`echo ${ipAddress} ${hostname} ${fqdn} >> /etc/hosts`);
    job.updateProgress(30);

    // Create user-specific configuration
    job.log("Creating user configuration directory...");
    await ssh.execCommand(`mkdir -p /etc/miniclaw/users`);
    await ssh.execCommand(`echo "${userId}" > /etc/miniclaw/users/current`);

    // Generate unique SSH keys for the user
    job.log("Generating SSH keys for user...");
    await ssh.execCommand(`
      ssh-keygen -t ed25519 -f /etc/miniclaw/ssh_host_ed25519 -N '' 2>/dev/null || true
    `);
    job.updateProgress(40);

    // Start the service
    const serviceName = stack === "openclaw" ? "openclaw" : "nanobot";
    job.log(`Starting ${serviceName} service...`);
    await ssh.execCommand(`systemctl start ${serviceName}`);
    await ssh.execCommand(`systemctl enable ${serviceName}`);
    job.updateProgress(50);

    // Configure DNS (if Cloudflare is configured)
    if (cloudflareToken && cloudflareZone) {
      job.log(`Configuring DNS for ${fqdn}...`);
      await configureDNS(cloudflareToken, cloudflareZone, fqdn, ipAddress, job);
      job.updateProgress(70);
    }

    // Setup SSL certificate (Let's Encrypt)
    job.log("Setting up SSL certificate...");
    await setupSSL(ssh, fqdn, job);
    job.updateProgress(80);

    // Create admin user with SSH access
    job.log("Creating admin user...");
    await createAdminUser(ssh, userId, job);
    job.updateProgress(90);

    job.log(`Allocation completed for droplet ${dropletId}`);
    job.updateProgress(100);

    return {
      sshPort: 22,
      sshUser: `admin-${userId.substring(0, 8)}`,
      configUrl: `https://${fqdn}/config`,
    };

  } finally {
    ssh.dispose();
  }
}

/**
 * Configure DNS via Cloudflare
 */
async function configureDNS(
  token: string,
  zone: string,
  fqdn: string,
  ipAddress: string,
  job: Job
): Promise<void> {
  try {
    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/dns_records`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "A",
        name: fqdn,
        content: ipAddress,
        ttl: 300,
        proxied: false,
      }),
    });

    if (response.ok) {
      job.log(`DNS record created for ${fqdn}`);
    } else {
      const error = await response.text();
      job.log(`DNS creation failed: ${error}`);
    }
  } catch (error) {
    job.log(`DNS error: ${(error as Error).message}`);
  }
}

/**
 * Setup SSL certificate with Let's Encrypt
 */
async function setupSSL(ssh: NodeSSH, fqdn: string, job: Job): Promise<void> {
  try {
    // Install certbot if not present
    await ssh.execCommand(`
      which certbot || apt-get update && apt-get install -y certbot
    `);

    // Request certificate (standalone mode)
    job.log("Requesting Let's Encrypt certificate...");
    const certResult = await ssh.execCommand(
      `certbot certonly --standalone -d ${fqdn} --non-interactive --agree-tos --email admin@miniclaw.cc || true`
    );

    if (certResult.code === 0) {
      job.log("SSL certificate obtained successfully");

      // Configure service to use certificate
      await ssh.execCommand(`
        mkdir -p /etc/miniclaw/ssl
        ln -sf /etc/letsencrypt/live/${fqdn}/fullchain.pem /etc/miniclaw/ssl/cert.pem
        ln -sf /etc/letsencrypt/live/${fqdn}/privkey.pem /etc/miniclaw/ssl/key.pem
      `);
    } else {
      job.log(`SSL setup failed (will retry later): ${certResult.stderr}`);
    }
  } catch (error) {
    job.log(`SSL error: ${(error as Error).message}`);
  }
}

/**
 * Create admin user with SSH access
 */
async function createAdminUser(ssh: NodeSSH, userId: string, job: Job): Promise<void> {
  const username = `admin-${userId.substring(0, 8)}`;

  // Create user
  await ssh.execCommand(`
    useradd -m -s /bin/bash ${username} || true
    usermod -aG sudo,docker ${username}
  `);

  // Generate SSH key pair for user
  await ssh.execCommand(`
    mkdir -p /home/${username}/.ssh
    ssh-keygen -t ed25519 -f /home/${username}/.ssh/id_ed25519 -N '' -C "${username}@miniclaw"
    cp /home/${username}/.ssh/id_ed25519.pub /home/${username}/.ssh/authorized_keys
    chown -R ${username}:${username} /home/${username}/.ssh
    chmod 700 /home/${username}/.ssh
    chmod 600 /home/${username}/.ssh/authorized_keys
  `);

  job.log(`Created admin user: ${username}`);
}
