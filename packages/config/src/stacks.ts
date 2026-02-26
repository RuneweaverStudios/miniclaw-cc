import { StackType } from "@miniclaw/shared";

/**
 * Stack version configuration
 */
export interface StackVersion {
  /** Stack type */
  type: StackType;
  /** Version string */
  version: string;
  /** Display name */
  name: string;
  /** Installation script URL or command */
  installCommand: string;
  /** Health check endpoint */
  healthCheckEndpoint?: string;
  /** Health check command */
  healthCheckCommand: string;
  /** Default port */
  defaultPort: number;
  /** Enable for new deployments */
  enabled: boolean;
  /** Latest version flag */
  latest: boolean;
}

/**
 * Available OpenClaw versions
 */
const OPENCLAW_VERSIONS: StackVersion[] = [
  {
    type: StackType.OPENCLAW,
    version: "1.0.0",
    name: "OpenClaw v1.0.0",
    installCommand: "curl -fsSL https://openclaw.ai/install.sh | bash",
    healthCheckEndpoint: "/health",
    healthCheckCommand: "curl -sf http://localhost:8080/health || exit 1",
    defaultPort: 8080,
    enabled: true,
    latest: true,
  },
];

/**
 * Available Nanobot versions
 */
const NANOBOT_VERSIONS: StackVersion[] = [
  {
    type: StackType.NANOBOT,
    version: "0.3.0",
    name: "Nanobot v0.3.0",
    installCommand: "pip install nanobot-ai==0.3.0",
    healthCheckCommand: "nanobot-cli health-check || exit 1",
    defaultPort: 3000,
    enabled: true,
    latest: true,
  },
  {
    type: StackType.NANOBOT,
    version: "0.2.5",
    name: "Nanobot v0.2.5",
    installCommand: "pip install nanobot-ai==0.2.5",
    healthCheckCommand: "nanobot-cli health-check || exit 1",
    defaultPort: 3000,
    enabled: false,
    latest: false,
  },
];

/**
 * All stack versions
 */
export const STACK_VERSIONS: StackVersion[] = [...OPENCLAW_VERSIONS, ...NANOBOT_VERSIONS];

/**
 * Get versions by stack type
 */
export function getVersionsByStack(type: StackType): StackVersion[] {
  return STACK_VERSIONS.filter((v) => v.type === type && v.enabled);
}

/**
 * Get latest version for a stack
 */
export function getLatestVersion(type: StackType): StackVersion | undefined {
  return STACK_VERSIONS.find((v) => v.type === type && v.latest && v.enabled);
}

/**
 * Get version by type and version string
 */
export function getVersion(type: StackType, version: string): StackVersion | undefined {
  return STACK_VERSIONS.find((v) => v.type === type && v.version === version);
}

/**
 * Get default stack versions
 */
export const DEFAULT_STACK_VERSIONS: Record<StackType, string> = {
  [StackType.OPENCLAW]: "1.0.0",
  [StackType.NANOBOT]: "0.3.0",
};
