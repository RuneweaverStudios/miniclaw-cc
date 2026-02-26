/**
 * Pool state represents the lifecycle of a server in the standby pool
 */
export enum PoolState {
  /** Server is being provisioned from the cloud provider */
  PROVISIONING = "provisioning",
  /** Server is created and undergoing installation/testing */
  TESTING = "testing",
  /** Server is ready in the pool, waiting for allocation */
  STANDBY = "standby",
  /** Server has been allocated to a user */
  ALLOCATED = "allocated",
  /** Server is being decommissioned */
  TERMINATING = "terminating",
  /** Server is in an error state */
  ERROR = "error",
}

/**
 * Server stack type - AI agent platform
 */
export enum StackType {
  OPENCLAW = "openclaw",
  NANOBOT = "nanobot",
}

/**
 * Pool server configuration
 */
export interface PoolServerConfig {
  /** DigitalOcean droplet ID */
  dropletId: number;
  /** Droplet name/identifier */
  dropletName: string;
  /** Current pool state */
  state: PoolState;
  /** Stack type installed on this server */
  stack: StackType;
  /** Region where this server is deployed */
  region: string;
  /** Droplet size slug */
  size: string;
  /** Public IP address */
  ipAddress: string;
  /** SSH port (default: 22) */
  sshPort: number;
  /** Timestamp when server was created */
  createdAt: Date;
  /** Timestamp when server entered current state */
  stateChangedAt: Date;
  /** ID of user this server is allocated to (if allocated) */
  allocatedTo?: string;
  /** Health check status */
  healthStatus: HealthStatus;
  /** Number of failed health checks */
  healthCheckFailures: number;
  /** Version of stack installed */
  stackVersion: string;
}

/**
 * Health status of a pooled server
 */
export enum HealthStatus {
  /** Health check not yet run */
  UNKNOWN = "unknown",
  /** Server is healthy and responding */
  HEALTHY = "healthy",
  /** Server health check failed */
  UNHEALTHY = "unhealthy",
  /** Server is degraded (partial functionality) */
  DEGRADED = "degraded",
}

/**
 * Pool metrics for monitoring
 */
export interface PoolMetrics {
  /** Total servers in pool (all states) */
  totalServers: number;
  /** Servers currently in standby (ready to allocate) */
  standbyServers: number;
  /** Servers currently allocated to users */
  allocatedServers: number;
  /** Servers being provisioned */
  provisioningServers: number;
  /** Servers in testing phase */
  testingServers: number;
  /** Servers in error state */
  errorServers: number;
  /** Servers being terminated */
  terminatingServers: number;
  /** Standby servers by stack type */
  standbyByStack: Record<StackType, number>;
  /** Standby servers by region */
  standbyByRegion: Record<string, number>;
  /** Average pool replenishment time (ms) */
  avgReplenishTime: number;
  /** Pool health percentage (0-100) */
  poolHealth: number;
}

/**
 * Pool configuration
 */
export interface PoolConfig {
  /** Target number of standby servers per stack */
  targetPoolSize: number;
  /** Minimum number of standby servers before alert */
  minPoolSize: number;
  /** Maximum number of servers allowed in pool (all states) */
  maxPoolSize: number;
  /** Health check interval in seconds */
  healthCheckInterval: number;
  /** Maximum allowed health check failures before marking unhealthy */
  maxHealthFailures: number;
  /** Regions to maintain pools in */
  regions: string[];
  /** Default droplet size for pool servers */
  defaultSize: string;
  /** Enable auto-replenishment */
  autoReplenish: boolean;
  /** Replenishment batch size */
  replenishBatchSize: number;
}
