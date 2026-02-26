/**
 * DigitalOcean droplet size configuration
 */
export interface DropletSize {
  /** Size slug */
  slug: string;
  /** Display name */
  name: string;
  /** Number of vCPUs */
  cpus: number;
  /** Memory in MB */
  memoryMB: number;
  /** Disk size in GB */
  diskGB: number;
  /** Monthly price in USD */
  priceMonthly: number;
  /** Hourly price in USD */
  priceHourly: number;
  /** Available for pool */
  availableForPool: boolean;
  /** Minimum required plan */
  minPlan?: "free" | "basic" | "pro" | "enterprise";
}

/**
 * Available droplet sizes
 */
export const DROPLET_SIZES: DropletSize[] = [
  {
    slug: "s-1vcpu-1gb",
    name: "Basic - 1 vCPU, 1GB RAM",
    cpus: 1,
    memoryMB: 1024,
    diskGB: 25,
    priceMonthly: 6,
    priceHourly: 0.00744,
    availableForPool: false,
  },
  {
    slug: "s-1vcpu-2gb",
    name: "Basic - 1 vCPU, 2GB RAM",
    cpus: 1,
    memoryMB: 2048,
    diskGB: 50,
    priceMonthly: 12,
    priceHourly: 0.01488,
    availableForPool: true,
    minPlan: "basic",
  },
  {
    slug: "s-2vcpu-2gb",
    name: "Basic - 2 vCPU, 2GB RAM",
    cpus: 2,
    memoryMB: 2048,
    diskGB: 60,
    priceMonthly: 24,
    priceHourly: 0.02976,
    availableForPool: true,
    minPlan: "basic",
  },
  {
    slug: "s-2vcpu-4gb",
    name: "Basic - 2 vCPU, 4GB RAM",
    cpus: 2,
    memoryMB: 4096,
    diskGB: 80,
    priceMonthly: 48,
    priceHourly: 0.05952,
    availableForPool: true,
    minPlan: "pro",
  },
  {
    slug: "s-4vcpu-8gb",
    name: "Premium - 4 vCPU, 8GB RAM",
    cpus: 4,
    memoryMB: 8192,
    diskGB: 160,
    priceMonthly: 96,
    priceHourly: 0.11904,
    availableForPool: true,
    minPlan: "pro",
  },
  {
    slug: "s-8vcpu-16gb",
    name: "Premium - 8 vCPU, 16GB RAM",
    cpus: 8,
    memoryMB: 16384,
    diskGB: 320,
    priceMonthly: 192,
    priceHourly: 0.23808,
    availableForPool: true,
    minPlan: "pro",
  },
];

/**
 * Default pool server size
 */
export const DEFAULT_POOL_SIZE = "s-1vcpu-2gb";

/**
 * Get size by slug
 */
export function getSize(slug: string): DropletSize | undefined {
  return DROPLET_SIZES.find((s) => s.slug === slug);
}

/**
 * Get sizes available for pool
 */
export function getPoolSizes(): DropletSize[] {
  return DROPLET_SIZES.filter((s) => s.availableForPool);
}

/**
 * Get sizes by minimum plan
 */
export function getSizesByPlan(plan: "free" | "basic" | "pro" | "enterprise"): DropletSize[] {
  const planOrder = { free: 0, basic: 1, pro: 2, enterprise: 3 };
  const planLevel = planOrder[plan];
  return DROPLET_SIZES.filter((s) => {
    if (!s.minPlan) return true;
    return planLevel >= planOrder[s.minPlan];
  });
}
