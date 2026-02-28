/**
 * Deallocate Orphaned Server
 *
 * Returns an allocated server back to the pool
 * Clears Telegram configuration and OpenRouter API keys
 */

import 'dotenv/config';
import { poolManager } from './src/services/pool-manager.js';
import { clearServerConfiguration } from './src/services/server-cleanup.js';
import { openrouterService } from './src/services/openrouter.js';

async function main() {
  const dropletId = parseInt(process.argv[2]) || 555084292;

  console.log('🧹 Deallocating orphaned server:', dropletId);

  // Get server details
  const server = await poolManager.getServer(dropletId);
  if (!server) {
    console.log('❌ Server not found in pool');
    process.exit(1);
  }

  console.log('Found server:', server.dropletName);
  console.log('Stack:', server.stack);
  console.log('IP:', server.ipAddress);
  console.log('Current state:', server.state);

  if (server.state !== 'allocated') {
    console.log('⚠️  Server is not in allocated state, but continuing cleanup...');
  }

  // Clear configuration
  console.log('\nCleaning up server configuration...');
  const cleanupResult = await clearServerConfiguration(server);

  console.log('\nCleanup steps:');
  for (const step of cleanupResult.steps) {
    const icon = step.success ? '✅' : '❌';
    console.log(`  ${icon} ${step.step}: ${step.message}`);
  }

  // Clear any remaining allocation metadata
  console.log('\nClearing allocation metadata...');
  const redis = (await import('./src/lib/redis.js')).redis;
  const allocationKeys = await redis.keys(`pool:allocation:*:${dropletId}`);
  if (allocationKeys.length > 0) {
    await redis.del(...allocationKeys);
    console.log('✅ Cleared allocation keys');
  }

  // Revoke the OpenRouter API key for this droplet
  console.log('\nRevoking OpenRouter API key...');
  const revoked = await openrouterService.revokeDropletKey(dropletId);
  if (revoked) {
    console.log('✅ OpenRouter API key revoked');
  } else {
    console.log('ℹ️  No OpenRouter API key found to revoke');
  }

  // Return to standby state
  console.log('\nReturning to pool as standby+healthy...');
  await poolManager.updateServerState(dropletId, 'standby', 'healthy');

  console.log('\n✅✅✅ Server deallocated and returned to pool!');
  console.log(`   ${server.dropletName} is now ready for reallocation`);
}

main().catch(console.error);
