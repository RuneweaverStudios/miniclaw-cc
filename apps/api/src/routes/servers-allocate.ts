import { Hono } from 'hono';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { getDb } from '../lib/db/index.js';
import { users, userServers } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import * as auth from '../services/auth.js';
import { SSHClient, createSSHConnection } from '../lib/ssh.js';

/** Load SSH private key from env (SSH_PRIVATE_KEY or SSH_PRIVATE_KEY_PATH). */
function getSSHPrivateKey(): string | undefined {
  if (process.env.SSH_PRIVATE_KEY) return process.env.SSH_PRIVATE_KEY;
  if (process.env.SSH_PRIVATE_KEY_PATH) {
    try {
      return readFileSync(process.env.SSH_PRIVATE_KEY_PATH, 'utf8');
    } catch (e) {
      console.error('[SSH] Failed to read SSH_PRIVATE_KEY_PATH:', e);
    }
  }
  return undefined;
}

const allocateRoutes = new Hono();

// Progress callback type for streaming updates
type ProgressCallback = (message: string, type: 'info' | 'success' | 'error' | 'warning') => void;

// Helper function to configure Nanobot with model and Telegram bot token
// Configuration format: ~/.nanobot/config.json (JSON)
// Docs: https://github.com/HKUDS/nanobot
async function configureNanobot(
  ssh: SSHClient,
  botToken: string,
  model: string,
  dropletOpenRouterKey?: string,
  onProgress?: ProgressCallback
): Promise<void> {
  const log = (msg: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    console.log(`[Nanobot] ${msg}`);
    onProgress?.(msg, type);
  };

  log(`Configuring model '${model}' and Telegram...`);

  // Parse model to extract provider
  // Nanobot model format: "provider/model" or just "model"
  // Examples: "openrouter/anthropic/claude-opus-4-5" or "anthropic/claude-opus-4-5"
  let provider = 'openrouter'; // default
  let modelName = model;

  if (model.includes('/')) {
    const parts = model.split('/');
    provider = parts[0];
    modelName = parts.slice(1).join('/');
  }

  // Map common providers to Nanobot's provider names
  const providerMap: Record<string, string> = {
    'openrouter': 'openrouter',
    'anthropic': 'anthropic',
    'openai': 'openai',
    'minimax': 'minimax',
    'deepseek': 'deepseek',
    'groq': 'groq',
    'gemini': 'gemini',
  };

  const nanobotProvider = providerMap[provider] || 'openrouter';

  log(`Provider: ${nanobotProvider}, Model: ${modelName}`);

  // Check if config exists
  log('Checking existing configuration...');
  const configExists = await ssh.fileExists('/root/.nanobot/config.json');

  let config: any = {};

  if (configExists) {
    try {
      const existingConfig = await ssh.readFile('/root/.nanobot/config.json');
      config = JSON.parse(existingConfig);
      log('Loaded existing config');
    } catch (err) {
      log('Creating new config', 'warning');
    }
  } else {
    log('Creating new config');
  }

  // Configure provider with API key from environment
  log(`Configuring ${nanobotProvider} provider...`);
  config.providers = config.providers || {};

  if (nanobotProvider === 'openrouter') {
    config.providers.openrouter = {
      apiKey: dropletOpenRouterKey || process.env.OPENROUTER_API_KEY || ''
    };
  } else if (nanobotProvider === 'anthropic') {
    config.providers.anthropic = {
      apiKey: process.env.ANTHROPIC_API_KEY || ''
    };
  } else if (nanobotProvider === 'openai') {
    config.providers.openai = {
      apiKey: process.env.OPENAI_API_KEY || ''
    };
  } else if (nanobotProvider === 'minimax') {
    config.providers.minimax = {
      apiKey: process.env.MINIMAX_API_KEY || '',
      groupId: process.env.MINIMAX_GROUP_ID || ''
    };
  } else if (nanobotProvider === 'deepseek') {
    config.providers.deepseek = {
      apiKey: process.env.DEEPSEEK_API_KEY || ''
    };
  } else if (nanobotProvider === 'groq') {
    config.providers.groq = {
      apiKey: process.env.GROQ_API_KEY || ''
    };
  }

  // Configure default agent with selected model
  log(`Setting model: ${modelName}`);
  config.agents = config.agents || {};
  config.agents.defaults = {
    model: modelName,
    provider: nanobotProvider,
    maxTokens: 8192,
    temperature: 0.1
  };

  // Configure Telegram channel
  log('Configuring Telegram channel...');
  config.channels = config.channels || {};
  config.channels.telegram = {
    enabled: true,
    token: botToken,
    allowFrom: [] // Allow all users initially
  };

  // Configure tools
  config.tools = config.tools || {};
  config.tools.restrictToWorkspace = false;
  config.tools.exec = { pathAppend: '' };

  // Write config
  log('Writing configuration file...');
  await ssh.mkdir('/root/.nanobot', true);
  await ssh.writeFile('/root/.nanobot/config.json', JSON.stringify(config, null, 2));
  log(`Config written with ${nanobotProvider}/${modelName} and Telegram`, 'success');

  // Restart Nanobot gateway
  // Note: Nanobot (Python) has lighter memory footprint than OpenClaw (Node.js)
  // No need for memory limit on 1GB droplets
  log('Restarting Nanobot gateway...');
  try {
    await ssh.executeCommand('pkill -f "nanobot gateway" || true');
    await ssh.executeCommand('sleep 2');
    await ssh.executeCommand('nohup nanobot gateway > /tmp/nanobot-gateway.log 2>&1 &');
    await ssh.executeCommand('sleep 3');

    // Verify it's running
    log('Verifying gateway is running...');
    const psResult = await ssh.executeCommand('ps aux | grep "[n]anobot gateway"');
    if (psResult.trim()) {
      log('Gateway restarted successfully', 'success');
    } else {
      throw new Error('Gateway process not found after restart');
    }
  } catch (err) {
    log(`Failed to restart gateway: ${err}`, 'error');
    // Check logs
    try {
      const logs = await ssh.executeCommand('tail -20 /tmp/nanobot-gateway.log 2>/dev/null || echo "No logs yet"');
      log(`Logs: ${logs}`, 'error');
    } catch {}
    throw new Error('Failed to restart Nanobot gateway');
  }
}

