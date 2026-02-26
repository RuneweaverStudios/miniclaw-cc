# MiniClaw-CC

VPS Provisioning Service with Standby Pool Architecture for OpenClaw/Nanobot instant deployment.

## Features

- **Instant Server Allocation**: Sub-second VPS assignment from pre-provisioned standby pool
- **Stack Support**: OpenClaw and Nanobot AI agent frameworks
- **Auto-Scaling**: Intelligent pool replenishment based on demand
- **Health Monitoring**: Continuous health checks with auto-recovery
- **Multi-Region**: Deploy pools across DigitalOcean regions
- **Billing Integration**: Stripe subscriptions with multiple plan tiers

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           MiniClaw-CC Architecture                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Web Dashboard → API Gateway → Pool Manager → DigitalOcean API           │
│       (React)         (Hono.js)      (Redis)      (Droplets)             │
│                                                                           │
│  Background Workers:                                                       │
│  - Replenisher: Maintains pool size                                      │
│  - Health Monitor: Checks server health                                  │
│  - Reclaimer: Reclaims unused servers                                     │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 22+
- pnpm 10+
- Redis 7+
- PostgreSQL 16+
- DigitalOcean account
- Stripe account (for billing)

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/miniclaw-cc.git
cd miniclaw-cc

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your configuration

# Set up database
pnpm --filter @miniclaw/api db:push

# Build all packages
pnpm build

# Start development servers
pnpm dev
```

### Development

```bash
# Terminal 1: API Server
pnpm --filter @miniclaw/api dev

# Terminal 2: Worker
pnpm --filter @miniclaw/worker dev

# Terminal 3: Web Dashboard
pnpm --filter @miniclaw/web dev
```

### Production Deployment

```bash
# Build everything
pnpm build

# Run API server
pnpm --filter @miniclaw/api start

# Run worker
pnpm --filter @miniclaw/worker start
```

## Configuration

Key environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `DIGITALOCEAN_TOKEN` | DO API token | Required |
| `REDIS_HOST` | Redis host | localhost |
| `DATABASE_URL` | PostgreSQL URL | Required |
| `STRIPE_SECRET_KEY` | Stripe secret key | Required |
| `JWT_SECRET` | JWT signing secret | Required |
| `POOL_TARGET_SIZE` | Target pool size | 10 |

## Stack Differences

### OpenClaw
- **Language**: Node.js/TypeScript
- **Install**: `curl -fsSL https://openclaw.ai/install.sh | bash`
- **Config**: `~/.openclaw/openclaw.json`
- **Gateway Port**: 18789
- **CLI**: `openclaw onboard`, `openclaw gateway`

### Nanobot
- **Language**: Python 3.11+
- **Install**: `pip install nanobot-ai`
- **Config**: `~/.nanobot/config.json`
- **Gateway Port**: 18790
- **CLI**: `nanobot onboard`, `nanobot gateway`

## Project Structure

```
miniclaw-cc/
├── apps/
│   ├── api/           # Hono.js backend API
│   ├── web/           # React + Vite dashboard
│   └── worker/        # Background job processor
├── packages/
│   ├── shared/        # Shared TypeScript types
│   └── config/        # Shared configuration
└── infrastructure/
    ├── scripts/       # Installation scripts
    ├── terraform/     # Infrastructure as Code
    └── docker/        # Docker configurations
```

## CLI Tools

### Setup

```bash
# Authenticate with DigitalOcean
do auth init

# Authenticate with GitHub
gh auth login

# Authenticate with Stripe
stripe login

# Initialize Redis
redis-cli ping

# Initialize database
pnpm --filter @miniclaw/api db:push
```

### Pool Management

```bash
# View pool status
curl http://localhost:4000/api/pool/status

# Adjust pool size
curl -X POST http://localhost:4000/api/pool/adjust -d '{"targetSize": 20}'

# Force replenishment
curl -X POST http://localhost:4000/api/pool/replenish
```

## License

MIT

## Support

- GitHub Issues: https://github.com/yourusername/miniclaw-cc/issues
- Documentation: https://docs.miniclaw.cc
