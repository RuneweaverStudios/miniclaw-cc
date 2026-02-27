/**
 * Test Nanobot installation on existing droplet
 */

import 'dotenv/config';
import { nanobotService } from '../src/services/nanobot.js';

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Nanobot Installation Test');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Test on an existing Nanobot droplet
  const testDropletIP = '167.99.144.213'; // miniclaw-test-nanobot-new (with new SSH key)

  console.log(`\nTesting on droplet: ${testDropletIP}`);

  try {
    // First, verify current state
    console.log('\n[1/3] Checking current installation...');
    const beforeVerify = await nanobotService.verify(testDropletIP);
    console.log(`  ┌─ Installed: ${beforeVerify.installed ? 'Yes' : 'No'}`);
    console.log(`  ├─ Gateway Running: ${beforeVerify.gatewayRunning ? 'Yes' : 'No'}`);
    console.log(`  └─ Version: ${beforeVerify.version || 'Unknown'}`);

    // Install Nanobot
    console.log('\n[2/3] Installing Nanobot v0.1.3.post7...');
    const installResult = await nanobotService.install({
      ipAddress: testDropletIP,
      version: '0.1.3.post7',
    });

    if (installResult.success) {
      console.log('  ✅ Installation successful!');

      // Verify installation
      console.log('\n[3/3] Verifying installation...');
      const afterVerify = await nanobotService.verify(testDropletIP);
      console.log(`  ┌─ Installed: ${afterVerify.installed ? 'Yes' : 'No'}`);
      console.log(`  ├─ Gateway Running: ${afterVerify.gatewayRunning ? 'Yes' : 'No'}`);
      if (afterVerify.version) {
        console.log(`  └─ Version: ${afterVerify.version}`);
      }

      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Test completed successfully!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    } else {
      console.log(`  ❌ Installation failed: ${installResult.error}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log(`\n❌ Error: ${errorMessage}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
