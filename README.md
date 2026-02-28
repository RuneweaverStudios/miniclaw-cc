# MiniClaw-CC

> VPS Provisioning Service with Standby Pool Architecture for OpenClaw/Nanobot instant deployment.

**MiniClaw-CC** provides instant server allocation from a pre-provisioned standby pool. Users receive access to a fully-configured AI agent server in sub-seconds instead of waiting 5-15 minutes for provisioning.

## ✨ Features

### Core Capabilities
- **Instant Server Allocation**: Sub-second VPS assignment from pre-provisioned standby pool
- **Stack Support**: OpenClaw (Node.js) and Nanobot (Python) AI agent frameworks
- **Per-Droplet OpenRouter Keys**: Each droplet gets unique API keys for usage tracking and security
- **Telegram Integration**: One-click Telegram bot configuration
- **Model Selection**: Support for 40+ AI models via OpenRouter (Claude, GPT-4, Gemini, MiniMax, Kimi, etc.)

### Infrastructure
- **Auto-Scaling Pool**: Intelligent pool replenishment based on demand
- **Health Monitoring**: Continuous health checks with auto-recovery
- **Multi-Region**: Deploy pools across DigitalOcean regions
- **Server Cleanup**: Automatic cleanup on deallocation (Telegram tokens, API keys)

### Developer Experience
- **E2E Testing**: Comprehensive onboarding flow tests
- **Pool Management Scripts**: Quick CLI tools for pool operations
- **Type-Safe**: Full TypeScript with Drizzle ORM

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           MiniClaw-CC Architecture                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐           │
│  │   Web UI     │      │  Public API  │      │   Admin      │           │
│  │  (React)     │      │   (Hono.js)  │      │   Panel      │           │
│  └──────┬───────┘      └──────┬───────┘      └──────┬───────┘           │
│         │                     │                     │                   │
│         └─────────────────────┼─────────────────────┘                   │
│                               │                                          │
│                    ┌──────────▼──────────┐                               │
│                    │   Pool Manager      │                               │
│                    │   (Redis State)     │                               │
│                    └──────────┬──────────┘                               │
│                              │                                          │
│         ┌────────────────────┼────────────────────┐                     │
│         │                    │                    │                     │
│  ┌──────▼──────┐     ┌───────▼───────┐    ┌──────▼──────┐              │
│  │   Redis     │     │  PostgreSQL   │    │   BullMQ    │              │
│  │  (Pool State│     │  (Users,      │    │  (Job Queue)│              │
│  │   Cache)    │     │   Allocations)│    │             │              │
│  └─────────────┘     └───────────────┘    └─────────────┘              │
│                              │                                          │
│                              ▼                                          │
│         ┌─────────────────────────────────────────────┐                 │
│         │          DigitalOcean API                   │                 │
│         │  - Provision droplets                       │                 │
│         │  - Manage SSH keys                          │                 │
│         │  - Create snapshots                         │                 │
│         └─────────────────────────────────────────────┘                 │
│                                                                           │
│  Pool States:                                                              │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐                  │
│  │PROVISION│ → │TESTING  │ → │ STANDBY │ → │ALLOCATED│                  │
│  │  ING    │   │         │   │  (Ready)│   │          │                  │
│  └─────────┘   └─────────┘   └─────────┘   └─────────┘                  │
│       ▲                                                           │       │
│       └──────────────────── Auto-Replenishment ───────────────────┘       │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 22+
- **pnpm** 10+
- **Redis** 7+
- **PostgreSQL** 16+
- **DigitalOcean** account with API token
- **OpenRouter** API key (for LLM access)
- **SSH key** configured in DigitalOcean

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/miniclaw-cc.git
cd miniclaw-cc

# Install dependencies
pnpm install

# Set up environment
cat > .env.local << 'EOF'
# DigitalOcean
DIGITALOCEAN_TOKEN=your_do_token_here
DIGITALOCEAN_SSH_KEY_ID=your_ssh_key_id

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/miniclaw

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# OpenRouter (Master Key)
OPENROUTER_API_KEY=your_openrouter_key

# Authentication
JWT_SECRET=your_jwt_secret_here

# SSH (for server configuration)
SSH_PRIVATE_KEY_PATH=/path/to/private/key
EOF

# Set up database
pnpm --filter @miniclaw/api db:push

# Start development servers
pnpm dev
```

### Initial Pool Setup

```bash
# 1. Check current pool status
pnpm --filter @miniclaw/api pool:check

# 2. Run E2E test to provision and test servers
pnpm --filter @miniclaw/api test:onboarding -- --count 5

# 3. Or refill with existing droplets
pnpm --filter @miniclaw/api pool:refill -- --use-existing
```

## 📜 Available Scripts

### Pool Management

```bash
# Check pool status (recommended first command)
pnpm --filter @miniclaw/api pool:check

