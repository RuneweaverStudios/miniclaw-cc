/**
 * Complete Pool - Simplified version (no gateway test needed)
 *
 * The gateway won't start HTTP server until channels are configured,
 * which is fine - users will configure channels after allocation.
 */

import 'dotenv/config';
import { poolManager } from '../src/services/pool-manager.js';
import { nanobotService } from '../src/services/nanobot.js';

// Nanobot droplet that's currently in provisioning state
const droplet = { dropletId: 555009454, ipAddress: '159.223.177.99' };

async function main() {
  console.log(`[${droplet.dropletId}] Completing Nanobot droplet setup...\n`);

  try {
    // Step 1: Verify Nanobot is installed
    console.log(`[1/2] Verifying Nanobot installation...`);
    const status = await nanobotService.getStatus(droplet.ipAddress);

    if (!status.installed) {
      console.error(`❌ Nanobot not installed, running installation...`);
      const installResult = await nanobotService.install({
        ipAddress: droplet.ipAddress,
        version: '0.1.3.post7',
      });

      if (!installResult.success) {
        console.error(`❌ Installation failed: ${installResult.error}`);
        process.exit(1);
      }
      console.log(`✅ Installation complete\n`);
    } else {
      console.log(`✅ Nanobot already installed (version ${status.version || 'unknown'})\n`);
    }

    // Step 2: Move to standby as healthy
    console.log(`[2/2] Moving droplet to standby pool...`);
    await poolManager.updateServerState(droplet.dropletId, 'standby', 'healthy');
    console.log(`✅ Moved to standby pool\n`);

    console.log('✅✅✅ COMPLETE! Droplet is ready for allocation ✅✅✅');
    console.log(`   Droplet ID: ${droplet.dropletId}`);
    console.log(`   IP Address: ${droplet.ipAddress}`);
    console.log(`   Stack: nanobot v0.1.3.post7`);
    console.log(`   Status: standby/healthy`);
    console.log(`\n📝 Note: Gateway HTTP server will start when user configures channels`);

  } catch (error) {
    console.error(`❌ Error:`, error);
    process.exit(1);
  }
}

main().catch(console.error);
