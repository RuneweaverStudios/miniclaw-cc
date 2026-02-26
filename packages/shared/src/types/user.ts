/**
 * User account
 */
export interface User {
  /** Unique user ID */
  id: string;
  /** User email */
  email: string;
  /** User display name */
  name: string;
  /** Email verification status */
  emailVerified: boolean;
  /** Avatar URL */
  avatar?: string;
  /** OAuth provider (if applicable) */
  provider?: OAuthProvider;
  /** Provider-specific user ID */
  providerId?: string;
  /** Current subscription plan */
  plan: PlanType;
  /** Plan status */
  planStatus: PlanStatus;
  /** Timestamp when plan expires (for non-enterprise) */
  planExpiresAt?: Date;
  /** Account creation timestamp */
  createdAt: Date;
  /** Last login timestamp */
  lastLoginAt?: Date;
  /** Account status */
  status: UserStatus;
}

/**
 * OAuth providers
 */
export enum OAuthProvider {
  GOOGLE = "google",
  GITHUB = "github",
  EMAIL_OTP = "email_otp",
}

/**
 * Subscription plan types
 */
export enum PlanType {
  /** Free trial plan */
  FREE = "free",
  /** Basic paid plan ($5/mo) */
  BASIC = "basic",
  /** Pro plan ($15/mo) */
  PRO = "pro",
  /** Enterprise plan (custom pricing) */
  ENTERPRISE = "enterprise",
}

/**
 * Plan status
 */
export enum PlanStatus {
  /** Plan is active */
  ACTIVE = "active",
  /** Plan is past due */
  PAST_DUE = "past_due",
  /** Plan is cancelled */
  CANCELLED = "cancelled",
  /** Plan is in trial period */
  TRIAL = "trial",
}

/**
 * User account status
 */
export enum UserStatus {
  /** Account is active */
  ACTIVE = "active",
  /** Account is suspended */
  SUSPENDED = "suspended",
  /** Account is banned */
  BANNED = "banned",
  /** Account is pending verification */
  PENDING = "pending",
}

/**
 * Plan limits and quotas
 */
export interface PlanLimits {
  /** Maximum number of servers */
  maxServers: number;
  /** Maximum server size (slug) */
  maxServerSize: string;
  /** Maximum memory per server (MB) */
  maxMemoryMB: number;
  /** Included CPU cores */
  includedCpuCores: number;
  /** Monthly API call limit */
  monthlyApiCalls: number;
  /** Support level */
  supportLevel: SupportLevel;
  /** Custom domain allowed */
  customDomain: boolean;
  /** SSL certificate included */
  sslIncluded: boolean;
  /** Backup retention (days) */
  backupRetentionDays: number;
}

/**
 * Support level for plans
 */
export enum SupportLevel {
  /** Community support only */
  COMMUNITY = "community",
  /** Email support */
  EMAIL = "email",
  /** Priority email support */
  PRIORITY = "priority",
  /** Dedicated support */
  DEDICATED = "dedicated",
}

/**
 * Billing information
 */
export interface BillingInfo {
  /** Stripe customer ID */
  stripeCustomerId?: string;
  /** Default payment method ID */
  defaultPaymentMethod?: string;
  /** Billing address */
  address?: BillingAddress;
  /** Tax ID */
  taxId?: string;
}

/**
 * Billing address
 */
export interface BillingAddress {
  /** Street address line 1 */
  line1: string;
  /** Street address line 2 */
  line2?: string;
  /** City */
  city: string;
  /** State/province */
  state?: string;
  /** Postal code */
  postalCode: string;
  /** ISO country code */
  country: string;
}

/**
 * Usage statistics
 */
export interface UsageStats {
  /** Current number of servers */
  currentServers: number;
  /** Current month's API calls */
  apiCallsThisMonth: number;
  /** Current period start */
  periodStart: Date;
  /** Current period end */
  periodEnd: Date;
}