# E2E test: Provision and test new servers
pnpm --filter @miniclaw/api test:onboarding
pnpm --filter @miniclaw/api test:onboarding -- --count 3
pnpm --filter @miniclaw/api test:onboarding -- --type nanobot
pnpm --filter @miniclaw/api test:onboarding -- --skip-provision  # Test existing servers

# Quick refill with existing DO droplets
pnpm --filter @miniclaw/api pool:refill
pnpm --filter @miniclaw/api pool:refill -- --nanobots 3

# Deallocate a specific server
pnpm --filter @miniclaw/api pool:deallocate <dropletId>

# Clear all test allocations
pnpm --filter @miniclaw/api pool:clear-allocations

# Prepare for production (clear all test data)
pnpm --filter @miniclaw/api pool:prepare
```

### Development

```bash
# Terminal 1: API Server
pnpm --filter @miniclaw/api dev

# Terminal 2: Web Dashboard
pnpm --filter @miniclaw/web dev
```

## 📊 Project Structure

```
miniclaw-cc/
├── apps/
│   ├── api/                          # Hono.js backend API
│   │   ├── src/
│   │   │   ├── routes/               # API routes
│   │   │   │   ├── auth.ts          # OAuth, signup, login
│   │   │   │   ├── pool.ts          # Pool management endpoints
│   │   │   │   ├── servers-allocate.ts # Server allocation flow
│   │   │   │   └── billing.ts       # Stripe integration
│   │   │   ├── services/             # Business logic
│   │   │   │   ├── pool-manager.ts  # Core pool orchestration
│   │   │   │   ├── allocator.ts     # Server allocation logic
│   │   │   │   ├── provisioner.ts   # DO provisioning
│   │   │   │   ├── nanobot.ts       # Nanobot installation
│   │   │   │   ├── openclaw.ts      # OpenClaw installation
│   │   │   │   ├── health-check.ts  # Server health monitoring
│   │   │   │   ├── server-cleanup.ts # Cleanup on deallocation
│   │   │   │   ├── openrouter.ts    # Per-droplet key management
│   │   │   │   └── auth.ts          # Authentication service
│   │   │   ├── workers/              # Background workers
│   │   │   │   ├── replenisher.ts   # Pool auto-replenishment
│   │   │   │   ├── health-monitor.ts # Continuous health checks
│   │   │   │   └── reclaimer.ts     # Server reclamation
│   │   │   ├── db/                   # Database schema
│   │   │   │   └── schema.ts        # Drizzle ORM schema
│   │   │   └── lib/                  # Utilities
│   │   │       ├── digitalocean.ts   # DO API client
│   │   │       ├── redis.ts          # Redis client
│   │   │       ├── ssh.ts            # SSH utilities
│   │   │       └── queue.ts          # BullMQ setup
│   │   ├── test-onboarding-flow.ts   # E2E onboarding test
│   │   ├── pool-refill.ts            # Quick pool refill
│   │   ├── check-pool.ts             # Pool status check
│   │   ├── deallocate-server.ts      # Manual deallocation
│   │   └── prepare-for-prod.ts       # Production cleanup
│   │
│   └── web/                          # React + Vite dashboard
│       └── src/
│           ├── components/           # UI components
│           ├── pages/                # Route pages
│           └── lib/                  # Utilities
│
├── packages/
│   ├── shared/                       # Shared TypeScript types
│   └── config/                       # Shared configuration
│
└── infrastructure/
    ├── scripts/                      # Server installation scripts
    └── terraform/                    # Infrastructure as Code
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DIGITALOCEAN_TOKEN` | DigitalOcean API token | ✅ | - |
| `DIGITALOCEAN_SSH_KEY_ID` | SSH key fingerprint in DO | - | - |
| `DATABASE_URL` | PostgreSQL connection string | ✅ | - |
| `REDIS_HOST` | Redis host | - | localhost |
| `REDIS_PORT` | Redis port | - | 6379 |
| `OPENROUTER_API_KEY` | Master OpenRouter API key | ✅ | - |
| `JWT_SECRET` | JWT signing secret | ✅ | - |
| `SSH_PRIVATE_KEY` | Private key for SSH connections | ✅* | - |
| `SSH_PRIVATE_KEY_PATH` | Path to SSH private key | ✅* | - |
| `STRIPE_SECRET_KEY` | Stripe secret key (billing) | - | - |

*Either `SSH_PRIVATE_KEY` or `SSH_PRIVATE_KEY_PATH` is required.

### Pool Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `POOL_TARGET_SIZE` | Target total pool size | 10 |
| `POOL_NANOBOT_RATIO` | Ratio of Nanobot servers | 0.5 (50%) |
| `POOL_REGION` | Default region | nyc1 |
| `POOL_SIZE` | Default droplet size | s-1vcpu-1gb |

## 🎯 Supported AI Models

Via OpenRouter integration, we support 40+ models including:

### Budget-Friendly
- **MiniMax M2.5** - Best value, Chinese-optimized
- **Google Gemini 2.0 Flash** - Free tier available
- **Qwen 2.5 Flash** - Fast and affordable

### Balanced
- **Claude 3.5 Haiku** - Fast, capable
- **GPT-4O Mini** - Cost-effective
- **DeepSeek V3** - Strong performance

### Premium
- **Claude Sonnet 4** - Advanced reasoning
- **GPT-4O** - Gold standard
- **Gemini Pro** - Multimodal
- **Kimi K2.5** - Top-ranked

### Experimental
- **GPT-OSS 120B** - Cutting edge

> Each user gets $25/month in OpenRouter tokens included. Premium models consume tokens faster.

## 🔐 Security

### Per-Droplet OpenRouter Keys

Each droplet receives a unique OpenRouter API key:
- **Format**: `or-mini-{dropletId}-{uuid}`
- **Storage**: Redis + database
- **Lifecycle**: Created on allocation, revoked on deallocation
- **Benefits**:
  - Usage tracking per droplet
  - Isolated rate limiting
  - Security (no shared keys)

### Server Cleanup

On deallocation, the following are automatically removed:
- Telegram bot tokens from config files
- Droplet-specific OpenRouter API keys
- Gateway process termination
- Sensitive log files

## 🧪 E2E Testing

The `test-onboarding-flow.ts` script validates the entire onboarding process:

1. **Provisioning** - Create droplet via DO API
2. **SSH Ready** - Wait for SSH availability
3. **Cloud-init** - Wait for initialization completion
4. **Stack Install** - Install Nanobot or verify OpenClaw
5. **OpenRouter Key** - Create per-droplet API key
6. **LLM Config** - Configure model and test connectivity
7. **Health Check** - Verify gateway health endpoint
8. **Pool Addition** - Add to pool as standby+healthy

```bash
# Run full test
pnpm --filter @miniclaw/api test:onboarding -- --count 1

