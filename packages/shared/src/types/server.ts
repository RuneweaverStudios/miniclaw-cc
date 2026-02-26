import { PoolState, StackType, HealthStatus } from "./pool.js";

/**
 * User's allocated server details
 */
export interface UserServer {
  /** Unique server ID */
  id: string;
  /** User ID who owns this server */
  userId: string;
  /** DigitalOcean droplet ID */
  dropletId: number;
  /** Server hostname */
  hostname: string;
  /** Fully qualified domain name */
  fqdn: string;
  /** Stack type running on server */
  stack: StackType;
  /** Stack version */
  stackVersion: string;
  /** Region where server is deployed */
  region: string;
  /** Droplet size */
  size: string;
  /** Public IP address */
  ipAddress: string;
  /** SSH port */
  sshPort: number;
  /** Server status */
  status: ServerStatus;
  /** Timestamp when server was allocated to user */
  allocatedAt: Date;
  /** Timestamp when server expires (for trials) */
  expiresAt?: Date;
  /** Last health check timestamp */
  lastHealthCheck?: Date;
  /** Current health status */
  healthStatus: HealthStatus;
  /** Resource usage metrics */
  resources: ResourceUsage;
  /** Server configuration */
  config: ServerConfig;
}

/**
 * Server status from user perspective
 */
export enum ServerStatus {
  /** Server is being set up */
  PROVISIONING = "provisioning",
  /** Server is ready to use */
  ACTIVE = "active",
  /** Server is paused/stopped */
  PAUSED = "paused",
  /** Server is being terminated */
  TERMINATING = "terminating",
  /** Server is terminated */
  TERMINATED = "terminated",
  /** Server is in error state */
  ERROR = "error",
}

/**
 * Resource usage metrics
 */
export interface ResourceUsage {
  /** CPU usage percentage (0-100) */
  cpuPercent: number;
  /** Memory usage in MB */
  memoryUsed: number;
  /** Total memory in MB */
  memoryTotal: number;
  /** Disk usage in GB */
  diskUsed: number;
  /** Total disk in GB */
  diskTotal: number;
  /** Network RX bytes */
  networkRx: number;
  /** Network TX bytes */
  networkTx: number;
  /** Last updated timestamp */
  lastUpdated: Date;
}

/**
 * Server configuration
 */
export interface ServerConfig {
  /** Environment variables */
  envVars: Record<string, string>;
  /** Installed skills/addons */
  installedSkills: string[];
  /** Channel integrations */
  integrations: ChannelIntegration[];
  /** SSH public keys */
  sshKeys: string[];
  /** Custom domain (if set) */
  customDomain?: string;
  /** SSL enabled */
  sslEnabled: boolean;
}

/**
 * Channel integration configuration
 */
export interface ChannelIntegration {
  /** Integration type */
  type: ChannelType;
  /** Integration is active */
  active: boolean;
  /** Channel configuration */
  config: Record<string, unknown>;
  /** Timestamp when integration was added */
  addedAt: Date;
}

/**
 * Supported channel types
 */
export enum ChannelType {
  TELEGRAM = "telegram",
  DISCORD = "discord",
  WHATSAPP = "whatsapp",
  SLACK = "slack",
}

/**
 * Server action types
 */
export enum ServerAction {
  START = "start",
  STOP = "stop",
  RESTART = "restart",
  REBUILD = "rebuild",
  TERMINATE = "terminate",
}

/**
 * SSH access credentials
 */
export interface SSHCredentials {
  /** Host IP or domain */
  host: string;
  /** SSH port */
  port: number;
  /** SSH username */
  username: string;
  /** Private key (encrypted) */
  privateKey: string;
}
