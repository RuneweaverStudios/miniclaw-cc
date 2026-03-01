import Redis from 'ioredis';

let redisInstance: Redis | null = null;

function getRedisConfig(): { host: string; port: number; password?: string } | { url: string } {
  const url = process.env.REDIS_URL;
  if (url) {
    return { url };
  }
  const host = process.env.REDIS_HOST || 'localhost';
  const port = Number.parseInt(process.env.REDIS_PORT || '6379', 10);
  const password = process.env.REDIS_PASSWORD;
  return { host, port, password };
}

export function getRedis(): Redis {
  if (!redisInstance) {
    const config = getRedisConfig();

    // Fail fast in production if Redis is still pointing at localhost (e.g. REDIS_HOST not set on Render)
    if (process.env.NODE_ENV === 'production' && 'host' in config && (config.host === 'localhost' || config.host === '127.0.0.1')) {
      const msg =
        '[Redis] REDIS_HOST is localhost in production. Set REDIS_HOST and REDIS_PORT to your Redis service (e.g. miniclaw-redis internal host). See docs/DEPLOY_RENDER.md § 1b.';
      console.error(msg);
      throw new Error(msg);
    }

    redisInstance = 'url' in config
      ? new Redis(config.url, {
          maxRetriesPerRequest: 3,
          retryStrategy(times) {
            return Math.min(times * 50, 2000);
          },
        })
      : new Redis({
          host: config.host,
          port: config.port,
          password: config.password,
          maxRetriesPerRequest: 3,
          retryStrategy(times) {
            const delay = Math.min(times * 50, 2000);
            return delay;
          },
        });

    redisInstance.on('error', (err: Error) => {
      console.error('Redis Client Error:', err);
    });

    redisInstance.on('connect', () => {
      console.log('Redis Client Connected');
    });
  }

  return redisInstance;
}

// Export singleton for easy importing
export const redis = getRedis();

export async function closeRedis(): Promise<void> {
  if (redisInstance) {
    await redisInstance.quit();
    redisInstance = null;
  }
}

export class CacheService {
  private redis: Redis;

  constructor() {
    this.redis = getRedis();
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttl) {
      await this.redis.setex(key, ttl, serialized);
    } else {
      await this.redis.set(key, serialized);
    }
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async delPattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.redis.exists(key);
    return result === 1;
  }

  async incr(key: string): Promise<number> {
    return this.redis.incr(key);
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.redis.expire(key, seconds);
  }

  async ttl(key: string): Promise<number> {
    return this.redis.ttl(key);
  }

  async hset(key: string, field: string, value: unknown): Promise<void> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    await this.redis.hset(key, field, serialized);
  }

  async hget<T>(key: string, field: string): Promise<T | null> {
    const value = await this.redis.hget(key, field);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }

  async hgetall<T>(key: string): Promise<Record<string, T>> {
    const hash = await this.redis.hgetall(key);
    const result: Record<string, T> = {};
    for (const [field, value] of Object.entries(hash)) {
      try {
        result[field] = JSON.parse(value) as T;
      } catch {
        result[field] = value as T;
      }
    }
    return result;
  }

  async hdel(key: string, field: string): Promise<void> {
    await this.redis.hdel(key, field);
  }
}

export const cacheService = new CacheService();
