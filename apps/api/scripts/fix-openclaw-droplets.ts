import 'dotenv/config';
import { NodeSSH } from 'node-ssh';
import * as fs from 'fs';

// OpenClaw droplets that need fixing
const droplets = [
  { dropletId: 554953347, ipAddress: '147.182.130.90' },
  { dropletId: 554953378, ipAddress: '147.182.129.222' },
  { dropletId: 554953411, ipAddress: '104.248.53.198' },
  { dropletId: 554953439, ipAddress: '68.183.103.77' },
];

async function fixDroplet(dropletId: number, ipAddress: string): Promise<boolean> {
  const sshKeyPath = process.env.SSH_PRIVATE_KEY_PATH || '~/.ssh/id_ed25519';
  const expandedPath = sshKeyPath.replace('~', process.env.HOME || '');
  const privateKey = fs.readFileSync(expandedPath, 'utf8');

  const ssh = new NodeSSH();

  try {
    console.log(`[OpenClaw] Fixing ${ipAddress}...`);

    await ssh.connect({
      host: ipAddress,
      username: 'root',
      privateKey,
      readyTimeout: 30000,
    });

    // Wait for cloud-init to finish or timeout
    console.log(`[OpenClaw] Waiting for cloud-init...`);
    await ssh.execCommand('cloud-init status --wait || true', { execOptions: { cwd: '/root' } });

    // Install OpenClaw using the official install script with non-interactive flags
    console.log(`[OpenClaw] Installing with --no-prompt --no-onboard...`);
    const installResult = await ssh.execCommand(`
      export DEBIAN_FRONTEND=noninteractive
      export HOME=/root
      curl -fsSL https://openclaw.ai/install.sh | bash -s -- --no-prompt --no-onboard
    `, { execOptions: { cwd: '/root' }, execOptions: { env: { DEBIAN_FRONTEND: 'noninteractive', HOME: '/root' } } });

    if (installResult.code !== 0) {
      console.error(`[OpenClaw] Install failed:`, installResult.stderr);
      return false;
    }

    console.log(`[OpenClaw] Install stdout:`, installResult.stdout);

    // Verify installation
    console.log(`[OpenClaw] Verifying installation...`);
    const verifyResult = await ssh.execCommand('openclaw --version || which openclaw || ls /usr/local/bin/openclaw');

    console.log(`[OpenClaw] Verify result:`, verifyResult.stdout, verifyResult.stderr);

    if (verifyResult.code !== 0 && !verifyResult.stdout.includes('openclaw')) {
      console.error(`[OpenClaw] Verification failed`);
      return false;
    }

    console.log(`[OpenClaw] ✅ Fixed ${ipAddress}`);
    return true;

  } catch (error) {
    console.error(`[OpenClaw] Error fixing ${ipAddress}:`, error);
    return false;
  } finally {
    ssh.dispose();
  }
}

async function main() {
  console.log(`=== Fixing 4 OpenClaw Droplets ===\n`);

  const results = [];
  for (let i = 0; i < droplets.length; i++) {
    const { dropletId, ipAddress } = droplets[i];
    console.log(`[${i + 1}/${droplets.length}] Droplet ${dropletId} (${ipAddress})`);

    const success = await fixDroplet(dropletId, ipAddress);
    results.push({ dropletId, ipAddress, success });

    if (success) {
      // Move to standby
      const { poolManager } = await import('../src/services/pool-manager.js');
      await poolManager.updateServerState(dropletId, 'standby');
      await poolManager.updateServerHealth(dropletId, 'healthy');
      console.log(`  ✅ Moved to standby\n`);
    } else {
      console.log(`  ❌ Failed\n`);
    }
  }

  console.log('=== Summary ===');
  const successCount = results.filter(r => r.success).length;
  console.log(`Fixed: ${successCount}/${droplets.length}`);
}

main().catch(console.error);
