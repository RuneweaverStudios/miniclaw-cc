CREATE TABLE "allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"pool_server_id" integer NOT NULL,
	"allocated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" varchar(100) NOT NULL,
	"resource_type" varchar(100) NOT NULL,
	"resource_id" uuid NOT NULL,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stripe_invoice_id" varchar(255),
	"amount" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'usd',
	"status" varchar(50) NOT NULL,
	"due_date" timestamp with time zone,
	"paid_at" timestamp with time zone,
	CONSTRAINT "invoices_stripe_invoice_id_unique" UNIQUE("stripe_invoice_id")
);
--> statement-breakpoint
CREATE TABLE "pool_servers" (
	"droplet_id" integer PRIMARY KEY NOT NULL,
	"droplet_name" varchar(255) NOT NULL,
	"state" varchar(50) NOT NULL,
	"stack" varchar(100) NOT NULL,
	"region" varchar(50) NOT NULL,
	"size" varchar(50) NOT NULL,
	"ip_address" varchar(45) NOT NULL,
	"ssh_port" integer DEFAULT 22,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"state_changed_at" timestamp with time zone,
	"allocated_to" uuid,
	"health_status" varchar(50) DEFAULT 'unknown',
	"health_check_failures" integer DEFAULT 0,
	"stack_version" varchar(50)
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stripe_customer_id" varchar(255),
	"stripe_subscription_id" varchar(255),
	"plan" varchar(50) NOT NULL,
	"status" varchar(50) NOT NULL,
	"current_period_start" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false,
	CONSTRAINT "subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "user_servers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"droplet_id" integer NOT NULL,
	"hostname" varchar(255) NOT NULL,
	"fqdn" varchar(255),
	"stack" varchar(100) NOT NULL,
	"stack_version" varchar(50),
	"region" varchar(50) NOT NULL,
	"size" varchar(50) NOT NULL,
	"ip_address" varchar(45),
	"ssh_port" integer DEFAULT 22,
	"status" varchar(50) DEFAULT 'provisioning',
	"allocated_at" timestamp with time zone DEFAULT now(),
	"expires_at" timestamp with time zone,
	"health_status" varchar(50) DEFAULT 'unknown',
	"config" jsonb
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255),
	"email_verified" timestamp with time zone,
	"avatar" text,
	"provider" varchar(50),
	"provider_id" varchar(255),
	"plan" varchar(50) DEFAULT 'free',
	"plan_status" varchar(50) DEFAULT 'active',
	"plan_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	"status" varchar(50) DEFAULT 'active',
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_pool_server_id_pool_servers_droplet_id_fk" FOREIGN KEY ("pool_server_id") REFERENCES "public"."pool_servers"("droplet_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_servers" ADD CONSTRAINT "pool_servers_allocated_to_users_id_fk" FOREIGN KEY ("allocated_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_servers" ADD CONSTRAINT "user_servers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;