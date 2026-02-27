/**
 * Nanobot Service - Installation and management
 *
 * Nanobot is a Python-based AI agent framework installed via pip
 * Docs: https://github.com/HKUDS/nanobot
 *
 * Version: 0.1.3.post4 (PyPI stable version, avoids oauth-cli-kit dependency)
 * Config: ~/.nanobot/config.json (JSON format)
 * Gateway: nanobot gateway
 */

import { NodeSSH } from "node-ssh";
import type { PoolServerConfig } from "@miniclaw/shared";

export interface NanobotInstallOptions {
  ipAddress: string;
  version?: string;
  config?: Record<string, unknown>;
}

export interface NanobotInstallResult {
  success: boolean;
  error?: string;
  gatewayRunning: boolean;
}

/**
 * Nanobot service class
 */
export class NanobotService {
  private readonly defaultVersion = "0.1.3.post7"; // PyPI stable version (avoids oauth-cli-kit)
  private readonly configPath = "/root/.nanobot/config.json";
  private readonly workspacePath = "/root/.nanobot/workspace";

  /**
   * Install Nanobot on a server
   */
  async install(options: NanobotInstallOptions): Promise<NanobotInstallResult> {
    const { ipAddress, version = this.defaultVersion, config = {} } = options;
    const sshKey = process.env.SSH_PRIVATE_KEY || process.env.SSH_PRIVATE_KEY_PATH;

    if (!sshKey) {
      return {
        success: false,
        error: "SSH key not configured",
        gatewayRunning: false,
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

      // Wait for cloud-init to complete
      console.log(`[Nanobot] Waiting for cloud-init on ${ipAddress}...`);
      await this.waitForCloudInit(ssh);

      // Install Nanobot
      console.log(`[Nanobot] Installing v${version} on ${ipAddress}`);

      const installScript = `
set -e

export DEBIAN_FRONTEND=noninteractive

echo "[Nanobot] Installing system dependencies..."
apt-get update -qq

# Add deadsnakes PPA for Python 3.11
echo "[Nanobot] Adding deadsnakes PPA for Python 3.11..."
apt-get install -y -qq software-properties-common
add-apt-repository ppa:deadsnakes/ppa -y
apt-get update -qq

# Install Python 3.11 and pip
echo "[Nanobot] Installing Python 3.11..."
apt-get install -y -qq python3.11 python3.11-venv python3-pip python3-dev curl git

echo "[Nanobot] Installing Nanobot from PyPI (v${version})..."
# Use PyPI version to avoid oauth-cli-kit dependency
# Ignore installed typing_extensions to avoid debian package conflicts
pip3 install nanobot-ai==${version} --break-system-packages --ignore-installed typing_extensions

# Verify installation
echo "[Nanobot] Verifying installation..."
nanobot --version

echo "[Nanobot] Initializing configuration..."
# Create initial config and workspace
yes "" | nanobot onboard || true

echo "[Nanobot] Creating systemd service..."
# Create systemd service for gateway
cat > /etc/systemd/system/nanobot-gateway.service << 'EOF'
[Unit]
Description=Nanobot Gateway
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/root
ExecStart=/usr/local/bin/nanobot gateway
Restart=always
RestartSec=10
Environment="PATH=/usr/local/bin:/usr/bin:/bin"

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/root/.nanobot
ReadWritePaths=/tmp

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=nanobot-gateway

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable nanobot-gateway

echo "[Nanobot] Installation complete!"
`;

      const result = await ssh.execCommand(installScript, {
        execOptions: { cwd: "/root" },
      });

      if (result.code !== 0) {
        console.error(`[Nanobot] Installation failed:`, result.stderr);
        return {
          success: false,
          error: result.stderr || "Installation failed",
          gatewayRunning: false,
        };
      }

      console.log(`[Nanobot] Installation successful on ${ipAddress}`);

      return {
        success: true,
        gatewayRunning: false, // Not started yet, will be started when Telegram is configured
      };

    } catch (error) {
      console.error(`[Nanobot] Installation error:`, error);
      return {
        success: false,
        error: (error as Error).message,
        gatewayRunning: false,
      };
    } finally {
      ssh.dispose();
    }
  }

  /**
   * Configure Nanobot with model and Telegram
   */
  async configure(options: {
    ipAddress: string;
    model: string;
    botToken: string;
  }): Promise<{ success: boolean; error?: string }> {
    const sshKey = process.env.SSH_PRIVATE_KEY || process.env.SSH_PRIVATE_KEY_PATH;
    if (!sshKey) {
      return { success: false, error: "SSH key not configured" };
    }

    const ssh = new NodeSSH();

    try {
      // Load SSH key from file if needed
      let privateKey = sshKey;
      if (process.env.SSH_PRIVATE_KEY_PATH) {
        const fs = await import('fs');
        privateKey = fs.readFileSync(process.env.SSH_PRIVATE_KEY_PATH, 'utf8');
      }

      await ssh.connect({
        host: options.ipAddress,
        username: "root",
        privateKey,
        readyTimeout: 30000,
      });

      // Parse model to extract provider
      let provider = 'openrouter';
      let modelName = options.model;

      if (options.model.includes('/')) {
        const parts = options.model.split('/');
        provider = parts[0];
        modelName = parts.slice(1).join('/');
      }

      // Map providers
      const providerMap: Record<string, string> = {
        'openrouter': 'openrouter',
        'anthropic': 'anthropic',
        'openai': 'openai',
        'minimax': 'minimax',
        'deepseek': 'deepseek',
        'groq': 'groq',
      };

      const nanobotProvider = providerMap[provider] || 'openrouter';

      // Build configuration
      const configScript = `
#!/bin/bash
set -e

echo "[Nanobot] Configuring model '${options.model}' and Telegram..."

# Read existing config if exists
if [ -f /root/.nanobot/config.json ]; then
  CONFIG=$(cat /root/.nanobot/config.json)
else
  CONFIG='{}'
fi

# Update config with jq
# Install jq if needed
if ! command -v jq &> /dev/null; then
  apt-get install -y -qq jq
fi

# Configure provider
echo "[Nanobot] Configuring ${nanobotProvider} provider..."
CONFIG=$(echo "$CONFIG" | jq \\
  --arg api_key "${process.env.OPENROUTER_API_KEY || ''}" \\
  '.providers.openrouter = { apiKey: $api_key }')

# Configure default agent
echo "[Nanobot] Setting model: ${modelName}..."
CONFIG=$(echo "$CONFIG" | jq \\
  --arg model "${modelName}" \\
  --arg provider "${nanobotProvider}" \\
  '.agents.defaults.model = $model | .agents.defaults.provider = $provider')

# Configure Telegram
echo "[Nanobot] Configuring Telegram channel..."
CONFIG=$(echo "$CONFIG" | jq \\
  --arg token "${options.botToken}" \\
  '.channels.telegram = { enabled: true, token: $token, allowFrom: [] }')

# Write config
echo "$CONFIG" > /root/.nanobot/config.json
echo "[Nanobot] Config written with ${nanobotProvider}/${modelName} and Telegram"

# Restart gateway
echo "[Nanobot] Restarting gateway..."
pkill -f "nanobot gateway" || true
sleep 2
nohup nanobot gateway > /tmp/nanobot-gateway.log 2>&1 &
sleep 3

# Verify
if pgrep -f "nanobot gateway" > /dev/null; then
  echo "[Nanobot] Gateway restarted successfully"
else
  echo "[Nanobot] ERROR: Gateway not running"
  tail -20 /tmp/nanobot-gateway.log
  exit 1
fi

echo "[Nanobot] Configuration complete!"
`;

      const result = await ssh.execCommand(configScript);

      if (result.code !== 0) {
        console.error(`[Nanobot] Configuration failed:`, result.stderr);
        return {
          success: false,
          error: result.stderr || "Configuration failed",
        };
      }

      console.log(`[Nanobot] Configuration successful on ${options.ipAddress}`);
      return { success: true };

    } catch (error) {
      console.error(`[Nanobot] Configuration error:`, error);
      return {
        success: false,
        error: (error as Error).message,
      };
    } finally {
      ssh.dispose();
    }
  }

  /**
   * Verify Nanobot installation and gateway status
   */
  async verify(ipAddress: string): Promise<{
    installed: boolean;
    gatewayRunning: boolean;
    version?: string;
  }> {
    const sshKey = process.env.SSH_PRIVATE_KEY || process.env.SSH_PRIVATE_KEY_PATH;
    if (!sshKey) return { installed: false, gatewayRunning: false };

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

      // Check if nanobot command exists
      const whichResult = await ssh.execCommand("which nanobot");
      const installed = whichResult.code === 0;

      if (!installed) {
        return { installed: false, gatewayRunning: false };
      }

      // Get version
      const versionResult = await ssh.execCommand(
        "pip3 show nanobot-ai 2>/dev/null | grep Version | cut -d' ' -f2"
      );
      const version = versionResult.stdout.trim() || undefined;

      // Check if gateway is running
      const gatewayResult = await ssh.execCommand("pgrep -f 'nanobot gateway'");
      const gatewayRunning = gatewayResult.code === 0;

      return { installed: true, gatewayRunning, version };

    } catch {
      return { installed: false, gatewayRunning: false };
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
    configExists: boolean;
  }> {
    const sshKey = process.env.SSH_PRIVATE_KEY || process.env.SSH_PRIVATE_KEY_PATH;
    if (!sshKey) return { running: false, configExists: false };

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

      // Check if gateway is running
      const gatewayResult = await ssh.execCommand("pgrep -f 'nanobot gateway'");
      const running = gatewayResult.code === 0;

      // Check if config exists
      const configResult = await ssh.execCommand("test -f /root/.nanobot/config.json && echo 'exists'");
      const configExists = configResult.stdout.trim() === 'exists';

      // Get version
      const versionResult = await ssh.execCommand(
        "pip3 show nanobot-ai 2>/dev/null | grep Version | cut -d' ' -f2"
      );
      const version = versionResult.stdout.trim() || undefined;

      return { running, version, configExists };

    } catch {
      return { running: false, configExists: false };
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
        console.log(`[Nanobot] SSH available for ${ipAddress} (attempt ${i + 1}/${maxAttempts})`);
        return;
      } catch {
        console.log(`[Nanobot] Waiting for SSH on ${ipAddress}... (${i + 1}/${maxAttempts})`);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    throw new Error(`SSH did not become available for ${ipAddress}`);
  }

  /**
   * Wait for cloud-init to complete
   */
  private async waitForCloudInit(ssh: NodeSSH, maxAttempts = 40): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      const result = await ssh.execCommand("cloud-init status --wait 2>&1");
      if (result.stdout.includes('done') || result.stdout.includes('status: done')) {
        console.log('[Nanobot] cloud-init completed');
        return;
      }
      console.log(`[Nanobot] Waiting for cloud-init... (${i + 1}/${maxAttempts})`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    console.log('[Nanobot] cloud-init wait timeout, continuing...');
  }
}

export const nanobotService = new NanobotService();
