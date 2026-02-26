# Miniclaw Infrastructure Setup Checklist

Use this checklist to ensure all infrastructure components are properly configured and deployed.

## Pre-Deployment Checklist

### Prerequisites
- [ ] DigitalOcean account created
- [ ] API token generated (Read/Write scope)
- [ ] SSH key pair generated locally
- [ ] Terraform 1.0+ installed locally
- [ ] Docker and Docker Compose installed
- [ ] Domain name acquired (optional)
- [ ] Project ID noted (optional)

### Security Setup
- [ ] SSH public key available
- [ ] SSH private key secure (chmod 600)
- [ ] API token stored securely
- [ ] Firewall rules documented
- [ ] Backup strategy planned

### Configuration
- [ ] `terraform.tfvars` configured
- [ ] Region selected (consider latency)
- [ ] Droplet size selected (based on requirements)
- [ ] Environment set (development/staging/production)
- [ ] Tags documented

## Deployment Checklist

### Terraform Deployment
- [ ] Terraform initialized (`terraform init`)
- [ ] Configuration reviewed (`terraform plan`)
- [ ] Changes approved
- [ ] Infrastructure applied (`terraform apply`)
- [ ] Outputs noted (IP addresses, IDs)
- [ ] Droplet created successfully
- [ ] SSH key added
- [ ] Firewall configured
- [ ] Optional: Floating IP assigned
- [ ] Optional: Volume attached
- [ ] Optional: DNS records created

### Initial Server Setup
- [ ] SSH into server successful
- [ ] Cloud-init completed successfully
  ```bash
  cloud-init status
  ```
- [ ] System packages installed
- [ ] Docker installed and running
  ```bash
  sudo systemctl status docker
  ```
- [ ] Users created (openclaw, nanobot)
- [ ] Firewall (UFW) configured
  ```bash
  sudo ufw status
  ```
- [ ] Fail2Ban running
  ```bash
  sudo systemctl status fail2ban
  ```
- [ ] Swap configured
  ```bash
  free -h
  ```

## OpenClaw Installation Checklist

### Installation
- [ ] Script executed: `install-openclaw.sh`
- [ ] Prerequisites checked (Node.js, Python)
- [ ] OpenClaw installed successfully
- [ ] Virtual environment/configured
- [ ] Environment file created (`/opt/openclaw/.env`)
- [ ] Health check script created
- [ ] Systemd service created
- [ ] Service enabled and started

### Verification
- [ ] Service is running
  ```bash
  sudo systemctl status openclaw
  ```
- [ ] Process is active
  ```bash
  ps aux | grep openclaw
  ```
- [ ] Port is listening
  ```bash
  sudo netstat -tlnp | grep 3000
  ```
- [ ] Health endpoint responds
  ```bash
  curl http://localhost:3000/health
  ```
- [ ] Logs are being written
  ```bash
  tail -f /var/log/miniclaw/openclaw.log
  ```
- [ ] No errors in logs
  ```bash
  sudo journalctl -u openclaw -n 50
  ```

## Nanobot Installation Checklist

### Installation
- [ ] Script executed: `install-nanobot.sh`
- [ ] Prerequisites checked (Python 3)
- [ ] Virtual environment created
- [ ] Nanobot installed via pip
- [ ] Additional dependencies installed
- [ ] Environment file created (`/opt/nanobot/.env`)
- [ ] Health check script created
- [ ] Systemd service created
- [ ] Service enabled and started

### Verification
- [ ] Service is running
  ```bash
  sudo systemctl status nanobot
  ```
- [ ] Process is active
  ```bash
  ps aux | grep nanobot
  ```
- [ ] Port is listening
  ```bash
  sudo netstat -tlnp | grep 8000
  ```
- [ ] Health endpoint responds
  ```bash
  curl http://localhost:8000/health
  ```
- [ ] Logs are being written
  ```bash
  tail -f /var/log/miniclaw/nanobot.log
  ```
- [ ] No errors in logs
  ```bash
  sudo journalctl -u nanobot -n 50
  ```

## Docker Setup Checklist

### API Image
- [ ] Dockerfile reviewed
- [ ] Image built successfully
  ```bash
  docker build -f infrastructure/docker/api.Dockerfile -t miniclaw-api:latest .
  ```
- [ ] Image size is reasonable (< 500MB)
  ```bash
  docker images miniclaw-api
  ```
- [ ] Container runs locally
  ```bash
  docker run -p 8080:8080 miniclaw-api:latest
  ```
- [ ] Health check works
  ```bash
  curl http://localhost:8080/health
  ```

### Worker Image
- [ ] Dockerfile reviewed
- [ ] Image built successfully
  ```bash
  docker build -f infrastructure/docker/worker.Dockerfile -t miniclaw-worker:latest .
  ```
