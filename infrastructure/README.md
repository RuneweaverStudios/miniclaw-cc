# Miniclaw Infrastructure

This directory contains all infrastructure configuration, scripts, and documentation for deploying and managing Miniclaw services.

## Directory Structure

```
infrastructure/
├── scripts/           # Installation and maintenance scripts
│   ├── cloud-init.yaml
│   ├── install-openclaw.sh
│   ├── install-nanobot.sh
│   └── health-check.sh
├── terraform/         # Infrastructure as Code
│   └── base-image/
│       ├── main.tf
│       ├── variables.tf
│       ├── outputs.tf
│       ├── terraform.tfvars.example
│       └── README.md
├── docker/           # Container configurations
│   ├── api.Dockerfile
│   ├── worker.Dockerfile
│   ├── start-worker-with-redis.sh
│   └── README.md
└── README.md         # This file
```

## Quick Start

### 1. Prerequisites

- DigitalOcean account
- Terraform >= 1.0
- Docker and Docker Compose
- SSH key pair
- Domain name (optional)

### 2. Deploy Base Infrastructure

```bash
cd infrastructure/terraform/base-image
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values
terraform init
terraform apply
```

### 3. Install Services

SSH into the droplet and run installation scripts:

```bash
ssh root@<droplet-ip>
sudo /opt/miniclaw-scripts/install-openclaw.sh
sudo /opt/miniclaw-scripts/install-nanobot.sh
```

### 4. Verify Installation

```bash
/opt/miniclaw-scripts/health-check.sh
```

## Scripts

### cloud-init.yaml

Cloud-init configuration for base droplet setup.

**Features:**
- System updates and security hardening
- Docker and Docker Compose installation
- User creation (openclaw, nanobot)
- Firewall configuration (UFW)
- Fail2Ban setup
- SSH security hardening
- Performance tuning
- Log rotation setup

### install-openclaw.sh

Automated OpenClaw installation script.

**Features:**
- Dependency installation
- OpenClaw installation via official installer
- Configuration file creation
- Health check endpoint setup
- Systemd service creation
- Post-install verification

**Usage:**
```bash
sudo ./install-openclaw.sh
```

**Environment Variables:**
- `OPENCLAW_PORT`: Port for OpenClaw service (default: 3000)

### install-nanobot.sh

Automated Nanobot installation script.

**Features:**
- Python environment setup
- Virtual environment creation
- Nanobot installation via pip
- Configuration file creation
- Health check endpoint setup
- Systemd service creation
- Post-install verification

**Usage:**
```bash
sudo ./install-nanobot.sh
```

**Environment Variables:**
- `NANOBOT_PORT`: Port for Nanobot service (default: 8000)
- `PYTHON_VERSION`: Python version to use (default: 3.11)

### health-check.sh

Comprehensive health check script for all services.

**Features:**
- Service status checks (systemd)
- HTTP endpoint checks
- Docker container checks
- System resource monitoring
- JSON-formatted output
- Exit codes for monitoring

**Usage:**
```bash
# Check all services
./health-check.sh

# Check specific service
./health-check.sh -s openclaw

# Verbose output
./health-check.sh -v

# Check Docker containers only
./health-check.sh --docker

# Quiet mode (errors only)
./health-check.sh -q
```

**Exit Codes:**
- `0`: All checks passed
- `1`: One or more warnings
- `2`: One or more critical errors
- `3`: Unknown error

## Terraform

See [terraform/base-image/README.md](terraform/base-image/README.md) for detailed Terraform documentation.

### Key Resources

- **Droplet**: Base server with cloud-init
- **SSH Key**: Authentication key
- **Firewall**: Network security rules
- **Floating IP**: Static IP (optional)
- **Volume**: Additional storage (optional)
- **DNS Records**: Domain configuration (optional)
- **Snapshot**: Base image backup (optional)

## Docker

See [docker/README.md](docker/README.md) for detailed Docker documentation.

### Available Images

- **api.Dockerfile**: API service (Hono.js backend)
- **worker.Dockerfile**: Background worker service

### Build and Run

