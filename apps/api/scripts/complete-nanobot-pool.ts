import 'dotenv/config';
import { nanobotService } from '../src/services/nanobot.js';

// Nanobot droplets that need installation
const droplets = [
  { dropletId: 554954592, ipAddress: '167.99.6.73' },
  { dropletId: 554954669, ipAddress: '64.227.20.21' },
  { dropletId: 554954711, ipAddress: '68.183.110.79' },
];

async function main() {
  console.log(`Installing Nanobot on ${droplets.length} droplets...\n`);

  for (let i = 0; i < droplets.length; i++) {
    const { dropletId, ipAddress } = droplets[i];
    console.log(`[${i + 1}/${droplets.length}] Installing on droplet ${dropletId} (${ipAddress})...`);

    try {
      const result = await nanobotService.install({
        ipAddress,
        version: '0.1.3.post7',
      });

      if (result.success) {
        console.log(`  ✅ Installation complete`);

        // Test and stop gateway
        console.log(`  ⏳ Testing gateway...`);
        const testResult = await nanobotService.testGateway(ipAddress);
        if (testResult.success) {
          console.log(`  ✅ Gateway tested, stopped (ready for allocation)`);

          // Move to standby
          const { poolManager } = await import('../src/services/pool-manager.js');
          await poolManager.updateServerState(dropletId, 'standby');
          await poolManager.updateServerHealth(dropletId, 'healthy');
          console.log(`  ✅ Moved to standby`);
        } else {
          console.log(`  ⚠️  Gateway test failed: ${testResult.error}`);
        }
      } else {
        console.log(`  ❌ Installation failed: ${result.error}`);
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error}`);
    }

    console.log('');
  }

  console.log('Done! All installations completed.');
}

main().catch(console.error);