// Helper function to configure OpenClaw with model and Telegram bot token
async function configureOpenClaw(
  ssh: SSHClient,
  botToken: string,
  model: string,
  dropletOpenRouterKey?: string,
  onProgress?: ProgressCallback
): Promise<void> {
  const log = (msg: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    console.log(`[OpenClaw] ${msg}`);
    onProgress?.(msg, type);
  };

  log(`Configuring model '${model}' and Telegram...`);

  // Parse model to extract provider (same logic as Nanobot)
  let provider = 'openrouter';
  let modelName = model;

  if (model.includes('/')) {
    const parts = model.split('/');
    provider = parts[0];
    modelName = parts.slice(1).join('/');
  }

  const providerMap: Record<string, string> = {
    'openrouter': 'openrouter',
    'anthropic': 'anthropic',
    'openai': 'openai',
    'minimax': 'minimax',
    'deepseek': 'deepseek',
    'groq': 'groq',
    'gemini': 'gemini',
  };

  const openclawProvider = providerMap[provider] || 'openrouter';
  log(`Provider: ${openclawProvider}, Model: ${modelName}`);

  // Check if config file exists (OpenClaw supports JSON or YAML)
  log('Checking existing configuration...');
  const jsonConfigExists = await ssh.fileExists('/root/.openclaw/openclaw.json');
  const yamlConfigExists = await ssh.fileExists('/root/.openclaw/config.yaml');

  // Use JSON config for simplicity and consistency with Nanobot
  const configPath = '/root/.openclaw/openclaw.json';
  let config: any = {};

  if (jsonConfigExists) {
    try {
      const existingConfig = await ssh.readFile(configPath);
      config = JSON.parse(existingConfig);
      log('Loaded existing JSON config');
    } catch (err) {
      log('Creating new config', 'warning');
    }
  } else if (yamlConfigExists) {
    // If YAML exists, we'll convert to JSON
    log('Found YAML config, will convert to JSON');
  }

  // Configure providers with API key
  log(`Configuring ${openclawProvider} provider...`);
  config.env = config.env || {};
  config.providers = config.providers || {};

  if (openclawProvider === 'openrouter') {
    config.env.OPENROUTER_API_KEY = dropletOpenRouterKey || process.env.OPENROUTER_API_KEY || '';
    config.providers.openrouter = {
      apiKey: dropletOpenRouterKey || process.env.OPENROUTER_API_KEY || ''
    };
  } else if (openclawProvider === 'anthropic') {
    config.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
    config.providers.anthropic = {
      apiKey: process.env.ANTHROPIC_API_KEY || ''
    };
  } else if (openclawProvider === 'openai') {
    config.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
    config.providers.openai = {
      apiKey: process.env.OPENAI_API_KEY || ''
    };
  }

  // Configure agents with model - THIS IS THE FIX
  // OpenClaw expects agents.defaults.model as a string, not an object
  log(`Setting model: ${modelName}`);
  config.agents = config.agents || {};
  config.agents.defaults = {
    model: modelName,
    provider: openclawProvider,
    maxTokens: 8192,
    temperature: 0.1
  };

  // Configure Telegram channel
  log('Configuring Telegram channel...');
  config.channels = config.channels || {};
  config.channels.telegram = {
    enabled: true,
    botToken: botToken,
    allowFrom: [],
    dmPolicy: 'pairing'
  };

  // Ensure gateway mode is set
  config.gateway = config.gateway || {};
  config.gateway.mode = 'local';

  // Write config
  log('Writing configuration file...');
  await ssh.mkdir('/root/.openclaw', true);
  await ssh.writeFile(configPath, JSON.stringify(config, null, 2));
  log(`Config written with ${openclawProvider}/${modelName} and Telegram`, 'success');

  // Restart OpenClaw gateway with memory limit for 1GB droplets
  log('Restarting OpenClaw gateway (with memory limit for 1GB)...');
  try {
    await ssh.executeCommand('pkill -f "openclaw gateway" || true');
    await ssh.executeCommand('sleep 2');
    // Use memory limit for 1GB droplets
    await ssh.executeCommand('NODE_OPTIONS="--max-old-space-size=768" nohup openclaw gateway > /tmp/openclaw-gateway.log 2>&1 &');
    await ssh.executeCommand('sleep 3');

    // Verify it's running
    log('Verifying gateway is running...');
    const psResult = await ssh.executeCommand('ps aux | grep "[o]penclaw-gateway"');
    if (psResult.trim()) {
      log('Gateway restarted successfully', 'success');
    } else {
      throw new Error('Gateway process not found after restart');
    }
  } catch (err) {
    log(`Failed to restart gateway: ${err}`, 'error');
    // Check logs
    try {
      const logs = await ssh.executeCommand('tail -20 /tmp/openclaw-gateway.log 2>/dev/null || echo "No logs yet"');
      log(`Logs: ${logs}`, 'error');
    } catch {}
    throw new Error('Failed to restart OpenClaw gateway');
  }
}