- [ ] Image size is reasonable (< 500MB)
  ```bash
  docker images miniclaw-worker
  ```
- [ ] Container runs locally
  ```bash
  docker run -p 9090:9090 miniclaw-worker:latest
  ```
- [ ] Health check works
  ```bash
  curl http://localhost:9090/health
  ```

## Health Check Verification

### Basic Checks
- [ ] Health check script executed
  ```bash
  /opt/miniclaw-scripts/health-check.sh
  ```
- [ ] All services reported healthy
- [ ] Exit code was 0
- [ ] System resources normal
- [ ] No warnings or errors

### Detailed Checks
- [ ] OpenClaw health check passes
  ```bash
  /opt/miniclaw-scripts/health-check.sh -s openclaw
  ```
- [ ] Nanobot health check passes
  ```bash
  /opt/miniclaw-scripts/health-check.sh -s nanobot
  ```
- [ ] Verbose output reviewed
  ```bash
  /opt/miniclaw-scripts/health-check.sh -v
  ```
- [ ] Docker containers checked
  ```bash
  /opt/miniclaw-scripts/health-check.sh --docker
  ```

## Security Verification Checklist

### Firewall
- [ ] UFW is enabled
  ```bash
  sudo ufw status verbose
  ```
- [ ] Only necessary ports open
- [ ] SSH restricted (if needed)
- [ ] Application ports accessible
- [ ] Logging enabled

### SSH
- [ ] Password authentication disabled
- [ ] Root login disabled
- [ ] Key-based authentication working
- [ ] Fail2Ban configured
  ```bash
  sudo fail2ban-client status sshd
  ```

### System Hardening
- [ ] System updated
  ```bash
  sudo apt list --upgradable
  ```
- [ ] Unnecessary services disabled
- [ ] Log rotation configured
- [ ] Backup strategy in place

## Monitoring Setup Checklist

### Basic Monitoring
- [ ] DigitalOcean monitoring enabled
- [ ] CPU alerts configured
- [ ] Memory alerts configured
- [ ] Disk alerts configured
- [ ] Uptime monitoring configured

### Application Monitoring
- [ ] Health check endpoint monitoring
- [ ] Application error tracking
- [ ] Performance metrics collected
- [ ] Log aggregation configured

## Backup Checklist

### Automated Backups
- [ ] DigitalOcean backups enabled
- [ ] Backup retention period set
- [ ] Backup schedule confirmed
- [ ] Backup restoration tested

### Manual Backups
- [ ] Snapshot procedure documented
- [ ] Database backup script created
- [ ] Config backup script created
- [ ] Off-site backup configured

## Documentation Checklist

### Infrastructure Documentation
- [ ] Architecture diagram created
- [ ] Network topology documented
- [ ] Port usage documented
- [ ] Service dependencies documented
- [ ] Runbooks created

### Operational Documentation
- [ ] Deployment guide completed
- [ ] Troubleshooting guide created
- [ ] On-call procedures documented
- [ ] Emergency contacts listed
- [ ] Escalation path defined

## Post-Deployment Verification

### Functionality Tests
- [ ] OpenClaw responds to requests
- [ ] Nanobot processes tasks
- [ ] API endpoints work
- [ ] Worker processes jobs
- [ ] Database connectivity
- [ ] Redis connectivity

### Performance Tests
- [ ] Load testing completed
- [ ] Response times acceptable
- [ ] Resource usage normal
- [ ] No memory leaks
- [ ] No database locks

### Failover Tests
- [ ] Service restart tested
- [ ] Server reboot tested
- [ ] Backup restoration tested
- [ ] Recovery procedures validated

## Ongoing Operations

### Regular Maintenance
- [ ] Update schedule defined
- [ ] Backup schedule confirmed
- [ ] Monitoring dashboards created
- [ ] Alerting configured
- [ ] Log rotation verified

### Cost Management
- [ ] Budget alerts set
- [ ] Resource usage monitored
- [ ] Cost optimization reviewed
- [ ] Unused resources identified

## Sign-Off

### Deployment Approval
- [ ] Technical lead approval
- [ ] Security review completed
- [ ] Documentation review
- [ ] Stakeholder notification
- [ ] Go/no-go decision

### Post-Deployment Review
- [ ] Deployment successful
- [ ] All services running
- [ ] Monitoring active
- [ ] Documentation updated
- [ ] Lessons learned documented

## Emergency Contacts

| Role | Name | Contact |
|------|------|---------|
| Infrastructure Lead | | |
| DevOps Engineer | | |
| Security Lead | | |
| On-Call Engineer | | |

## Notes

Add any additional notes or observations from the deployment process:

---

**Last Updated**: 2024-01-01
**Version**: 1.0
