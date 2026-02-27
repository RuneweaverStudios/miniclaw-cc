import { PoolConfig, StackType } from "@miniclaw/shared";
import { DEFAULT_REGION, getEnabledRegions } from "./regions.js";
import { DEFAULT_POOL_SIZE } from "./sizes.js";
import { DEFAULT_STACK_VERSIONS } from "./stacks.js";

/**
 * Default pool configuration
 */
export const DEFAULT_POOL_CONFIG: PoolConfig = {
  /** Target number of standby servers per stack type */
  targetPoolSize: 10,
  /** Minimum number of standby servers before alert */
  minPoolSize: 3,
  /** Maximum number of servers allowed in pool (all states) */
  maxPoolSize: 50,
  /** Health check interval in seconds */
  healthCheckInterval: 30,
  /** Maximum allowed health check failures before marking unhealthy */
  maxHealthFailures: 3,
  /** Regions to maintain pools in */
  regions: getEnabledRegions().map((r) => r.slug),
  /** Default droplet size for pool servers */
  defaultSize: DEFAULT_POOL_SIZE,
  /** Enable auto-replenishment */
  autoReplenish: true,
  /** Replenishment batch size */
  replenishBatchSize: 2,
};

/**
 * Pool configuration overrides by environment
 *
 * Note: targetPoolSize is divided between nanobot and openclaw stacks equally
 * So targetPoolSize: 10 means 5 nanobot + 5 openclaw servers
 */
export const POOL_CONFIG_BY_ENV: Record<string, Partial<PoolConfig>> = {
  development: {
    targetPoolSize: 2,
    minPoolSize: 1,
    maxPoolSize: 4,
    healthCheckInterval: 60,
    regions: [DEFAULT_REGION],
  },
  staging: {
    targetPoolSize: 4,
    minPoolSize: 2,
    maxPoolSize: 10,
  },
  production: {
    targetPoolSize: 10, // 5 nanobot + 5 openclaw = 10 total
    minPoolSize: 4, // 2 of each
    maxPoolSize: 20, // 10 of each absolute max
    replenishBatchSize: 2, // Provision 2 at a time (1 of each)
  },
};

/**
 * Get pool config for environment
 */
export function getPoolConfig(env: string = "production"): PoolConfig {
  const baseConfig = POOL_CONFIG_BY_ENV[env] || {};
  return { ...DEFAULT_POOL_CONFIG, ...baseConfig };
}

/**
 * Server naming convention
 */
export function generatePoolServerName(stack: StackType, region: string, index: number): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `pool-${stack}-${region}-${index}-${timestamp}-${random}`;
}

/**
 * Pool server tags for DigitalOcean
 */
export const POOL_SERVER_TAGS = [
  "miniclaw-cc",
  "pool-server",
  "auto-managed",
  "standby-pool",
];

/**
 * Replenishment settings
 */
export const REPLENISHMENT_SETTINGS = {
  /** Minimum threshold to trigger replenishment */
  thresholdRatio: 0.3, // 30% of target pool size
  /** Cooldown between replenishment batches (ms) */
  cooldownMs: 60000, // 1 minute
  /** Maximum concurrent provisioning operations */
  maxConcurrentProvisioning: 5,
};
