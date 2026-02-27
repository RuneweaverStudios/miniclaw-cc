import 'dotenv/config';
import { getInstallOpenClawQueue } from '../src/lib/queue.js';

// Get all OpenClaw droplets in provisioning state
const provisioningDroplets = [
  { dropletId: 554936310, ipAddress: '165.227.195.40' },
  { dropletId: 554936340, ipAddress: '143.244.175.18' },
  { dropletId: 554936460, ipAddress: '134.209.71.67' },
  { dropletId: 554936508, ipAddress: '134.209.218.72' },
  { dropletId: 554936626, ipAddress: '137.184.70.43' },
  { dropletId: 554936653, ipAddress: '67.205.158.79' },
  { dropletId: 554936794, ipAddress: '167.71.16.226' },
  { dropletId: 554937362, ipAddress: '137.184.211.233' },
  { dropletId: 554937449, ipAddress: '162.243.162.24' },
];

async function main() {
  const queue = getInstallOpenClawQueue();

  console.log('Queuing install jobs for', provisioningDroplets.length, 'OpenClaw droplets...');

  for (const droplet of provisioningDroplets) {
    await queue.add(
      {
        dropletId: droplet.dropletId,
        ipAddress: droplet.ipAddress,
        stack: 'openclaw',
        version: 'latest',
      },
      {
        jobId: `install-${droplet.dropletId}`,
      }
    );
    console.log('Queued:', droplet.dropletId);
  }

  console.log('Done! Jobs queued.');
}

main().catch(console.error);
