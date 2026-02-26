/**
 * MiniClaw-CC API Entry Point
 *
 * Main application entry point that wires together all components
 */

import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { redis } from './lib/redis.js';
import { startReplenisher } from './workers/replenisher.js';
import { startHealthMonitor } from './workers/health-monitor.js';
import { startReclaimer } from './workers/reclaimer.js';
import { authRoutes } from './routes/auth.js';
import { poolRoutes } from './routes/pool.js';
import { serversRoutes } from './routes/servers.js';
import { billingRoutes } from './routes/billing.js';
import { webhookRoutes } from './routes/webhooks.js';

const app = new Hono();

// Global middleware
app.use('*', logger());
app.use('*', prettyJSON());
app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Health check
app.get('/', (c) => {
  return c.json({
    name: 'MiniClaw-CC API',
    version: '0.1.0',
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', async (c) => {
  // Check Redis connection
  let redisHealthy = false;
  try {
    await redis.ping();
    redisHealthy = true;
  } catch {
    // Redis not healthy
  }

  return c.json({
    status: redisHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      api: 'healthy',
      redis: redisHealthy ? 'healthy' : 'unhealthy',
    },
    uptime: process.uptime()
  });
});

// API routes
app.route('/api/auth', authRoutes);
app.route('/api/pool', poolRoutes);
app.route('/api/servers', serversRoutes);
app.route('/api/billing', billingRoutes);
app.route('/api/webhooks', webhookRoutes);

// Error handling
app.onError((err, c) => {
  console.error('Error:', err);

  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  return c.json({
    error: {
      message,
      status,
      timestamp: new Date().toISOString()
    }
  }, status);
});

// 404 handler
app.notFound((c) => {
  return c.json({
    error: {
      message: 'Not Found',
      status: 404,
      timestamp: new Date().toISOString()
    }
  }, 404);
});

const port = parseInt(process.env.PORT || '4000');

/**
 * Start the API server
 */
async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('MiniClaw-CC API Starting...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Test Redis connection
  try {
    await redis.ping();
    console.log('[Redis] Connected successfully');
  } catch (error) {
    console.error('[Redis] Connection failed:', error);
    console.error('[Redis] Please ensure Redis is running on', process.env.REDIS_HOST || 'localhost:6379');
    process.exit(1);
  }

  // Start background workers
  console.log('[Workers] Starting background workers...');
  startReplenisher();
  startHealthMonitor();
  startReclaimer();
  console.log('[Workers] Background workers started');

  // Start API server
  console.log(`[API] Starting server on port ${port}`);

  serve({
    fetch: app.fetch,
    port,
  }, ({ address, port }) => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('MiniClaw-CC API Running!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  Server:  http://${address}:${port}`);
    console.log(`  Health:  http://${address}:${port}/health`);
    console.log(`  API:     http://${address}:${port}/api`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
  });
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\\n[API] Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\\n[API] Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Start the server
main().catch((error) => {
  console.error('[API] Fatal error:', error);
  process.exit(1);
});

export default app;
