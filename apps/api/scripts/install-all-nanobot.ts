import 'dotenv/config';
import { nanobotService } from '../src/services/nanobot.js';

// All 5 Nanobot droplets
const droplets = [
  { dropletId: 554969181, ipAddress: '137.184.136.154' },
  { dropletId: 554969251, ipAddress: '206.189.189.217' },
  { dropletId: 554969338, ipAddress: '143.244.149.194' },
  { dropletId: 554969381, ipAddress: '137.184.101.64' },
  { dropletId: 554969412, ipAddress: '167.99.5.249' },
];

async function main() {
  console.log(`Installing Nanobot on ${droplets.length} droplets...\n`);
  const { poolManager } = await import('../src/services/pool-manager.js');

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

          // Get current server config and update it
          const current = await poolManager.getServer(dropletId);
          if (current) {
            await poolManager.addServer({
              ...current,
              state: 'standby',
              healthStatus: 'healthy',
              updatedAt: new Date(),
            });
          }
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

  console.log('Done! All Nanobot installations completed.');
}

main().catch(console.error);
