/**
 * Re-install Nanobot on all existing Nanobot droplets
 *
 * This script connects to the database, finds all Nanobot droplets,
 * and re-installs them using the updated nanobotService.
 */

import { getDb } from '../src/lib/db/index.js';
import { poolServers } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { nanobotService } from '../src/services/nanobot.js';

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Nanobot Re-Installation Script');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const db = getDb();

  // Get all Nanobot servers
  console.log('\n[1/5] Finding existing Nanobot droplets...');
  const servers = await db.select()
    .from(poolServers)
    .where(eq(poolServers.stack, 'nanobot'));

  console.log(`Found ${servers.length} Nanobot droplet(s)`);

  if (servers.length === 0) {
    console.log('\nNo Nanobot droplets found. Exiting.');
    return;
  }

  // Display droplets
  console.log('\nDroplets to re-install:');
  console.log('──────────────────────────────────────────────────────────────────');
  servers.forEach((server, index) => {
    console.log(`${index + 1}. Droplet ID: ${server.dropletId}`);
    console.log(`   Hostname: ${server.hostname}`);
    console.log(`   IP Address: ${server.ipAddress || 'N/A'}`);
    console.log(`   Status: ${server.state}`);
    console.log(`   Stack Version: ${server.stackVersion}`);
    console.log('──────────────────────────────────────────────────────────────────');
  });

  // Confirm with user
  console.log(`\n⚠️  This will re-install Nanobot on ${servers.length} droplet(s).`);
  console.log('   Make sure droplets are accessible via SSH.');
  console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Re-install each droplet
  console.log('\n[2/5] Starting re-installation...\n');

  const results = [];

  for (let i = 0; i < servers.length; i++) {
    const server = servers[i];
    const index = i + 1;

    console.log(`[${index}/${servers.length}] Processing droplet ${server.dropletId} (${server.hostname})`);

    if (!server.ipAddress) {
      console.log(`  ❌ No IP address found, skipping...`);
      results.push({
        dropletId: server.dropletId,
        success: false,
        error: 'No IP address'
      });
      continue;
    }

    try {
      // Install Nanobot
      console.log(`  📦 Installing Nanobot v0.1.3.post7...`);
      const installResult = await nanobotService.install({
        ipAddress: server.ipAddress,
        version: '0.1.3.post7',
      });

      if (installResult.success) {
        console.log(`  ✅ Installation successful!`);

        // Verify installation
        console.log(`  🔍 Verifying installation...`);
        const verifyResult = await nanobotService.verify(server.ipAddress);

        console.log(`  ┌─ Installed: ${verifyResult.installed ? 'Yes' : 'No'}`);
        console.log(`  ├─ Gateway Running: ${verifyResult.gatewayRunning ? 'Yes' : 'No'}`);
        if (verifyResult.version) {
          console.log(`  └─ Version: ${verifyResult.version}`);
        }

        results.push({
          dropletId: server.dropletId,
          hostname: server.hostname,
          success: true,
          installed: verifyResult.installed,
          gatewayRunning: verifyResult.gatewayRunning,
          version: verifyResult.version,
        });
      } else {
        console.log(`  ❌ Installation failed: ${installResult.error}`);
        results.push({
          dropletId: server.dropletId,
          hostname: server.hostname,
          success: false,
          error: installResult.error
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log(`  ❌ Error: ${errorMessage}`);
      results.push({
        dropletId: server.dropletId,
        hostname: server.hostname,
        success: false,
        error: errorMessage
      });
    }

    console.log(''); // Empty line between droplets
  }

  // Summary
  console.log('\n[3/5] Installation Summary');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Total droplets: ${servers.length}`);
  console.log(`Successful: ${results.filter(r => r.success).length}`);
  console.log(`Failed: ${results.filter(r => !r.success).length}`);

  if (results.filter(r => r.success).length > 0) {
    console.log('\n✅ Successfully Re-installed:');
    results.filter(r => r.success).forEach((result) => {
      console.log(`  - ${result.hostname} (Droplet ${result.dropletId})`);
    });
  }

  if (results.filter(r => !r.success).length > 0) {
    console.log('\n❌ Failed:');
    results.filter(r => !r.success).forEach((result) => {
      console.log(`  - ${result.hostname} (Droplet ${result.dropletId}): ${result.error}`);
    });
  }

  // Test one droplet if user confirms
  if (results.filter(r => r.success).length > 0) {
    console.log('\n[4/5] Testing one droplet with full configuration...');

    const successResult = results.find(r => r.success);
    if (!successResult || !successResult.ipAddress) {
      console.log('  No successful installation to test.');
      return;
    }

    const testServer = servers.find(s => s.dropletId === successResult.dropletId);
    if (!testServer) {
      console.log('  Could not find server details.');
      return;
    }

    console.log(`  Testing ${testServer.hostname} (${testServer.ipAddress})...`);
    console.log('  ⚠️  This will test with a dummy Telegram token.');

    try {
      // Test configuration with dummy token (will fail validation, but tests SSH/config)
      const testResult = await nanobotService.configure({
        ipAddress: testServer.ipAddress,
        model: 'openrouter/anthropic/claude-opus-4-5',
        botToken: '123456:TEST', // Dummy token for testing
      });

      if (testResult.success) {
        console.log('  ✅ Configuration test passed!');
      } else {
        console.log(`  ⚠️  Configuration test result: ${testResult.error}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log(`  ⚠️  Configuration test error: ${errorMessage}`);
    }
  }

  console.log('\n[5/5] Re-installation complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
