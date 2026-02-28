import 'dotenv/config';
import { openclawService } from '../src/services/openclaw.js';

// OpenClaw droplets that need installation (5 total)
const droplets = [
  { dropletId: 554936340, ipAddress: '143.244.175.18' },
  { dropletId: 554936460, ipAddress: '134.209.71.67' },
  { dropletId: 554936508, ipAddress: '134.209.218.72' },
  { dropletId: 554937449, ipAddress: '162.243.162.24' },
];

async function main() {
  console.log(`Installing OpenClaw on ${droplets.length} droplets...\n`);

  for (let i = 0; i < droplets.length; i++) {
    const { dropletId, ipAddress } = droplets[i];
    console.log(`[${i + 1}/${droplets.length}] Installing on droplet ${dropletId} (${ipAddress})...`);

    try {
      const result = await openclawService.install({
        ipAddress,
        version: 'latest',
      });

      if (result.success) {
        console.log(`  ✅ Installation complete`);

        // Test and stop gateway
        console.log(`  ⏳ Testing gateway...`);
        const testResult = await openclawService.testGateway(ipAddress);
        if (testResult.success) {
          console.log(`  ✅ Gateway tested, stopped (ready for allocation)`);
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
