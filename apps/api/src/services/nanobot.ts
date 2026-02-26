/**
 * Nanobot Service - Installation and management
 *
 * Nanobot is a Python-based AI agent framework installed via pip
 */

import { NodeSSH } from "node-ssh";
import type { PoolServerConfig } from "@miniclaw/shared";

export interface NanobotInstallOptions {
  ipAddress: string;
  version: string;
  config?: Record<string, unknown>;
}

export interface NanobotInstallResult {
  success: boolean;
  error?: string;
  port: number;
  adminUrl: string;
  venvPath: string;
}

/**
 * Nanobot service class
 */
export class NanobotService {
  private defaultPort = 3000;
  private venvPath = "/opt/nanobot";
  private configPath = "/etc/nanobot";

  /**
   * Install Nanobot on a server
   */
  async install(options: NanobotInstallOptions): Promise<NanobotInstallResult> {
    const { ipAddress, version, config = {} } = options;
    const sshKey = process.env.SSH_PRIVATE_KEY;

    if (!sshKey) {
      return {
        success: false,
        error: "SSH key not configured",
        port: this.defaultPort,
        adminUrl: "",
        venvPath: this.venvPath,
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

      // Install Nanobot using pip
      console.log(`[Nanobot] Installing v${version} on ${ipAddress}`);

      const installScript = `
        set -euo pipefail

        # Install Python and dependencies
        apt-get update
        apt-get install -y python3 python3-pip python3-venv python3-dev git

        # Create virtual environment
        python3 -m venv ${this.venvPath}
        source ${this.venvPath}/bin/activate

        # Install Nanobot
        if [ "${version}" = "latest" ]; then
          pip install nanobot-ai
        else
          pip install nanobot-ai==${version}
        fi

        # Create config directory
        mkdir -p ${this.configPath}

        # Generate configuration
        ${this.generateConfig(config)}

        # Create systemd service
        cat > /etc/systemd/system/nanobot.service << 'EOF'
        [Unit]
        Description=Nanobot AI Agent
        After=network-online.target
        Wants=network-online.target

        [Service]
        Type=simple
        User=root
        WorkingDirectory=${this.venvPath}
        Environment="PATH=${this.venvPath}/bin:/usr/local/bin:/usr/bin:/bin"
        Environment="NANOBOT_HOME=${this.configPath}"
        ExecStart=${this.venvPath}/bin/nanobot start --config ${this.configPath}/config.yaml
        Restart=always
        RestartSec=10
        StandardOutput=journal
        StandardError=journal

        [Install]
        WantedBy=multi-user.target
        EOF

        systemctl daemon-reload
        systemctl enable nanobot

        # Start Nanobot
        systemctl start nanobot

        # Wait for health check
        echo "Waiting for Nanobot to start..."
        for i in {1..60}; do
          if ${this.venvPath}/bin/nanobot health-check 2>/dev/null; then
            echo "Nanobot is healthy!"
            break
          fi
          # Try HTTP health endpoint
          if curl -sf http://localhost:${this.defaultPort}/health > /dev/null 2>&1; then
            echo "Nanobot HTTP health check passed!"
            break
          fi
          echo "Waiting... ($i/60)"
          sleep 2
        done

        echo "Nanobot installation complete"
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
          venvPath: this.venvPath,
        };
      }

      // Verify installation
      const healthResult = await ssh.execCommand(
        `source ${this.venvPath}/bin/activate && nanobot health-check`
      );

      return {
        success: healthResult.code === 0,
        error: healthResult.code !== 0 ? "Health check failed" : undefined,
        port: this.defaultPort,
        adminUrl: `http://${ipAddress}:${this.defaultPort}`,
        venvPath: this.venvPath,
      };

    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        port: this.defaultPort,
        adminUrl: `http://${ipAddress}:${this.defaultPort}`,
        venvPath: this.venvPath,
      };
    } finally {
      ssh.dispose();
    }
  }

  /**
   * Generate Nanobot configuration
   */
  private generateConfig(config: Record<string, unknown>): string {
    // Nanobot uses YAML configuration
    const yamlLines: string[] = [
      `cat > ${this.configPath}/config.yaml << 'EOF'`,
      `# Nanobot Configuration`,
      `host: 0.0.0.0`,
      `port: ${this.defaultPort}`,
      ``,
    ];

    // Add configuration values
    for (const [key, value] of Object.entries(config)) {
      if (typeof value === "string") {
        yamlLines.push(`${key}: "${value}"`);
      } else if (typeof value === "boolean") {
        yamlLines.push(`${key}: ${value}`);
      } else if (typeof value === "number") {
        yamlLines.push(`${key}: ${value}`);
      } else if (Array.isArray(value)) {
        yamlLines.push(`${key}:`);
        for (const item of value) {
          yamlLines.push(`  - ${JSON.stringify(item)}`);
        }
      } else {
        yamlLines.push(`${key}: ${JSON.stringify(value)}`);
      }
    }

    yamlLines.push("EOF");

    return yamlLines.join("\n");
  }

  /**
   * Verify Nanobot installation
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

      // Try health check via CLI first
      const cliResult = await ssh.execCommand(
        `source ${this.venvPath}/bin/activate && nanobot health-check`
      );

      if (cliResult.code === 0) return true;

      // Fall back to HTTP check
      const httpResult = await ssh.execCommand(
        `curl -sf http://localhost:${this.defaultPort}/health`
      );

      return httpResult.code === 0;
    } catch {
      return false;
    } finally {
      ssh.dispose();
    }
  }

  /**
   * Get Nanobot status
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

      const serviceResult = await ssh.execCommand("systemctl is-active nanobot");
      const running = serviceResult.stdout.trim() === "active";

      if (!running) return { running: false };

      // Get version via pip
      const versionResult = await ssh.execCommand(
        `source ${this.venvPath}/bin/activate && pip show nanobot-ai | grep Version | cut -d' ' -f2`
      );

      const version = versionResult.stdout.trim() || "unknown";

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

export const nanobotService = new NanobotService();
