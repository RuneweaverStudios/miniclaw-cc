import 'dotenv/config';
import { getDb } from '../src/lib/db/index.js';
import { poolServers } from '../src/db/schema.js';
import { desc } from 'drizzle-orm';

async function checkRecentServers() {
  const db = getDb();

  const servers = await db.select()
    .from(poolServers)
    .orderBy(desc(poolServers.stateChangedAt))
    .limit(10);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Recently Updated Pool Servers');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (servers.length === 0) {
    console.log('No servers found in database.');
    return;
  }

  servers.forEach(s => {
    console.log(`\n${s.dropletId}: ${s.hostname}`);
    console.log(`  IP: ${s.ipAddress || 'N/A'}`);
    console.log(`  State: ${s.state}`);
    console.log(`  Stack: ${s.stack}`);
    console.log(`  User: ${s.allocatedTo || 'None'}`);
    console.log(`  Updated: ${s.stateChangedAt}`);
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

checkRecentServers().catch(console.error);
