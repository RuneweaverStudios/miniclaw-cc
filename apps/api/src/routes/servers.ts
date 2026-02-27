import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { redis } from '../lib/redis.js';
import type { PoolServerConfig } from '@miniclaw/shared';
import { randomUUID } from 'node:crypto';

const serversRoutes = new Hono();

// Apply auth middleware to all routes
serversRoutes.use('*', authMiddleware);

// GET /api/servers - List user's servers
serversRoutes.get('/', async (c) => {
  const user = c.get('user');

  try {
    // Get server IDs from Redis set
    const userServerKey = `user:${user.userId}:servers`;
    const serverIds = await redis.smembers(userServerKey);

    const servers = [];
    for (const dropletIdStr of serverIds) {
      const dropletId = parseInt(dropletIdStr);
      const redisKey = `pool:server:${dropletId}`;
      const data = await redis.get(redisKey);

      if (data) {
        const server = JSON.parse(data) as PoolServerConfig;
        servers.push({
          id: dropletId.toString(),
          dropletId: server.dropletId,
          hostname: `${user.userId}-${server.stack}.miniclaw.xyz`,
          fqdn: `${user.userId}-${server.stack}.miniclaw.xyz`,
          stack: server.stack,
          stackVersion: server.stackVersion,
          region: server.region,
          size: server.size,
          ipAddress: server.ipAddress,
          sshPort: server.sshPort,
          status: server.state,
          healthStatus: server.healthStatus,
          allocatedAt: server.stateChangedAt,
        });
      }
    }

    return c.json({
      success: true,
      servers,
      total: servers.length,
    });
  } catch (error) {
    console.error('[Servers] List error:', error);
    return c.json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to list servers',
      },
      servers: [],
      total: 0,
    }, 500);
  }
});

// POST /api/servers/provision - Provision a new server
const provisionSchema = z.object({
  plan: z.enum(['free', 'pro', 'enterprise']),
  region: z.string(),
  stack: z.string().optional(),
});

serversRoutes.post('/provision', zValidator('json', provisionSchema), async (c) => {
  const user = c.get('user');
  const { plan, region, stack = 'openclaw' } = c.req.valid('json');

  console.log(`[Servers] Provisioning ${stack} server for user ${user.userId} in ${region}`);

  try {
    // For testing: create a mock pool server and allocate it
    const mockDropletId = Math.floor(Math.random() * 1000000);
    const serverName = `pool-${stack}-${region}-${mockDropletId}`;

    const mockServer: PoolServerConfig = {
      dropletId: mockDropletId,
      dropletName: serverName,
      state: 'allocated',
      stack: stack as any,
      region,
      size: 's-1vcpu-1gb',
      ipAddress: '127.0.0.1',
      sshPort: 22,
      createdAt: new Date(),
      stateChangedAt: new Date(),
      allocatedTo: user.userId,
      healthStatus: 'healthy',
      healthCheckFailures: 0,
      stackVersion: stack === 'openclaw' ? '1.0.0' : '0.1.0',
    };

    // Store in Redis
    const redisKey = `pool:server:${mockDropletId}`;
    await redis.set(redisKey, JSON.stringify(mockServer));
    await redis.sadd('pool:server:ids', mockDropletId.toString());

    // Store user server mapping
    const userServerKey = `user:${user.userId}:servers`;
    await redis.sadd(userServerKey, mockDropletId.toString());

    console.log(`[Servers] Created mock server ${mockDropletId} for user ${user.userId}`);

    return c.json({
      success: true,
      message: 'Server provisioned successfully (test mode)',
      server: {
        id: randomUUID(),
        dropletId: mockDropletId,
        hostname: `${user.userId}-${stack}.miniclaw.xyz`,
        fqdn: `${user.userId}-${stack}.miniclaw.xyz`,
        stack,
        stackVersion: mockServer.stackVersion,
        region,
        size: mockServer.size,
        ipAddress: mockServer.ipAddress,
        sshPort: mockServer.sshPort,
        status: 'allocated',
        healthStatus: 'healthy',
        allocatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });
  } catch (error) {
    console.error('[Servers] Provision error:', error);
    return c.json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Provisioning failed',
      },
    }, 500);
  }
});

// GET /api/servers/:serverId - Get specific server details
serversRoutes.get('/:serverId', async (c) => {
  const serverId = c.req.param('serverId');
  const user = c.get('user');

  // TODO: Implement getting server details
  // - Verify ownership
  // - Return full server config
  // - Include health metrics

  return c.json({
    message: 'Server details not yet implemented',
    serverId,
    userId: user.userId,
  });
});

// DELETE /api/servers/:serverId - Destroy/provision out a server
serversRoutes.delete('/:serverId', async (c) => {
  const serverId = c.req.param('serverId');
  const user = c.get('user');

  // TODO: Implement server destruction
  // - Verify ownership
  // - Remove DNS records
  // - Clean up pool server
  // - Delete allocation
  // - Archive data if needed

  return c.json({
    message: 'Server destruction not yet implemented',
    serverId,
    userId: user.userId,
  });
});

// POST /api/servers/:serverId/renew - Renew server allocation
serversRoutes.post('/:serverId/renew', async (c) => {
  const serverId = c.req.param('serverId');
  const user = c.get('user');

  // TODO: Implement server renewal
  // - Verify ownership
  // - Check plan limits
  // - Extend expires_at
  // - Log renewal

  return c.json({
    message: 'Server renewal not yet implemented',
    serverId,
    userId: user.userId,
  });
});

// GET /api/servers/:serverId/logs - Get server logs
serversRoutes.get('/:serverId/logs', async (c) => {
  const serverId = c.req.param('serverId');
  const user = c.get('user');

  // TODO: Implement getting server logs
  // - Verify ownership
  // - Fetch logs from monitoring service
  // - Support filtering by time range

  return c.json({
    message: 'Server logs not yet implemented',
    serverId,
    userId: user.userId,
    logs: [],
  });
});

// GET /api/servers/:serverId/metrics - Get server metrics
serversRoutes.get('/:serverId/metrics', async (c) => {
  const serverId = c.req.param('serverId');
  const user = c.get('user');

  // TODO: Implement getting server metrics
  // - CPU, memory, disk usage
  // - Network I/O
  // - Response times

  return c.json({
    message: 'Server metrics not yet implemented',
    serverId,
    userId: user.userId,
    metrics: {},
  });
});

// POST /api/servers/:serverId/reboot - Reboot server
serversRoutes.post('/:serverId/reboot', async (c) => {
  const serverId = c.req.param('serverId');
  const user = c.get('user');

  // TODO: Implement server reboot
  // - Verify ownership
  // - Send reboot command via DO API
  // - Log action

  return c.json({
    message: 'Server reboot not yet implemented',
    serverId,
    userId: user.userId,
  });
});

// PUT /api/servers/:serverId/config - Update server configuration
serversRoutes.put('/:serverId/config', async (c) => {
  const serverId = c.req.param('serverId');
  const user = c.get('user');

  // TODO: Implement server config update
  // - Verify ownership
  // - Update config in database
  // - Apply changes via SSH

  return c.json({
    message: 'Server config update not yet implemented',
    serverId,
    userId: user.userId,
  });
});

export { serversRoutes };
