/**
 * Pool Sync Job - Syncs DigitalOcean droplets with Redis pool
 * Run every 5 minutes to keep pool state accurate
 */

import 'dotenv/config';
import { redis } from '../lib/redis.js';
import { poolManager } from '../services/pool-manager.js';
import { nanobotService } from '../services/nanobot.js';

interface DOProjection {
  id: number;
  name: string;
  status: string;
  networks: { v4: { ip_address: string; type: string }[] };
  region: { slug: string };
  size: { slug: string };
  tags: string[];
  created_at: string;
}

interface SyncResult {
  added: number;
  updated: number;
  removed: number;
  errors: string[];
}

export async function syncPoolWithDO(): Promise<SyncResult> {
  const result = { added: 0, updated: 0, removed: 0, errors: [] };
  
  try {
    const DO_TOKEN = process.env.DIGITALOCEAN_TOKEN;
    if (!DO_TOKEN) {
      throw new Error('DIGITALOCEAN_TOKEN not set');
    }

    // Step 1: Fetch all DO droplets
    console.log('[Sync] Fetching droplets from DigitalOcean...');
    const response = await fetch('https://api.digitalocean.com/v2/droplets?per_page=200', {
      headers: { 'Authorization': `Bearer ${DO_TOKEN}` },
    });

    if (!response.ok) {
      throw new Error(`DO API error: ${response.status}`);
    }

    const data = await response.json();
    const doDroplets: DOProjection[] = data.droplets || [];
    console.log(`[Sync] Found ${doDroplets.length} droplets in DO`);

    // Step 2: Fetch current Redis pool
    const redisServers = await poolManager.getServers();
    const redisMap = new Map(redisServers.map(s => [s.dropletId.toString(), s]));
    console.log(`[Sync] Found ${redisMap.size} servers in Redis`);

    // Step 3: Build DO map
    const doMap = new Map(doDroplets.map(d => [d.id.toString(), d]));

    // Step 4: Find droplets to add (in DO but not Redis)
    const toAdd = doDroplets.filter(d => !redisMap.has(d.id.toString()));
    
    // Step 5: Find droplets to update (in both, check for changes)
    const toUpdate: DOProjection[] = [];
    for (const droplet of doDroplets) {
      const existing = redisMap.get(droplet.id.toString());
      if (existing) {
        const ip = droplet.networks?.v4?.find((n: any) => n.type === 'public')?.ip_address;
        if (ip && ip !== existing.ipAddress) {
          toUpdate.push(droplet);
        }
      }
    }

    // Step 6: Find orphaned servers (in Redis but not DO)
    const orphanedIds = [...redisMap.keys()].filter(id => !doMap.has(id));

    // Step 7: Process additions
    console.log(`[Sync] Adding ${toAdd.length} new droplets...`);
    for (const droplet of toAdd) {
      try {
        const tags = droplet.tags || [];
        const name = droplet.name || '';
        const stack: 'nanobot' | 'openclaw' = tags.includes('openclaw') || name.includes('openclaw') ? 'openclaw' : 'nanobot';
        const ip = droplet.networks?.v4?.find((n: any) => n.type === 'public')?.ip_address;

        if (!ip) {
          result.errors.push(`${droplet.name} has no public IP`);
          continue;
        }

        await poolManager.addServer({
          dropletId: droplet.id,
          dropletName: droplet.name,
          ipAddress: ip,
          region: droplet.region?.slug || 'nyc1',
          size: droplet.size?.slug || 's-1vcpu-1gb',
          stack,
          stackVersion: stack === 'nanobot' ? '0.1.3.post7' : '1.0.0',
          state: droplet.status === 'active' ? 'standby' : 'provisioning',
          healthStatus: 'pending', // Will be determined by health check
          stateChangedAt: new Date(droplet.created_at),
          config: { monitoringEnabled: false, alertsEnabled: false, backupEnabled: false },
        });

        result.added++;
        console.log(`  ✓ Added ${droplet.name} (${stack})`);
      } catch (error: any) {
        result.errors.push(`Failed to add ${droplet.name}: ${error.message}`);
      }
    }

    // Step 8: Process updates
    console.log(`[Sync] Updating ${toUpdate.length} droplets...`);
    for (const droplet of toUpdate) {
      try {
        const ip = droplet.networks?.v4?.find((n: any) => n.type === 'public')?.ip_address;
        if (!ip) continue;

        const existing = redisMap.get(droplet.id.toString());
        
        // Update IP in pool
        await redis.hset(`pool:servers`, droplet.id.toString(), JSON.stringify({
          ...existing,
          ipAddress: ip,
        }));

        result.updated++;
        console.log(`  ✓ Updated ${droplet.name} IP: ${ip}`);
      } catch (error: any) {
        result.errors.push(`Failed to update ${droplet.name}: ${error.message}`);
      }
    }

    // Step 9: Remove orphaned servers
    console.log(`[Sync] Removing ${orphanedIds.length} orphaned servers...`);
    for (const id of orphanedIds) {
      try {
        await poolManager.removeServer(parseInt(id));
        result.removed++;
        console.log(`  ✓ Removed droplet ${id}`);
      } catch (error: any) {
        result.errors.push(`Failed to remove ${id}: ${error.message}`);
      }
    }

    // Step 10: Health check on pending/unknown servers
    console.log('[Sync] Running health checks on pending servers...');
    const pendingServers = (await poolManager.getServers()).filter(
      s => s.healthStatus === 'pending' || s.healthStatus === 'unknown'
    );

    for (const server of pendingServers.slice(0, 5)) { // Limit to 5 per sync
      try {
        if (server.stack === 'nanobot') {
          const status = await nanobotService.getStatus(server.ipAddress);
          const healthStatus = status.installed ? 'healthy' : 'unhealthy';
          await poolManager.updateServerState(server.dropletId, server.state, healthStatus);
          console.log(`  ✓ ${server.dropletName}: ${healthStatus}`);
        }
      } catch (error) {
        // Keep as pending
      }
    }

    console.log(`[Sync] Complete: ${result.added} added, ${result.updated} updated, ${result.removed} removed`);
    
    // Step 11: Pool balance alert
    const allServers = await poolManager.getServers();
    const standbyCount = allServers.filter(s => s.state === 'standby' && s.healthStatus === 'healthy').length;
    
    if (standbyCount < 4) {
      console.log(`⚠️  [Sync] ALERT: Only ${standbyCount} healthy standby servers (target: 8-10)`);
    }

  } catch (error: any) {
    result.errors.push(`Sync failed: ${error.message}`);
    console.error('[Sync] Error:', error);
  }

  return result;
}

// Run if called directly
if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  syncPoolWithDO()
    .then(result => {
      console.log('\n✅ Sync complete:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