// Validation schema
const allocateSchema = z.object({
  framework: z.enum(['nanobot', 'openclaw']),
  model: z.string(),
  channel: z.enum(['telegram', 'discord', 'whatsapp']).default('telegram'),
});

// Middleware to verify JWT and extract userId
async function authMiddleware(c: any, next: any) {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return c.json({
      error: {
        message: 'Authentication required',
      },
    }, 401);
  }

  try {
    const payload = auth.verifyToken(token);
    c.set('userId', payload.userId);
    c.set('userEmail', payload.email);
    await next();
  } catch (error) {
    return c.json({
      error: {
        message: 'Invalid or expired token',
      },
    }, 401);
  }
}

// POST /api/servers/allocate - Allocate a droplet from standby pool
allocateRoutes.post('/allocate', authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { framework, model, channel } = allocateSchema.parse(body);

    const userId = c.get('userId') as string;
    const db = getDb();

    // TODO: For now, we'll simulate allocation
    // In production, this would:
    // 1. Check the standby pool for available droplets
    // 2. Allocate a droplet from the pool
    // 3. Install the selected framework (Nanobot/OpenClaw)
    // 4. Configure the model and channel
    // 5. Return the droplet details

    // Simulate droplet allocation
    const dropletId = Math.floor(Math.random() * 1000000) + 1000000;
    const ipAddress = `104.234.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;

    const allocation = {
      dropletId,
      name: `miniclaw-${framework}-${dropletId}`,
      ipAddress,
      status: 'provisioning',
      framework,
      model,
      channel,
      sshCommand: `ssh root@${ipAddress}`,
    };

    // Create user server record
    await db.insert(userServers).values({
      id: randomUUID(),
      userId,
      dropletId,
      hostname: allocation.name,
      fqdn: `${allocation.name}.miniclaw.xyz`,
      stack: framework,
      stackVersion: '1.0.0',
      region: 'nyc1',
      size: 's-1vcpu-1gb',
      ipAddress,
      status: 'provisioning',
      config: {
        monitoringEnabled: false,
        alertsEnabled: false,
        backupEnabled: false,
        customDomains: [],
        environmentVariables: {},
        model: model, // Store the selected model
      },
    });

    return c.json(allocation);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({
        error: {
          message: 'Invalid input',
          details: error.errors,
        },
      }, 400);
    }

    console.error('Allocation error:', error);
    return c.json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to allocate droplet',
      },
    }, 500);
  }
});

// GET /api/servers/:id/status - Check droplet status
allocateRoutes.get('/:id/status', authMiddleware, async (c) => {
  try {
    const dropletId = parseInt(c.req.param('id'));

    // TODO: For now, we'll simulate status checking
    // In production, this would:
    // 1. Query the DigitalOcean API for droplet status
    // 2. Check if the framework installation is complete
    // 3. Return the actual status

    // Simulate provisioning completing after some time
    // For demo purposes, randomly return ready or provisioning
    const isReady = Math.random() > 0.7;

    return c.json({
      dropletId,
      status: isReady ? 'ready' : 'provisioning',
      ipAddress: '104.234.1.1', // Placeholder
    });
  } catch (error) {
    console.error('Status check error:', error);
    return c.json({
      error: {
        message: 'Failed to check status',
      },
    }, 500);
  }
});

// POST /api/servers/:id/configure-telegram - Configure Telegram bot
allocateRoutes.post('/:id/configure-telegram', authMiddleware, async (c) => {
  try {
    const dropletId = parseInt(c.req.param('id'));
    const { botToken } = await c.req.json();
    const userId = c.get('userId') as string;

    if (!botToken || typeof botToken !== 'string') {
      return c.json({
        error: {
          message: 'botToken is required',
        },
      }, 400);
    }

    // Basic bot token validation (format: numbers:letters, 35+ chars)
    const botTokenPattern = /^\d+:[A-Za-z0-9_-]{35,}$/;
    if (!botTokenPattern.test(botToken)) {
      return c.json({
        error: {
          message: 'Invalid bot token format. Should be like: 123456:ABC-DEF1234ghikl...'
        },
      }, 400);
    }

    // Get the server record from database
    const db = getDb();
    const serverRecords = await db.select()
      .from(userServers)
      .where(eq(userServers.dropletId, dropletId));

    if (serverRecords.length === 0) {
      return c.json({
        error: {
          message: 'Server not found',
        },
      }, 404);
    }

    const server = serverRecords[0];

    // Verify ownership
    if (server.userId !== userId) {
      return c.json({
        error: {
          message: 'You do not have permission to configure this server',
        },
      }, 403);
    }

    const stack = server.stack; // 'nanobot' or 'openclaw'

    // Validate bot token with Telegram API and get bot info
    let botInfo;
    try {
      const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      const telegramData = await telegramResponse.json();

      if (!telegramData.ok) {
        return c.json({
          error: {
            message: 'Invalid bot token. Please check your token from @BotFather.',
            details: telegramData.description || 'Token validation failed',
          },
        }, 400);
      }

      botInfo = {
        id: telegramData.result.id,
        isBot: telegramData.result.is_bot,
        firstName: telegramData.result.first_name,
        username: telegramData.result.username,
        canJoinGroups: telegramData.result.can_join_groups,
        canReadAllGroupMessages: telegramData.result.can_read_all_group_messages,
        supportsInlineQueries: telegramData.result.supports_inline_queries,
      };
    } catch (err) {
      return c.json({
        error: {
          message: 'Failed to validate bot token with Telegram. Please check your internet connection.',
        },
      }, 500);
    }

    // Configure the agent on the droplet via SSH
    let dropletConfigured = false;
    let configError: string | null = null;

    // Check if we're in simulation mode (no SSH key configured)
    const hasSSHKey = process.env.SSH_PRIVATE_KEY || process.env.SSH_PRIVATE_KEY_PATH;
    const isSimulation = !hasSSHKey;

    if (isSimulation) {
      console.log(`[${stack.toUpperCase()}] SIMULATION MODE - Would configure ${stack} with Telegram bot`);
      console.log(`[${stack.toUpperCase()}] Bot token: ${botToken.substring(0, 10)}...`);
      dropletConfigured = true; // Simulate success
    } else {
      // Actual SSH configuration
      try {
        if (!server.ipAddress) {
          throw new Error('Server IP address not found');
        }

        console.log(`[${stack.toUpperCase()}] Connecting to droplet ${server.ipAddress}...`);

        // Create SSH connection
        const ssh = await createSSHConnection({
          host: server.ipAddress,
          port: server.sshPort || 22,
          username: 'root',
          privateKey: process.env.SSH_PRIVATE_KEY,
        });

        // Configure based on stack type
        // Get model from server record or config
        const model = server.model || (server.config as any)?.model || 'minimax/minimax-m2.5';
        const dropletOpenRouterKey = (server.config as any)?.openrouterKey;

        if (stack === 'nanobot') {
          await configureNanobot(ssh, botToken, model, dropletOpenRouterKey);
          dropletConfigured = true;
          console.log(`[Nanobot] Successfully configured model ${model} and Telegram bot on droplet`);
        } else if (stack === 'openclaw') {
          await configureOpenClaw(ssh, botToken, model, dropletOpenRouterKey);
          dropletConfigured = true;
          console.log(`[OpenClaw] Successfully configured model ${model} and Telegram bot on droplet`);
        }

        // Disconnect SSH
        await ssh.disconnect();
      } catch (err) {
        configError = err instanceof Error ? err.message : 'Unknown configuration error';
        console.error(`[${stack.toUpperCase()}] Failed to configure droplet:`, err);
        // Continue anyway - we've validated the token and will store it in the database
        // In production, you might want to retry or alert
      }
    }

    // Store bot token and model in database config
    const currentConfig = server.config || {
      monitoringEnabled: false,
      alertsEnabled: false,
      backupEnabled: false,
      customDomains: [],
      environmentVariables: {},
    };

    // Get model from server record or use a default
    const model = server.model || (server.config as any)?.model || 'minimax/minimax-m2.5';

    await db.update(userServers)
      .set({
        config: {
          ...currentConfig,
          telegram: {
            botToken,
            botInfo,
            configuredAt: new Date().toISOString(),
            dropletConfigured,
          },
          model: model,
        },
        status: 'ready', // Mark server as ready since bot is configured
      })
      .where(eq(userServers.dropletId, dropletId));

    // Send /start command to the bot to initialize the conversation
    let startMessageResult;
    try {
      const startResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: botInfo.id,
          text: '/start',
        }),
      });
      const startData = await startResponse.json();
      startMessageResult = startData.ok;
    } catch (err) {
      // Continue even if /start fails - bot is still configured
      console.error('Failed to send /start:', err);
    }

    return c.json({
      success: true,
      botToken,
      botInfo,
      startMessageSent: startMessageResult,
      message: dropletConfigured
        ? `Telegram bot configured on ${stack} and validated successfully`
        : `Telegram bot validated. Configuration stored on ${stack} droplet.`,
      configuredAt: new Date().toISOString(),
      dropletConfigured,
      configError,
      directLink: botInfo.username ? `https://t.me/${botInfo.username}` : `https://t.me/me`,
      stack,
    });
  } catch (error) {
    console.error('Telegram configuration error:', error);
    return c.json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to configure Telegram bot',
      },
    }, 500);
  }
});

