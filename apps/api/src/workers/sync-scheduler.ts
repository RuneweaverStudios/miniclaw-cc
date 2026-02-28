/**
 * Sync Scheduler - Runs pool sync every 5 minutes
 */

import { syncPoolWithDO } from './sync-pool.js';

const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

let isRunning = false;
let timer: NodeJS.Timeout | null = null;

export async function startSyncScheduler() {
  if (timer) {
    console.log('[SyncScheduler] Already running');
    return;
  }

  console.log('[SyncScheduler] Starting (every 5 minutes)...');

  const run = async () => {
    if (isRunning) {
      console.log('[SyncScheduler] Previous sync still running, skipping');
      return;
    }

    isRunning = true;
    try {
      await syncPoolWithDO();
    } catch (error) {
      console.error('[SyncScheduler] Sync error:', error);
    } finally {
      isRunning = false;
    }
  };

  // Run immediately on start
  await run();

  // Then run every 5 minutes
  timer = setInterval(run, SYNC_INTERVAL);
}

export function stopSyncScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
    console.log('[SyncScheduler] Stopped');
  }
}

// Run if called directly
if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  startSyncScheduler()
    .then(() => {
      console.log('✅ Sync scheduler started. Press Ctrl+C to stop.');
      
      // Keep process alive
      process.on('SIGINT', () => {
        console.log('\nStopping sync scheduler...');
        stopSyncScheduler();
        process.exit(0);
      });
    })
    .catch(console.error);
}