# Test without destroying servers
pnpm --filter @miniclaw/api test:onboarding -- --destroy-after false

# Test existing servers (skip provisioning)
pnpm --filter @miniclaw/api test:onboarding -- --skip-provision
```

## 📈 Pool States

Servers transition through these states:

| State | Description | Next States |
|-------|-------------|-------------|
| `provisioning` | Being created | `testing`, `error` |
| `testing` | Installation & validation | `standby`, `error` |
| `standby` | Ready for allocation | `allocated` |
| `allocated` | Assigned to user | `standby`, `error` |
| `error` | Needs attention | `standby` (after fix) |

### Health Status

| Status | Description |
|--------|-------------|
| `healthy` | All checks passing |
| `degraded` | Running with issues (high CPU/memory) |
| `unhealthy` | Service down or unreachable |
| `pending` | Not yet checked |

## 🔧 Troubleshooting

### Pool shows servers but not healthy
```bash
# Re-test existing servers
pnpm --filter @miniclaw/api test:onboarding -- --skip-provision --count 5
```

### Droplets stuck in provisioning
```bash
# Check DO status
pnpm --filter @miniclaw/api pool:check

# Verify droplet is active in DO dashboard
# If active, run pool refill
pnpm --filter @miniclaw/api pool:refill -- --use-existing
```

### Gateway health checks failing
```bash
# SSH into droplet and check logs
ssh root@<droplet-ip>
tail -100 /tmp/gateway-test.log

# Check if gateway is running
ps aux | grep gateway

# Manually start gateway
nanobot gateway  # or: openclaw gateway
```

### OpenRouter keys not being created
```bash
# Verify master key is set
echo $OPENROUTER_API_KEY

# Check Redis is running
redis-cli ping

# Test key creation
pnpm --filter @miniclaw/api test:onboarding -- --count 1
```

## 📚 API Documentation

### Pool Status
```bash
GET /api/pool/status
```

### Allocate Server
```bash
POST /api/servers/allocate
{
  "framework": "nanobot",
  "model": "minimax/minimax-m2.5",
  "channel": "telegram"
}
```

### Configure Telegram
```bash
POST /api/servers/:id/configure-telegram
{
  "botToken": "123456:ABC-DEF1234ghikl..."
}
```

### Server Status
```bash
GET /api/servers/:id/status
```

## 🚢 Deployment

### Production Build
```bash
# Build all packages
pnpm build

# Start services
pnpm --filter @miniclaw/api start
```

### Docker Deployment
```bash
# Build API image
docker build -f infrastructure/docker/api.Dockerfile -t miniclaw-api .

# Run with docker-compose
cd infrastructure/docker
docker-compose up -d
```

### Environment Checklist
- [ ] `DIGITALOCEAN_TOKEN` configured
- [ ] `OPENROUTER_API_KEY` configured
- [ ] SSH key configured in DO
- [ ] Database migrated (`db:push`)
- [ ] Redis running
- [ ] Pool initialized with servers
- [ ] Health monitor started

## 📝 License

MIT

## 🆘 Support

- **GitHub Issues**: https://github.com/yourusername/miniclaw-cc/issues
- **Documentation**: See `apps/api/README-SCRIPTS.md` for script reference