// SSE endpoint for streaming configuration progress
// GET /api/servers/:id/configure-telegram/stream
allocateRoutes.get('/:id/configure-telegram/stream', authMiddleware, async (c) => {
  const dropletId = parseInt(c.req.param('id'));
  const userId = c.get('userId') as string;
  const botToken = c.req.query('token');
  const token = c.req.header('Authorization')?.replace('Bearer ', '');

  if (!botToken) {
    return c.json({
      error: {
        message: 'botToken query parameter is required',
      },
    }, 400);
  }

  // Create a streaming response
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const sendEvent = (data: any, eventType = 'message') => {
        const sseData = `data: ${JSON.stringify(data)}\n\n`;
        const sseEvent = eventType !== 'message' ? `event: ${eventType}\n` : '';
        controller.enqueue(encoder.encode(`${sseEvent}${sseData}`));
      };

      const log = async (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
        sendEvent({ message, type, timestamp: new Date().toISOString() });
      };

      try {
        await log('Starting Telegram bot configuration...', 'info');

        // Basic bot token validation
        const botTokenPattern = /^\d+:[A-Za-z0-9_-]{35,}$/;
        if (!botTokenPattern.test(botToken)) {
          await log('Invalid bot token format', 'error');
          sendEvent({
            error: {
              message: 'Invalid bot token format. Should be like: 123456:ABC-DEF1234ghikl...'
            },
            done: true
          }, 'error');
          controller.close();
          return;
        }

        // Get the server record from database
        await log('Looking up server record...', 'info');
        const db = getDb();
        const serverRecords = await db.select()
          .from(userServers)
          .where(eq(userServers.dropletId, dropletId));

        if (serverRecords.length === 0) {
          await log('Server not found', 'error');
          sendEvent({ error: { message: 'Server not found' }, done: true }, 'error');
          controller.close();
          return;
        }

        const server = serverRecords[0];

        // Verify ownership
        if (server.userId !== userId) {
          await log('Permission denied', 'error');
          sendEvent({
            error: { message: 'You do not have permission to configure this server' },
            done: true
          }, 'error');
          controller.close();
          return;
        }

        const stack = server.stack;

        // Validate bot token with Telegram API
        await log('Validating bot token with Telegram API...', 'info');
        let botInfo;
        try {
          const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
          const telegramData = await telegramResponse.json();

          if (!telegramData.ok) {
            await log('Invalid bot token', 'error');
            sendEvent({
              error: {
                message: 'Invalid bot token. Please check your token from @BotFather.',
                details: telegramData.description || 'Token validation failed',
              },
              done: true
            }, 'error');
            controller.close();
            return;
          }

          botInfo = {
            id: telegramData.result.id,
            isBot: telegramData.result.is_bot,
            firstName: telegramData.result.first_name,
            username: telegramData.result.username,
          };
          await log(`Bot validated: @${botInfo.username || botInfo.firstName}`, 'success');
        } catch (err) {
          await log('Failed to validate bot token with Telegram', 'error');
          sendEvent({
            error: { message: 'Failed to validate bot token. Please check your internet connection.' },
            done: true
          }, 'error');
          controller.close();
          return;
        }

        // Check if we're in simulation mode (need key available for real SSH)
        const hasSSHKey = !!getSSHPrivateKey();
        const isSimulation = !hasSSHKey;

        let dropletConfigured = false;
        let configError: string | null = null;

        if (isSimulation) {
          await log(`Running in simulation mode (${stack})`, 'warning');
          await log('Would configure: ' + stack, 'info');
          dropletConfigured = true;
        } else {
          // Actual SSH configuration
          try {
            if (!server.ipAddress) {
              throw new Error('Server IP address not found');
            }

            await log(`Connecting to droplet ${server.ipAddress}...`, 'info');

            // Pre-flight: SSH port is already pretested by the health worker for pool servers.
            // Use fewer retries when server was healthy at allocation; full retries as safety net otherwise.
            const maxRetries = server.healthStatus === 'healthy' ? 3 : 12;
            await log(`Testing SSH connectivity (pool servers are pretested; up to ${maxRetries} attempts)...`, 'info');
            let sshPortOpen = false;
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
              try {
                const { default: net } = await import('net');
                await new Promise<void>((resolve, reject) => {
                  const socket = new net.Socket();
                  const timeout = setTimeout(() => {
                    socket.destroy();
                    reject(new Error('SSH port check timeout'));
                  }, 5000);

                  socket.connect({ host: server.ipAddress!, port: server.sshPort || 22 }, () => {
                    clearTimeout(timeout);
                    sshPortOpen = true;
                    socket.destroy();
                    resolve();
                  });

                  socket.on('error', (err) => {
                    clearTimeout(timeout);
                    reject(err);
                  });
                });
                await log(`SSH port is open (attempt ${attempt}/${maxRetries})`, 'success');
                break; // Success!
              } catch (err) {
                if (attempt === maxRetries) {
                  await log(`SSH port not reachable after ${maxRetries} attempts: ${err instanceof Error ? err.message : 'Unknown error'}`, 'warning');
                  await log('Droplet may still be booting. Continuing with connection attempt...', 'warning');
                } else {
                  await log(`SSH port not ready (attempt ${attempt}/${maxRetries}), retrying in 5s...`, 'info');
                  await new Promise((r) => setTimeout(r, 5000));
                }
              }
            }

            // Create SSH connection with timeout and retry logic
            // OpenClaw takes longer to boot (Node.js) so we use longer timeouts and retries
            const maxConnectionRetries = stack === 'openclaw' ? 6 : 2;
            const baseTimeout = stack === 'openclaw' ? 30000 : 15000;

            await log(`Connection timeout: ${baseTimeout / 1000}s per attempt, max retries: ${maxConnectionRetries}`, 'info');

            let ssh: SSHClient | null = null;
            let lastError: Error | null = null;

            for (let attempt = 1; attempt <= maxConnectionRetries; attempt++) {
              try {
                await log(`SSH connection attempt ${attempt}/${maxConnectionRetries}...`, 'info');

                const privateKey = getSSHPrivateKey();
                const sshPromise = createSSHConnection({
                  host: server.ipAddress,
                  port: server.sshPort || 22,
                  username: 'root',
                  privateKey: privateKey ?? undefined,
                  readyTimeout: baseTimeout,
                });

                // Add timeout wrapper
                const timeoutPromise = new Promise<never>((_, reject) => {
                  setTimeout(() => {
                    reject(new Error(`Connection timeout after ${baseTimeout / 1000}s`));
                  }, baseTimeout + 2000);
                });

                ssh = await Promise.race([sshPromise, timeoutPromise]);
                await log(`SSH connection established on attempt ${attempt}`, 'success');
                break; // Success!
              } catch (err) {
                lastError = err instanceof Error ? err : new Error(String(err));
                await log(`Connection attempt ${attempt} failed: ${lastError.message}`, 'warning');
                const isAuthFailure = /authentication|auth failed|permission denied/i.test(lastError.message);
                if (isAuthFailure) {
                  await log('Tip: Use the same SSH key that is registered in DigitalOcean (e.g. ghost-m4-mac) and set SSH_PRIVATE_KEY or SSH_PRIVATE_KEY_PATH.', 'warning');
                }
                if (attempt < maxConnectionRetries) {
                  const backoffTime = 5000 * attempt; // 5s, 10s, 15s...
                  await log(`Waiting ${backoffTime / 1000}s before retry...`, 'info');
                  await new Promise(resolve => setTimeout(resolve, backoffTime));
                }
              }
            }

            if (!ssh) {
              const authHint = lastError?.message && /authentication|auth failed|permission denied/i.test(lastError.message)
                ? ' The droplet rejected the SSH key. Ensure SSH_PRIVATE_KEY (or SSH_PRIVATE_KEY_PATH) is the private key for the same key added to pool droplets in DigitalOcean (e.g. ghost-m4-mac).'
                : '';
              throw new Error(`Failed to connect after ${maxConnectionRetries} attempts. Last error: ${lastError?.message || 'Unknown error'}${authHint}`);
            }

            await log('SSH connection established', 'success');

            // Get model from config
            const model = server.model || (server.config as any)?.model || 'minimax/minimax-m2.5';

            await log(`Configuring AI model: ${model}`, 'info');

            // Get droplet-specific OpenRouter key if available
            const dropletOpenRouterKey = (server.config as any)?.openrouterKey;

            // Configure based on stack type
            if (stack === 'nanobot') {
              await configureNanobot(ssh!, botToken, model, dropletOpenRouterKey, log);
            } else if (stack === 'openclaw') {
              await configureOpenClaw(ssh!, botToken, model, dropletOpenRouterKey, log);
            }

            dropletConfigured = true;
            await log('Configuration completed successfully', 'success');

            // Disconnect SSH
            await ssh!.disconnect();
            await log('Disconnected from droplet', 'info');
          } catch (err) {
            configError = err instanceof Error ? err.message : 'Unknown configuration error';
            await log(`Configuration error: ${configError}`, 'error');
            // Continue anyway - store the validated token in database
          }
        }

        // Store bot token in database
        await log('Saving configuration to database...', 'info');
        const currentConfig = server.config || {
          monitoringEnabled: false,
          alertsEnabled: false,
          backupEnabled: false,
          customDomains: [],
          environmentVariables: {},
        };

        const model = server.model || (server.config as any)?.model || 'minimax/minimax-m2.5';

        await db.update(userServers)
          .set({
            config: {
              ...currentConfig,
              telegram: {
                botToken,
                botInfo,
                configuredAt: new Date().toISOString(),
                dropletConfigured,
              },
              model: model,
            },
            status: 'ready',
          })
          .where(eq(userServers.dropletId, dropletId));

        await log('Configuration saved to database', 'success');

        // Send /start command
        await log('Sending /start command to bot...', 'info');
        try {
          const startResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: botInfo.id,
              text: '/start',
            }),
          });
          const startData = await startResponse.json();
          if (startData.ok) {
            await log('/start command sent successfully', 'success');
          } else {
            await log('Could not send /start command (non-critical)', 'warning');
          }
        } catch (err) {
          await log('Failed to send /start command (non-critical)', 'warning');
        }

        // Send final success event
        sendEvent({
          success: true,
          botToken,
          botInfo,
          dropletConfigured,
          configError,
          directLink: botInfo.username ? `https://t.me/${botInfo.username}` : `https://t.me/me`,
          stack,
          done: true
        }, 'success');

        await log('Setup complete!', 'success');
        controller.close();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Configuration failed';
        await log(message, 'error');
        sendEvent({
          error: { message },
          done: true
        }, 'error');
        controller.close();
      }
    },
  });

  return c.body(stream);
});

export { allocateRoutes };
