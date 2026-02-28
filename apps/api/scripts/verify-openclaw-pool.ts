import 'dotenv/config';
import { NodeSSH } from 'node-ssh';
import * as fs from 'fs';

// All 5 OpenClaw droplets
const droplets = [
  { dropletId: 554969443, ipAddress: '167.172.128.142' },
  { dropletId: 554969476, ipAddress: '134.122.115.108' },
  { dropletId: 554969516, ipAddress: '68.183.123.247' },
  { dropletId: 554969575, ipAddress: '137.184.222.50' },
  { dropletId: 554969607, ipAddress: '159.203.186.251' },
];

async function verifyDroplet(dropletId: number, ipAddress: string): Promise<boolean> {
  const sshKeyPath = process.env.SSH_PRIVATE_KEY_PATH || '~/.ssh/id_ed25519';
  const expandedPath = sshKeyPath.replace('~', process.env.HOME || '');
  const privateKey = fs.readFileSync(expandedPath, 'utf8');

  const ssh = new NodeSSH();

  try {
    await ssh.connect({
      host: ipAddress,
      username: 'root',
      privateKey,
      readyTimeout: 30000,
    });

    // Check if OpenClaw is installed and working
    const result = await ssh.execCommand('openclaw --version');

    if (result.code === 0) {
      const version = result.stdout.trim() || result.stderr.trim();
      console.log(`  ✅ OpenClaw installed: ${version}`);
      return true;
    } else {
      console.log(`  ❌ OpenClaw not working: ${result.stderr || result.stdout}`);
      return false;
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error}`);
    return false;
  } finally {
    ssh.dispose();
  }
}

async function main() {
  console.log(`Verifying OpenClaw on ${droplets.length} droplets...\n`);
  const { poolManager } = await import('../src/services/pool-manager.js');

  for (let i = 0; i < droplets.length; i++) {
    const { dropletId, ipAddress } = droplets[i];
    console.log(`[${i + 1}/${droplets.length}] Verifying droplet ${dropletId} (${ipAddress})...`);

    const success = await verifyDroplet(dropletId, ipAddress);

    if (success) {
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
      console.log(`  ✅ Moved to standby\n`);
    } else {
      console.log(`  ❌ Left in provisioning\n`);
    }
  }

  console.log('Done! All OpenClaw droplets verified.');
}

main().catch(console.error);
