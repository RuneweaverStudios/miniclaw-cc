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
    const sshKey = process.env.SSH_PRIVATE_KEY || process.env.SSH_PRIVATE_KEY_PATH;

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

      // Load SSH key from file if needed
      let privateKey = sshKey;
      if (process.env.SSH_PRIVATE_KEY_PATH) {
        const fs = await import('fs');
        privateKey = fs.readFileSync(process.env.SSH_PRIVATE_KEY_PATH, 'utf8');
      }

      // Connect
      await ssh.connect({
        host: ipAddress,
        username: "root",
        privateKey,
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

      return {
        success: true,
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
    const sshKey = process.env.SSH_PRIVATE_KEY || process.env.SSH_PRIVATE_KEY_PATH;
    if (!sshKey) return false;

    const ssh = new NodeSSH();

    try {
      // Load SSH key from file if needed
      let privateKey = sshKey;
      if (process.env.SSH_PRIVATE_KEY_PATH) {
        const fs = await import('fs');
        privateKey = fs.readFileSync(process.env.SSH_PRIVATE_KEY_PATH, 'utf8');
      }

      await ssh.connect({
        host: ipAddress,
        username: "root",
        privateKey,
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
   * Test gateway and agent response
   * Starts gateway temporarily, verifies it works, then stops it
   */
  async testGateway(ipAddress: string): Promise<{ success: boolean; error?: string }> {
    const sshKey = process.env.SSH_PRIVATE_KEY || process.env.SSH_PRIVATE_KEY_PATH;
    if (!sshKey) return { success: false, error: "SSH key not configured" };

    const ssh = new NodeSSH();

    try {
      // Load SSH key from file if needed
      let privateKey = sshKey;
      if (process.env.SSH_PRIVATE_KEY_PATH) {
        const fs = await import('fs');
        privateKey = fs.readFileSync(process.env.SSH_PRIVATE_KEY_PATH, 'utf8');
      }

      await ssh.connect({
        host: ipAddress,
        username: "root",
        privateKey,
        readyTimeout: 30000,
      });

      console.log(`[OpenClaw] Testing gateway on ${ipAddress}...`);

      const testScript = `
#!/bin/bash
set -e

echo "[OpenClaw] Testing gateway..."

# Start OpenClaw service
echo "[OpenClaw] Starting service for testing..."
systemctl start openclaw || true
sleep 5

# Verify service is running
if ! systemctl is-active --quiet openclaw; then
  echo "[OpenClaw] ERROR: Service failed to start"
  journalctl -u openclaw -n 30
  exit 1
fi

# Test health endpoint
echo "[OpenClaw] Testing health endpoint..."
for i in {1..20}; do
  if curl -sf http://localhost:${this.defaultPort}/health > /dev/null 2>&1; then
    echo "[OpenClaw] Health check passed"
    break
  fi
  if [ $i -eq 20 ]; then
    echo "[OpenClaw] ERROR: Health check failed after 20 attempts"
    exit 1
  fi
  sleep 2
done

echo "[OpenClaw] Gateway test passed"

# Stop service after successful test
echo "[OpenClaw] Stopping service after successful test..."
systemctl stop openclaw || true
sleep 2

# Verify service stopped
if systemctl is-active --quiet openclaw; then
  echo "[OpenClaw] WARNING: Service still running, forcing stop..."
  systemctl kill openclaw || true
fi

echo "[OpenClaw] Service stopped successfully, ready for allocation"
`;

      const result = await ssh.execCommand(testScript, {
        execOptions: { cwd: "/root" },
      });

      if (result.code !== 0) {
        console.error(`[OpenClaw] Gateway test failed:`, result.stderr);
        return {
          success: false,
          error: result.stderr || "Gateway test failed",
        };
      }

      console.log(`[OpenClaw] Gateway test successful on ${ipAddress}`);
      return { success: true };

    } catch (error) {
      console.error(`[OpenClaw] Gateway test error:`, error);
      return {
        success: false,
        error: (error as Error).message,
      };
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
    const sshKey = process.env.SSH_PRIVATE_KEY || process.env.SSH_PRIVATE_KEY_PATH;
    if (!sshKey) return { running: false };

    const ssh = new NodeSSH();

    try {
      // Load SSH key from file if needed
      let privateKey = sshKey;
      if (process.env.SSH_PRIVATE_KEY_PATH) {
        const fs = await import('fs');
        privateKey = fs.readFileSync(process.env.SSH_PRIVATE_KEY_PATH, 'utf8');
      }

      await ssh.connect({
        host: ipAddress,
        username: "root",
        privateKey,
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
  private async waitForSSH(ipAddress: string, maxAttempts = 60): Promise<void> {
    const sshKey = process.env.SSH_PRIVATE_KEY || process.env.SSH_PRIVATE_KEY_PATH;
    if (!sshKey) throw new Error("SSH key not configured");

    const ssh = new NodeSSH();

    for (let i = 0; i < maxAttempts; i++) {
      try {
        // Load SSH key from file if needed
        let privateKey = sshKey;
        if (process.env.SSH_PRIVATE_KEY_PATH) {
          const fs = await import('fs');
          privateKey = fs.readFileSync(process.env.SSH_PRIVATE_KEY_PATH, 'utf8');
        }

        await ssh.connect({
          host: ipAddress,
          username: "root",
          privateKey,
          readyTimeout: 5000,
        });
        ssh.dispose();
        console.log(`[OpenClaw] SSH available for ${ipAddress} (attempt ${i + 1}/${maxAttempts})`);
        return;
      } catch {
        console.log(`[OpenClaw] Waiting for SSH on ${ipAddress}... (${i + 1}/${maxAttempts})`);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    throw new Error(`SSH did not become available for ${ipAddress}`);
  }
}

export const openclawService = new OpenClawService();
