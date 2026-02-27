import { Hono } from 'hono';
import { getDb } from '../lib/db/index.js';
import { userServers, allocations, poolServers } from '../db/schema.js';

const app = new Hono();

app.post('/clean-db', async (c) => {
  try {
    const db = getDb();

    console.log('Clearing all instances...');

    // Delete all user servers (unassign droplets)
    const result1 = await db.delete(userServers);
    console.log(`✓ Deleted user_servers records`);

    // Delete all allocations
    const result2 = await db.delete(allocations);
    console.log(`✓ Deleted allocation records`);

    // Delete all pool servers
    try {
      const result3 = await db.delete(poolServers);
      console.log(`✓ Deleted pool_servers records`);
    } catch (err) {
      console.log('  (pool_servers table may not exist)');
    }

    return c.json({
      success: true,
      message: 'All instances unassigned and returned to pool',
    });
  } catch (error) {
    console.error('Error cleaning database:', error);
    return c.json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to clean database',
      },
    }, 500);
  }
});

export default app;
