/**
 * OpenClaw Service - Installation and management
 */

import { NodeSSH } from "node-ssh";
import type { PoolServerConfig } from "@miniclaw/shared";

export interface OpenClawInstallOptions {
  ipAddress: string;
  version: string;
  config?: Record<string, unknown>;
}

export interface OpenClawInstallResult {
  success: boolean;
  error?: string;
  port: number;
  adminUrl: string;
}

/**
 * OpenClaw service class
 */
export class OpenClawService {
  private defaultPort = 8080;

  /**
   * Install OpenClaw on a server
   */
  async install(options: OpenClawInstallOptions): Promise<OpenClawInstallResult> {
    const { ipAddress, version, config = {} } = options;
    const sshKey = process.env.SSH_PRIVATE_KEY;

    if (!sshKey) {
      return {
        success: false,
        error: "SSH key not configured",
        port: this.defaultPort,
        adminUrl: "",
      };
    }

    const ssh = new NodeSSH();

    try {
      // Wait for SSH
      await this.waitForSSH(ipAddress);

      // Connect
      await ssh.connect({
        host: ipAddress,
        username: "root",
        privateKey: sshKey,
        readyTimeout: 30000,
      });

      // Wait for cloud-init
      await ssh.execCommand("cloud-init status --wait");

      // Install OpenClaw using official install script
      console.log(`[OpenClaw] Installing v${version} on ${ipAddress}`);

      const installScript = `
        set -euo pipefail

        # Install dependencies
        apt-get update
        apt-get install -y curl nodejs npm

        # Run OpenClaw install script
        curl -fsSL https://openclaw.ai/install.sh | bash

        # Wait for service to start
        echo "Waiting for OpenClaw to start..."
        for i in {1..60}; do
          if curl -sf http://localhost:${this.defaultPort}/health > /dev/null 2>&1; then
            echo "OpenClaw is healthy!"
            break
          fi
          echo "Waiting... ($i/60)"
          sleep 2
        done

        # Configure if needed
        ${config ? this.generateConfig(config) : ""}

        echo "OpenClaw installation complete"
      `;

      const result = await ssh.execCommand(installScript, {
        execOptions: { cwd: "/root" },
      });

      if (result.code !== 0) {
        return {
          success: false,
          error: result.stderr || "Installation failed",
          port: this.defaultPort,
          adminUrl: `http://${ipAddress}:${this.defaultPort}`,
        };
      }

      // Verify installation
      const healthResult = await ssh.execCommand(
        `curl -sf http://localhost:${this.defaultPort}/health`
      );

      return {
        success: healthResult.code === 0,
        error: healthResult.code !== 0 ? "Health check failed" : undefined,
        port: this.defaultPort,
        adminUrl: `http://${ipAddress}:${this.defaultPort}`,
      };

    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        port: this.defaultPort,
        adminUrl: `http://${ipAddress}:${this.defaultPort}`,
      };
    } finally {
      ssh.dispose();
    }
  }

  /**
   * Generate OpenClaw configuration
   */
  private generateConfig(config: Record<string, unknown>): string {
    // OpenClaw typically uses environment variables or config file
    const lines: string[] = [];

    for (const [key, value] of Object.entries(config)) {
      lines.push(`export OPENCLAW_${key.toUpperCase()}=${JSON.stringify(value)}`);
    }

    return lines.length > 0
      ? `
        # OpenClaw Configuration
        ${lines.join("\n")}
      `
      : "";
  }

  /**
   * Verify OpenClaw installation
   */
  async verify(ipAddress: string): Promise<boolean> {
    const sshKey = process.env.SSH_PRIVATE_KEY;
    if (!sshKey) return false;

    const ssh = new NodeSSH();

    try {
      await ssh.connect({
        host: ipAddress,
        username: "root",
        privateKey: sshKey,
        readyTimeout: 10000,
      });

      const result = await ssh.execCommand(
        `curl -sf http://localhost:${this.defaultPort}/health`
      );

      return result.code === 0;
    } catch {
      return false;
    } finally {
      ssh.dispose();
    }
  }

  /**
   * Get OpenClaw status
   */
  async getStatus(ipAddress: string): Promise<{
    running: boolean;
    version?: string;
    uptime?: number;
  }> {
    const sshKey = process.env.SSH_PRIVATE_KEY;
    if (!sshKey) return { running: false };

    const ssh = new NodeSSH();

    try {
      await ssh.connect({
        host: ipAddress,
        username: "root",
        privateKey: sshKey,
        readyTimeout: 10000,
      });

      const serviceResult = await ssh.execCommand("systemctl is-active openclaw");
      const running = serviceResult.stdout.trim() === "active";

      if (!running) return { running: false };

      // Get version and uptime
      const statusResult = await ssh.execCommand(`
        openclaw version 2>/dev/null || echo "unknown"
        systemctl show openclaw --property=ExecMainStartTimestamp --value
      `);

      const lines = statusResult.stdout.split("\n");
      const version = lines[0]?.trim() || "unknown";

      return { running, version };
    } catch {
      return { running: false };
    } finally {
      ssh.dispose();
    }
  }

  /**
   * Wait for SSH to be available
   */
  private async waitForSSH(ipAddress: string, maxAttempts = 30): Promise<void> {
    const sshKey = process.env.SSH_PRIVATE_KEY;
    if (!sshKey) throw new Error("SSH key not configured");

    const ssh = new NodeSSH();

    for (let i = 0; i < maxAttempts; i++) {
      try {
        await ssh.connect({
          host: ipAddress,
          username: "root",
          privateKey: sshKey,
          readyTimeout: 5000,
        });
        ssh.dispose();
        return;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    throw new Error(`SSH did not become available for ${ipAddress}`);
  }
}

export const openclawService = new OpenClawService();
