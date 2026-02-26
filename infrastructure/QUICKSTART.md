# Infrastructure Scripts - Quick Reference

## Quick Start Guide

### 1. Deploy Infrastructure with Terraform

```bash
cd infrastructure/terraform/base-image
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your API token
terraform init
terraform apply
```

### 2. SSH into the Droplet

```bash
ssh root@<droplet-ip>
```

### 3. Install Services

```bash
sudo /opt/miniclaw-scripts/install-openclaw.sh
sudo /opt/miniclaw-scripts/install-nanobot.sh
```

### 4. Run Health Checks

```bash
/opt/miniclaw-scripts/health-check.sh -v
```

## Scripts Reference

### install-openclaw.sh
- **Purpose**: Install OpenClaw AI agent framework
- **Port**: 3000
- **User**: openclaw
- **Service**: openclaw.service

### install-nanobot.sh
- **Purpose**: Install Nanobot AI agent
- **Port**: 8000
- **User**: nanobot
- **Service**: nanobot.service

### health-check.sh
- **Purpose**: Check health of all services
- **Options**:
  - `-s <service>`: Check specific service (openclaw|nanobot|all)
  - `-v`: Verbose output
  - `-q`: Quiet mode
  - `--docker`: Check Docker containers
- **Exit codes**: 0=OK, 1=Warning, 2=Critical, 3=Unknown

### cloud-init.yaml
- **Purpose**: Base system configuration
- **Features**: Updates, Docker, Firewall, Fail2Ban

## Docker Images

### Build API Image
```bash
docker build -f infrastructure/docker/api.Dockerfile -t miniclaw-api:latest .
```

### Build Worker Image
```bash
docker build -f infrastructure/docker/worker.Dockerfile -t miniclaw-worker:latest .
```

## Service Ports

- OpenClaw: 3000
- Nanobot: 8000
- API: 8080
- Worker: 9090

## Useful Commands

### Service Management
```bash
# Check status
sudo systemctl status openclaw
sudo systemctl status nanobot

# Start/stop/restart
sudo systemctl start openclaw
sudo systemctl stop openclaw
sudo systemctl restart openclaw

# View logs
sudo journalctl -u openclaw -f
sudo journalctl -u nanobot -f
```

### Health Checks
```bash
# All services
/opt/miniclaw-scripts/health-check.sh

# Specific service
/opt/miniclaw-scripts/health-check.sh -s openclaw

# Verbose
/opt/miniclaw-scripts/health-check.sh -v

# With Docker
/opt/miniclaw-scripts/health-check.sh --docker
```

### Terraform Commands
```bash
# Plan changes
terraform plan

# Apply changes
terraform apply

# Destroy infrastructure
terraform destroy

# Show outputs
terraform output
```

## Troubleshooting

### Service Not Starting
```bash
# Check status
sudo systemctl status <service>

# View logs
sudo journalctl -u <service> -n 50

# Check ports
sudo netstat -tlnp | grep <port>
```

### Health Check Failures
```bash
# Manual check
curl http://localhost:<port>/health

# Check process
ps aux | grep <service>

# Check logs
tail -f /var/log/miniclaw/<service>.log
```

### Connection Issues
```bash
# Check firewall
sudo ufw status

# Check SSH
sudo systemctl status sshd

# Test connectivity
ping <droplet-ip>
```

## File Locations

- **Scripts**: `/opt/miniclaw-scripts/`
- **OpenClaw**: `/opt/openclaw/`
- **Nanobot**: `/opt/nanobot/`
- **Logs**: `/var/log/miniclaw/`
- **Config**: `/etc/miniclaw/`

## Environment Variables

### OpenClaw
- `OPENCLAW_PORT`: Port (default: 3000)
- `NODE_ENV`: Environment (production/development)

### Nanobot
- `NANOBOT_PORT`: Port (default: 8000)
- `PYTHON_VERSION`: Python version (default: 3.11)

## Support

- Full documentation: `/infrastructure/README.md`
- Terraform: `/infrastructure/terraform/base-image/README.md`
- Docker: `/infrastructure/docker/README.md`
