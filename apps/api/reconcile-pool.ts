/**
 * Pool Reconcile Script
 *
 * Removes excess servers to bring pool down to target size.
 *
 * Usage:
 *   npm run pool:reconcile              # Dry run (show what would be removed)
 *   npm run pool:reconcile -- --force   # Actually remove excess servers
 */

import 'dotenv/config';
import { program } from 'commander';
import { poolManager } from './src/services/pool-manager.js';

async function main() {
  // Check for --force flag
  const forceIndex = process.argv.indexOf('--force');
  const force = forceIndex !== -1;

  program
    .option('--force', 'Actually remove excess servers (default is dry-run)')
    .parse(process.argv);

  const options = program.opts();
  const dryRun = !force && !options.force;

  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                    POOL RECONCILE                               ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('');

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No servers will be removed');
    console.log('   Use --force to actually remove excess servers\n');
  } else {
    console.log('⚠️  FORCE MODE - Excess servers WILL BE removed\n');
  }

  const result = await poolManager.reconcileToTarget(dryRun);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Reconciliation Result:');
  console.log(`  Nanobots: ${result.nanobotCount}/5`);
  console.log(`  OpenClaws: ${result.openclawCount}/5`);
  console.log(`  Total: ${result.totalCount}/10`);
  console.log('');

  if (result.removed.length === 0) {
    console.log('✅ Pool is already at target size! No servers need to be removed.');
  } else {
    console.log(`Servers ${dryRun ? 'that would be removed' : 'removed'}:`);
    for (const server of result.removed) {
      console.log(`  - ${server.dropletName} (ID: ${server.dropletId}, Stack: ${server.stack})`);
      console.log(`    Reason: ${server.reason}`);
    }
    console.log('');

    if (dryRun) {
      console.log(`To remove these ${result.removed.length} servers, run:`);
      console.log('  npm run pool:reconcile -- --force');
    } else {
      console.log(`✅ Successfully removed ${result.removed.length} excess servers`);
      console.log('   Droplets are still in DigitalOcean and can be manually destroyed');
    }
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
