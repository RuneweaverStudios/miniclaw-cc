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

let provisionQueue: Queue<ProvisionServerJob> | null = null;
let destroyQueue: Queue<DestroyServerJob> | null = null;
let healthCheckQueue: Queue<HealthCheckJob> | null = null;
let backupQueue: Queue<BackupJob> | null = null;

export function getProvisionQueue(): Queue<ProvisionServerJob> {
  if (!provisionQueue) {
    provisionQueue = new Queue<ProvisionServerJob>('provision-servers', {
      connection: getRedis(),
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
    destroyQueue = new Queue<DestroyServerJob>('destroy-servers', {
      connection: getRedis(),
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
    healthCheckQueue = new Queue<HealthCheckJob>('health-checks', {
      connection: getRedis(),
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
    backupQueue = new Queue<BackupJob>('backups', {
      connection: getRedis(),
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

export async function closeQueues(): Promise<void> {
  await Promise.all([
    provisionQueue?.close(),
    destroyQueue?.close(),
    healthCheckQueue?.close(),
    backupQueue?.close(),
  ]);
  provisionQueue = null;
  destroyQueue = null;
  healthCheckQueue = null;
  backupQueue = null;
}

export function createWorker<T>(
  queueName: string,
  processor: (job: T) => Promise<void>,
  options: { concurrency?: number } = {}
): Worker {
  return new Worker(
    queueName,
    async (job) => {
      await processor(job.data as T);
    },
    {
      connection: getRedis(),
      concurrency: options.concurrency || 1,
    }
  );
}

export function createQueueEvents(queueName: string): QueueEvents {
  return new QueueEvents(queueName, {
    connection: getRedis(),
  });
}
