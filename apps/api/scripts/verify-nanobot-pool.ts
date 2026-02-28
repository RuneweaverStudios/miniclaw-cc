import 'dotenv/config';
import { NodeSSH } from 'node-ssh';
import * as fs from 'fs';

// All 5 Nanobot droplets
const droplets = [
  { dropletId: 554969181, ipAddress: '137.184.136.154' },
  { dropletId: 554969251, ipAddress: '206.189.189.217' },
  { dropletId: 554969338, ipAddress: '143.244.149.194' },
  { dropletId: 554969381, ipAddress: '137.184.101.64' },
  { dropletId: 554969412, ipAddress: '167.99.5.249' },
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

    // Check if Nanobot is installed
    const result = await ssh.execCommand('nanobot --version');

    if (result.code === 0) {
      const version = result.stdout.trim() || result.stderr.trim();
      console.log(`  ✅ Nanobot installed: ${version}`);
      return true;
    } else {
      console.log(`  ❌ Nanobot not working: ${result.stderr || result.stdout}`);
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
  console.log(`Verifying Nanobot on ${droplets.length} droplets...\n`);
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

  console.log('Done! All Nanobot droplets verified.');
}

main().catch(console.error);
