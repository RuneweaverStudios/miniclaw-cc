import { getDb } from '../src/lib/db/index.js';
import { poolServers } from '../src/db/schema.js';

const db = getDb();

async function updatePoolIp() {
  const IP_ADDRESS = '159.223.129.50';

  console.log(`📝 Updating pool_servers with real droplet IP: ${IP_ADDRESS}`);

  await db.update(poolServers)
    .set({
      ipAddress: IP_ADDRESS,
      state: 'standby',
      healthStatus: 'healthy',
    })
    .where((poolServers) => (poolServers as any).dropletId === 1000000);

  console.log('✅ Updated pool server droplet ID 1000000');

  // Show updated record
  const servers = await db.select()
    .from(poolServers)
    .limit(2);

  console.log('\n📊 Current pool servers:');
  for (const server of servers) {
    console.log(`   - ${server.dropletName}: ${server.ipAddress} (${server.stack}, ${server.state})`);
  }

  process.exit(0);
}

updatePoolIp().catch(console.error);
