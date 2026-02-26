/**
 * DigitalOcean regions configuration
 */
export interface RegionConfig {
  /** Region slug */
  slug: string;
  /** Region name */
  name: string;
  /** Datacenter location */
  datacenter: string;
  /** Enable pool in this region */
  enabled: boolean;
  /** Priority for pool allocation (lower = higher priority) */
  priority: number;
}

/**
 * Available DigitalOcean regions
 */
export const REGIONS: RegionConfig[] = [
  { slug: "nyc1", name: "New York 1", datacenter: "New York, USA", enabled: true, priority: 1 },
  { slug: "nyc3", name: "New York 3", datacenter: "New York, USA", enabled: true, priority: 2 },
  { slug: "ams3", name: "Amsterdam 3", datacenter: "Amsterdam, NL", enabled: true, priority: 3 },
  { slug: "fra1", name: "Frankfurt 1", datacenter: "Frankfurt, DE", enabled: true, priority: 4 },
  { slug: "lon1", name: "London 1", datacenter: "London, UK", enabled: true, priority: 5 },
  { slug: "sfo2", name: "San Francisco 2", datacenter: "San Francisco, USA", enabled: true, priority: 6 },
  { slug: "sfo3", name: "San Francisco 3", datacenter: "San Francisco, USA", enabled: true, priority: 7 },
  { slug: "sgp1", name: "Singapore 1", datacenter: "Singapore", enabled: false, priority: 8 },
  { slug: "blr1", name: "Bangalore 1", datacenter: "Bangalore, IN", enabled: false, priority: 9 },
  { slug: "tor1", name: "Toronto 1", datacenter: "Toronto, CA", enabled: false, priority: 10 },
];

/**
 * Get enabled regions
 */
export function getEnabledRegions(): RegionConfig[] {
  return REGIONS.filter((r) => r.enabled);
}

/**
 * Get regions sorted by priority
 */
export function getRegionsByPriority(): RegionConfig[] {
  return getEnabledRegions().sort((a, b) => a.priority - b.priority);
}

/**
 * Get region by slug
 */
export function getRegion(slug: string): RegionConfig | undefined {
  return REGIONS.find((r) => r.slug === slug);
}

/**
 * Default region for new deployments
 */
export const DEFAULT_REGION = "nyc1";
