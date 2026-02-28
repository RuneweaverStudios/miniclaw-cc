import { Queue, Worker, QueueEvents } from 'bullmq';
import { getRedis } from './redis.js';

export interface ProvisionServerJob {
  userId: string;
  plan: string;
  region: string;
}

export interface DestroyServerJob {
  userId: string;
  dropletId: number;
}

export interface HealthCheckJob {
  dropletId: number;
}

export interface BackupJob {
  dropletId: number;
  name: string;
}

export interface ReclaimJob {
  dropletId: number;
  userId: string;
  ipAddress: string;
  stack: 'openclaw' | 'nanobot';
}

export interface InstallJob {
  dropletId: number;
  ipAddress: string;
  stack: 'openclaw' | 'nanobot';
  version: string;
}

let provisionQueue: Queue<ProvisionServerJob> | null = null;
let destroyQueue: Queue<DestroyServerJob> | null = null;
let healthCheckQueue: Queue<HealthCheckJob> | null = null;
let backupQueue: Queue<BackupJob> | null = null;
let reclaimQueue: Queue<ReclaimJob> | null = null;
let installOpenClawQueue: Queue<InstallJob> | null = null;
let installNanobotQueue: Queue<InstallJob> | null = null;

export function getProvisionQueue(): Queue<ProvisionServerJob> {
  if (!provisionQueue) {
    const redis = getRedis();
    const connection = {
      host: redis.options.host || 'localhost',
      port: redis.options.port || 6379,
      db: redis.options.db || 0,
      password: redis.options.password,
      maxRetriesPerRequest: null,
    };
    provisionQueue = new Queue<ProvisionServerJob>('provision-servers', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          count: 100,
        },
        removeOnFail: {
          count: 500,
        },
      },
    });
  }
  return provisionQueue;
}

export function getDestroyQueue(): Queue<DestroyServerJob> {
  if (!destroyQueue) {
    const redis = getRedis();
    const connection = {
      host: redis.options.host || 'localhost',
      port: redis.options.port || 6379,
      db: redis.options.db || 0,
      password: redis.options.password,
      maxRetriesPerRequest: null,
    };
    destroyQueue = new Queue<DestroyServerJob>('destroy-servers', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          count: 100,
        },
        removeOnFail: {
          count: 500,
        },
      },
    });
  }
  return destroyQueue;
}

export function getHealthCheckQueue(): Queue<HealthCheckJob> {
  if (!healthCheckQueue) {
    const redis = getRedis();
    const connection = {
      host: redis.options.host || 'localhost',
      port: redis.options.port || 6379,
      db: redis.options.db || 0,
      password: redis.options.password,
      maxRetriesPerRequest: null,
    };
    healthCheckQueue = new Queue<HealthCheckJob>('health-checks', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 10000,
        },
        removeOnComplete: {
          count: 50,
        },
        removeOnFail: {
          count: 200,
        },
      },
    });
  }
  return healthCheckQueue;
}

export function getBackupQueue(): Queue<BackupJob> {
  if (!backupQueue) {
    const redis = getRedis();
    const connection = {
      host: redis.options.host || 'localhost',
      port: redis.options.port || 6379,
      db: redis.options.db || 0,
      password: redis.options.password,
      maxRetriesPerRequest: null,
    };
    backupQueue = new Queue<BackupJob>('backups', {
      connection,
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 15000,
        },
        removeOnComplete: {
          count: 50,
        },
        removeOnFail: {
          count: 200,
        },
      },
    });
  }
  return backupQueue;
}

export function getReclaimQueue(): Queue<ReclaimJob> {
  if (!reclaimQueue) {
    const redis = getRedis();
    const connection = {
      host: redis.options.host || 'localhost',
      port: redis.options.port || 6379,
      db: redis.options.db || 0,
      password: redis.options.password,
      maxRetriesPerRequest: null,
    };
    reclaimQueue = new Queue<ReclaimJob>('reclaims', {
      connection,
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 10000,
        },
        removeOnComplete: {
          count: 100,
        },
        removeOnFail: {
          count: 500,
        },
      },
    });
  }
  return reclaimQueue;
}

export function getInstallOpenClawQueue(): Queue<InstallJob> {
  if (!installOpenClawQueue) {
    const redis = getRedis();
    const connection = {
      host: redis.options.host || 'localhost',
      port: redis.options.port || 6379,
      db: redis.options.db || 0,
      password: redis.options.password,
      maxRetriesPerRequest: null,
    };
    installOpenClawQueue = new Queue<InstallJob>('install-openclaw', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          count: 100,
        },
        removeOnFail: {
          count: 500,
        },
      },
    });
  }
  return installOpenClawQueue;
}

export function getInstallNanobotQueue(): Queue<InstallJob> {
  if (!installNanobotQueue) {
    const redis = getRedis();
    const connection = {
      host: redis.options.host || 'localhost',
      port: redis.options.port || 6379,
      db: redis.options.db || 0,
      password: redis.options.password,
      maxRetriesPerRequest: null,
    };
    installNanobotQueue = new Queue<InstallJob>('install-nanobot', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          count: 100,
        },
        removeOnFail: {
          count: 500,
        },
      },
    });
  }
  return installNanobotQueue;
}

export async function closeQueues(): Promise<void> {
  await Promise.all([
    provisionQueue?.close(),
    destroyQueue?.close(),
    healthCheckQueue?.close(),
    backupQueue?.close(),
    reclaimQueue?.close(),
    installOpenClawQueue?.close(),
    installNanobotQueue?.close(),
  ]);
  provisionQueue = null;
  destroyQueue = null;
  healthCheckQueue = null;
  backupQueue = null;
  reclaimQueue = null;
  installOpenClawQueue = null;
  installNanobotQueue = null;
}

export function createWorker<T>(
  queueName: string,
  processor: (job: T) => Promise<void>,
  options: { concurrency?: number } = {}
): Worker {
  const redis = getRedis();

  // Convert Redis client to connection options for BullMQ
  const connection = {
    host: redis.options.host || 'localhost',
    port: redis.options.port || 6379,
    db: redis.options.db || 0,
    password: redis.options.password,
    maxRetriesPerRequest: null, // Fix for BullMQ requirement
  };

  return new Worker(
    queueName,
    async (job) => {
      await processor(job.data as T);
    },
    {
      connection,
      concurrency: options.concurrency || 1,
    }
  );
}

export function createQueueEvents(queueName: string): QueueEvents {
  return new QueueEvents(queueName, {
    connection: getRedis(),
  });
}
