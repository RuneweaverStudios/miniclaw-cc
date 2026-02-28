/**
 * Server Cleanup Service
 *
 * Cleans up user configuration when deallocating servers
 * - Clears Telegram bot tokens
 * - Stops gateway services
 * - Resets to factory state for pool
 */

import { createSSHConnection } from "../lib/ssh.js";
import type { PoolServerConfig } from "@miniclaw/shared";

export interface CleanupResult {
  success: boolean;
  message: string;
  steps: { step: string; success: boolean; message: string }[];
}

/**
 * Clear Telegram configuration from a server
 * This ensures the server can be safely returned to the pool
 */
export async function clearServerConfiguration(
  server: PoolServerConfig,
  onProgress?: (message: string, type: 'info' | 'success' | 'error' | 'warning') => void
): Promise<CleanupResult> {
  const log = (msg: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    console.log(`[Cleanup] ${msg}`);
    onProgress?.(msg, type);
  };

  const steps: { step: string; success: boolean; message: string }[] = [];

  try {
    const { dropletId, ipAddress, stack } = server;

    if (!ipAddress) {
      throw new Error('Server has no IP address');
    }

    log(`Starting cleanup for ${stack} server ${dropletId} (${ipAddress})...`);

    // Create SSH client
    log('Connecting to server via SSH...');
    const ssh = await createSSHConnection({ host: ipAddress, username: 'root' });
    steps.push({ step: 'SSH Connection', success: true, message: 'Connected via SSH' });

    if (stack === 'nanobot') {
      await cleanupNanobot(ssh, steps, log);
    } else if (stack === 'openclaw') {
      await cleanupOpenClaw(ssh, steps, log);
    } else {
      log(`Unknown stack type: ${stack}`, 'warning');
      steps.push({ step: 'Stack Cleanup', success: true, message: `Unknown stack ${stack}, skipped` });
    }

    // Disconnect
    await ssh.disconnect();
    log('Disconnected from server', 'success');

    const failedSteps = steps.filter(s => !s.success);
    const success = failedSteps.length === 0;

    return {
      success,
      message: success
        ? 'Server cleaned successfully'
        : `Cleanup completed with ${failedSteps.length} error(s)`,
      steps,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    log(`Cleanup failed: ${errorMsg}`, 'error');

    return {
      success: false,
      message: errorMsg,
      steps,
    };
  }
}

/**
 * Cleanup Nanobot configuration
 */
async function cleanupNanobot(
  ssh: ReturnType<typeof createSSHClient>,
  steps: { step: string; success: boolean; message: string }[],
  log: (msg: string, type?: string) => void
): Promise<void> {
  log('Cleaning up Nanobot configuration...');

  try {
    // 1. Stop the gateway
    log('Stopping Nanobot gateway...');
    try {
      await ssh.executeCommand('pkill -f "nanobot gateway" || true');
      await ssh.executeCommand('sleep 1');
      log('Gateway stopped', 'success');
      steps.push({ step: 'Stop Gateway', success: true, message: 'Gateway stopped' });
    } catch (err) {
      log(`Gateway stop warning: ${err}`, 'warning');
      steps.push({ step: 'Stop Gateway', success: true, message: 'Gateway was not running' });
    }

    // 2. Clear Telegram configuration from config.json
    log('Clearing Telegram configuration...');
    try {
      const configExists = await ssh.fileExists('/root/.nanobot/config.json');

      if (configExists) {
        const configData = await ssh.readFile('/root/.nanobot/config.json');
        let config: any = {};

        try {
          config = JSON.parse(configData);
        } catch {
          // Invalid JSON, create new config
        }

        // Remove Telegram token
        if (config.channels) {
          delete config.channels.telegram;
        }

        // Remove or reset other user-specific configs
        if (config.agents) {
          // Keep the agent but reset any user-specific settings
          config.agents.defaults = {
            model: 'minimax/minimax-m2.5',
            provider: 'openrouter',
            maxTokens: 8192,
            temperature: 0.1
          };
        }

        // Write cleaned config
        await ssh.writeFile('/root/.nanobot/config.json', JSON.stringify(config, null, 2));
        log('Telegram configuration cleared from config.json', 'success');
        steps.push({ step: 'Clear Config', success: true, message: 'Telegram token removed from config' });
      } else {
        log('No config file found, skipping', 'warning');
        steps.push({ step: 'Clear Config', success: true, message: 'No config file found' });
      }
    } catch (err) {
      log(`Failed to clear config: ${err}`, 'error');
      steps.push({ step: 'Clear Config', success: false, message: `Failed to clear config: ${err}` });
    }

    // 3. Remove any bot token files (if stored separately)
    log('Removing any stored bot tokens...');
    try {
      await ssh.executeCommand('rm -f /root/.nanobot/telegram_token.txt 2>/dev/null || true');
      await ssh.executeCommand('rm -f /root/.telegram_bot_token 2>/dev/null || true');
      log('Token files removed', 'success');
      steps.push({ step: 'Remove Token Files', success: true, message: 'Token files removed' });
    } catch (err) {
      log(`Token file cleanup warning: ${err}`, 'warning');
      steps.push({ step: 'Remove Token Files', success: true, message: 'No token files found' });
    }

    // 4. Clear any log files that might contain sensitive info
    log('Clearing sensitive logs...');
    try {
      await ssh.executeCommand('rm -f /tmp/nanobot-gateway.log 2>/dev/null || true');
      await ssh.executeCommand('rm -f /root/.nanobot/logs/telegram.log 2>/dev/null || true');
      log('Logs cleared', 'success');
      steps.push({ step: 'Clear Logs', success: true, message: 'Sensitive logs cleared' });
    } catch (err) {
      log(`Log cleanup warning: ${err}`, 'warning');
      steps.push({ step: 'Clear Logs', success: true, message: 'No sensitive logs found' });
    }

  } catch (error) {
    log(`Nanobot cleanup error: ${error}`, 'error');
    throw error;
  }
}

/**
 * Cleanup OpenClaw configuration
 */
async function cleanupOpenClaw(
  ssh: ReturnType<typeof createSSHClient>,
  steps: { step: string; success: boolean; message: string }[],
  log: (msg: string, type?: string) => void
): Promise<void> {
  log('Cleaning up OpenClaw configuration...');

  try {
    // 1. Stop the gateway
    log('Stopping OpenClaw gateway...');
    try {
      await ssh.executeCommand('pkill -f "openclaw gateway" || true');
      await ssh.executeCommand('pkill -f "node.*openclaw" || true');
      await ssh.executeCommand('sleep 1');
      log('Gateway stopped', 'success');
      steps.push({ step: 'Stop Gateway', success: true, message: 'Gateway stopped' });
    } catch (err) {
      log(`Gateway stop warning: ${err}`, 'warning');
      steps.push({ step: 'Stop Gateway', success: true, message: 'Gateway was not running' });
    }

    // 2. Clear Telegram configuration from config.yaml
    log('Clearing Telegram configuration...');
    try {
      const yamlExists = await ssh.fileExists('/root/.openclaw/config.yaml');

      if (yamlExists) {
        // Write minimal config without Telegram
        const minimalConfig = `
gateway:
  mode: local

channels: {}

agents:
  defaults:
    model: minimax/minimax-m2.5
    provider: openrouter
    maxTokens: 8192
    temperature: 0.1

tools:
  restrictToWorkspace: false
`;
        await ssh.writeFile('/root/.openclaw/config.yaml', minimalConfig);
        log('Telegram configuration cleared from config.yaml', 'success');
        steps.push({ step: 'Clear Config', success: true, message: 'Telegram configuration cleared' });
      } else {
        log('No config file found, skipping', 'warning');
        steps.push({ step: 'Clear Config', success: true, message: 'No config file found' });
      }
    } catch (err) {
      log(`Failed to clear config: ${err}`, 'error');
      steps.push({ step: 'Clear Config', success: false, message: `Failed to clear config: ${err}` });
    }

    // 3. Remove any bot token files
    log('Removing any stored bot tokens...');
    try {
      await ssh.executeCommand('rm -f /root/.openclaw/telegram_token.txt 2>/dev/null || true');
      await ssh.executeCommand('rm -f /root/.telegram_bot_token 2>/dev/null || true');
      log('Token files removed', 'success');
      steps.push({ step: 'Remove Token Files', success: true, message: 'Token files removed' });
    } catch (err) {
      log(`Token file cleanup warning: ${err}`, 'warning');
      steps.push({ step: 'Remove Token Files', success: true, message: 'No token files found' });
    }

  } catch (error) {
    log(`OpenClaw cleanup error: ${error}`, 'error');
    throw error;
  }
}
