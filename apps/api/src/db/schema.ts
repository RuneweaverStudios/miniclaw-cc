import { boolean, pgTable, text, timestamp, uuid, varchar, jsonb, integer } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  emailVerified: timestamp('email_verified', { withTimezone: true }),
  avatar: text('avatar'),
  provider: varchar('provider', { length: 50 }),
  providerId: varchar('provider_id', { length: 255 }),
  plan: varchar('plan', { length: 50 }).default('free'),
  planStatus: varchar('plan_status', { length: 50 }).default('active'),
  planExpiresAt: timestamp('plan_expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  status: varchar('status', { length: 50 }).default('active'),
});

export const userServers = pgTable('user_servers', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  dropletId: integer('droplet_id').notNull(),
  hostname: varchar('hostname', { length: 255 }).notNull(),
  fqdn: varchar('fqdn', { length: 255 }),
  stack: varchar('stack', { length: 100 }).notNull(),
  stackVersion: varchar('stack_version', { length: 50 }),
  region: varchar('region', { length: 50 }).notNull(),
  size: varchar('size', { length: 50 }).notNull(),
  ipAddress: varchar('ip_address', { length: 45 }),
  sshPort: integer('ssh_port').default(22),
  status: varchar('status', { length: 50 }).default('provisioning'),
  allocatedAt: timestamp('allocated_at', { withTimezone: true }).defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  healthStatus: varchar('health_status', { length: 50 }).default('unknown'),
  config: jsonb('config').$type<{
    monitoringEnabled: boolean;
    alertsEnabled: boolean;
    backupEnabled: boolean;
    customDomains: string[];
    environmentVariables: Record<string, string>;
  }>(),
});

export const poolServers = pgTable('pool_servers', {
  dropletId: integer('droplet_id').primaryKey(),
  dropletName: varchar('droplet_name', { length: 255 }).notNull(),
  state: varchar('state', { length: 50 }).notNull(),
  stack: varchar('stack', { length: 100 }).notNull(),
  region: varchar('region', { length: 50 }).notNull(),
  size: varchar('size', { length: 50 }).notNull(),
  ipAddress: varchar('ip_address', { length: 45 }).notNull(),
  sshPort: integer('ssh_port').default(22),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  stateChangedAt: timestamp('state_changed_at', { withTimezone: true }),
  allocatedTo: uuid('allocated_to').references(() => users.id, { onDelete: 'set null' }),
  healthStatus: varchar('health_status', { length: 50 }).default('unknown'),
  healthCheckFailures: integer('health_check_failures').default(0),
  stackVersion: varchar('stack_version', { length: 50 }),
});

export const allocations = pgTable('allocations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  poolServerId: integer('pool_server_id').notNull().references(() => poolServers.dropletId, { onDelete: 'cascade' }),
  allocatedAt: timestamp('allocated_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }).unique(),
  plan: varchar('plan', { length: 50 }).notNull(),
  status: varchar('status', { length: 50 }).notNull(),
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true }).notNull(),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }).notNull(),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false),
});

export const invoices = pgTable('invoices', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  stripeInvoiceId: varchar('stripe_invoice_id', { length: 255 }).unique(),
  amount: integer('amount').notNull(),
  currency: varchar('currency', { length: 3 }).default('usd'),
  status: varchar('status', { length: 50 }).notNull(),
  dueDate: timestamp('due_date', { withTimezone: true }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
});

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 100 }).notNull(),
  resourceType: varchar('resource_type', { length: 100 }).notNull(),
  resourceId: uuid('resource_id').notNull(),
  details: jsonb('details').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserServer = typeof userServers.$inferSelect;
export type NewUserServer = typeof userServers.$inferInsert;
export type PoolServer = typeof poolServers.$inferSelect;
export type NewPoolServer = typeof poolServers.$inferInsert;
export type Allocation = typeof allocations.$inferSelect;
export type NewAllocation = typeof allocations.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