```bash
# Build API image
docker build -f infrastructure/docker/api.Dockerfile -t miniclaw-api:latest .

# Build Worker image
docker build -f infrastructure/docker/worker.Dockerfile -t miniclaw-worker:latest .

# Run with Docker Compose
docker-compose up -d
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DigitalOcean Droplet                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   Cloud-Init                         │   │
│  │  - System updates                                   │   │
│  │  - Docker installation                              │   │
│  │  - User setup (openclaw, nanobot)                   │   │
│  │  - Firewall (UFW)                                   │   │
│  │  - Fail2Ban                                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────┐  ┌──────────────────┐              │
│  │   OpenClaw       │  │    Nanobot       │              │
│  │   Port: 3000     │  │    Port: 8000    │              │
│  │   Type: Agent    │  │    Type: Agent   │              │
│  └──────────────────┘  └──────────────────┘              │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │              Docker Containers                        │ │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐    │ │
│  │  │    API     │  │   Worker   │  │  Dashboard │    │ │
│  │  │  Port:8080 │  │  Port:9090 │  │  Port:3000 │    │ │
│  │  └────────────┘  └────────────┘  └────────────┘    │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌────────────┐  ┌────────────┐                            │
│  │ PostgreSQL │  │   Redis    │                            │
│  │  Port:5432 │  │  Port:6379 │                            │
│  └────────────┘  └────────────┘                            │
└─────────────────────────────────────────────────────────────┘
```

## Service Ports

| Service | Port | Protocol | Purpose |
|---------|------|----------|---------|
| OpenClaw | 3000 | HTTP | Agent framework |
| Nanobot | 8000 | HTTP | Agent framework |
| API | 8080 | HTTP | REST API |
| Worker | 9090 | HTTP | Job processing |
| Dashboard | 3000 | HTTP | Web UI |
| PostgreSQL | 5432 | TCP | Database |
| Redis | 6379 | TCP | Queue/Cache |

## Security

### Firewall Rules

Default firewall configuration (via cloud-init):

- SSH (22): Allowed from all (restrict in production)
- HTTP (80): Allowed from all
- HTTPS (443): Allowed from all
- OpenClaw (3000): Allowed from all
- Nanobot (8000): Allowed from all
- API (8080): Allowed from all
- Worker (9090): Allowed from all

### SSH Security

- Password authentication disabled
- Root login disabled
- Key-based authentication required
- Fail2Ban enabled for brute-force protection

### Best Practices

1. **Restrict SSH Access**: Limit firewall rules to specific IPs
2. **Use Secrets Manager**: Never commit secrets to git
3. **Enable Backups**: Enable DigitalOcean automatic backups
4. **Monitor Resources**: Set up monitoring and alerting
5. **Update Regularly**: Keep system and dependencies updated
6. **Use HTTPS**: Configure SSL/TLS certificates
7. **Network Isolation**: Use VPC for private networking

## Monitoring

### Health Checks

```bash
# Check all services
/opt/miniclaw-scripts/health-check.sh

# Check specific endpoint
curl http://localhost:3000/health  # OpenClaw
curl http://localhost:8000/health  # Nanobot
curl http://localhost:8080/health  # API
curl http://localhost:9090/health  # Worker
```

### Logs

```bash
# Service logs
sudo journalctl -u openclaw -f
sudo journalctl -u nanobot -f

# Application logs
tail -f /var/log/miniclaw/openclaw.log
tail -f /var/log/miniclaw/nanobot.log

# Docker logs
docker logs -f miniclaw-api
docker logs -f miniclaw-worker
```

### Metrics

- DigitalOcean Monitoring (built-in)
- Custom metrics via health endpoints
- Resource usage via `health-check.sh`

## Backup and Recovery

### Automated Backups

Enable in `terraform.tfvars`:
```hcl
enable_backups = true
backup_retention_days = 30
```

### Manual Backup

```bash
# Create snapshot
doctl compute droplet snapshot <droplet-id> --snapshot-name "backup-$(date +%Y%m%d)"

# Backup database
docker exec postgres pg_dump -U miniclaw miniclaw > backup.sql

# Backup Redis
docker exec redis redis-cli SAVE
docker cp redis:/data/dump.rdb backup/redis/
```

### Restore

```bash
# Restore from snapshot
doctl compute droplet create restored-droplet --snapshot-id <snapshot-id>

# Restore database
docker exec -i postgres psql -U miniclaw miniclaw < backup.sql

# Restore Redis
docker cp backup/redis/dump.rdb redis:/data/dump.rdb
```

## Scaling

### Horizontal Scaling

Use Terraform to create multiple droplets:

```hcl
resource "digitalocean_droplet" "app_servers" {
  count = 3
  # ... configuration
}
```

### Vertical Scaling

Upgrade droplet size:

```hcl
droplet_size = "s-4vcpu-8gb"  # Larger size
```

### Load Balancing

Use DigitalOcean Load Balancer:

```hcl
resource "digitalocean_loadbalancer" "app_lb" {
  name   = "minicaw-lb"
  region = var.region

  droplet_ids = digitalocean_droplet.app_servers[*].id

  forwarding_rule {
    entry_port     = 80
    entry_protocol = "http"

    target_port     = 8080
    target_protocol = "http"
  }
}
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy Infrastructure

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v2

      - name: Terraform Apply
        run: |
          cd infrastructure/terraform/base-image
          terraform init
          terraform apply -auto-approve
        env:
          TF_VAR_do_token: ${{ secrets.DO_TOKEN }}
```

## Troubleshooting

### Common Issues

**Droplet Not Responding:**
```bash
# Check droplet status
doctl compute droplet get <droplet-id>

# View console
doctl compute droplet console <droplet-id>

# Reboot
doctl compute droplet reboot <droplet-id>
```

**Service Not Starting:**
```bash
# Check service status
sudo systemctl status openclaw

# View logs
sudo journalctl -u openclaw -n 50

# Restart service
sudo systemctl restart openclaw
```

**Docker Issues:**
```bash
# Check Docker status
sudo systemctl status docker

# View container logs
docker logs --tail 100 <container-name>

# Restart containers
docker-compose restart
```

**Memory Issues:**
```bash
# Check memory usage
free -h

# Check process memory
ps aux --sort=-%mem | head -n 10

# Restart if needed
sudo systemctl restart openclaw
```

## Cost Management

### Estimated Monthly Costs

| Resource | Cost | Notes |
|----------|------|-------|
| Droplet (2vCPU, 4GB) | $40 | Base server |
| Monitoring | $5 | Optional |
| Backups | $4 | Optional |
| Floating IP | $5 | Optional |
| Volume (100GB) | $10 | Optional |
| Load Balancer | $12 | Optional |
| **Total (Basic)** | **$44** | Droplet + Monitoring |
| **Total (Full)** | **$76** | All services |

### Cost Optimization

1. **Use appropriate droplet size**: Don't over-provision
2. **Enable monitoring only when needed**: $5/month savings
3. **Use snapshots instead of always-on backups**: For dev/staging
4. **Clean up unused resources**: Remove old snapshots, volumes
5. **Use reserved instances**: For long-running production workloads

## Maintenance

### Regular Tasks

**Daily:**
- Monitor health checks
- Review error logs

**Weekly:**
- Review resource usage
- Check for security updates

**Monthly:**
- Review and update dependencies
- Test backup restoration
- Review costs
- Audit access logs

**Quarterly:**
- Major security updates
- Performance review
- Architecture review

### Updates

**System Updates:**
```bash
sudo apt update && sudo apt upgrade -y
sudo reboot
```

**Application Updates:**
```bash
cd /opt/openclaw
./update.sh  # Custom update script
```

**Docker Updates:**
```bash
# Rebuild images
docker-compose build

# Recreate containers
docker-compose up -d --force-recreate
```

## Support and Documentation

- **Main Documentation**: See project root README
- **API Documentation**: `/apps/api/README.md`
- **Terraform**: `/infrastructure/terraform/base-image/README.md`
- **Docker**: `/infrastructure/docker/README.md`
- **DigitalOcean Docs**: https://docs.digitalocean.com/

## License

See project root LICENSE file.
