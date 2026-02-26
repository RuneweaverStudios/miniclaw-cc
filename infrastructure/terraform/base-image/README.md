# Miniclaw Base Image - Terraform Configuration

This Terraform configuration creates a DigitalOcean droplet with a base image for Miniclaw infrastructure, including OpenClaw and Nanobot setup.

## Prerequisites

1. **DigitalOcean Account**: Sign up at https://cloud.digitalocean.com/
2. **API Token**: Generate a personal access token at https://cloud.digitalocean.com/account/api/tokens
3. **SSH Key Pair**: Generate SSH keys for authentication
4. **Terraform**: Install Terraform 1.0 or later
5. **doctl** (optional): Install DigitalOcean CLI tool

## Quick Start

### 1. Install Terraform

```bash
# macOS
brew install terraform

# Linux
wget https://releases.hashicorp.com/terraform/<version>/terraform_<version>_linux_amd64.zip
unzip terraform_<version>_linux_amd64.zip
sudo mv terraform /usr/local/bin/
```

### 2. Configure Variables

Copy the example variables file and add your values:

```bash
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your configuration:

```hcl
do_token = "your-digitalocean-api-token-here"
environment = "development"
region = "nyc1"
```

### 3. Initialize Terraform

```bash
terraform init
```

### 4. Plan the Deployment

```bash
terraform plan
```

### 5. Apply the Configuration

```bash
terraform apply
```

Type `yes` when prompted to confirm the deployment.

## Configuration

### Required Variables

- `do_token`: DigitalOcean API token
- `ssh_public_key_path`: Path to your public SSH key
- `ssh_private_key_path`: Path to your private SSH key

### Optional Variables

See `variables.tf` for all available configuration options.

Commonly used variables:

```hcl
# Environment
environment = "development"  # or "staging", "production"

# Droplet size
droplet_size = "s-2vcpu-4gb"  # See DigitalOcean for available sizes

# Region
region = "nyc1"  # Choose your nearest region

# Enable monitoring
monitoring = true

# Enable automatic backups
enable_backups = true

# Create firewall
create_firewall = true
```

## Outputs

After successful deployment, Terraform will output:

- Droplet ID and IP addresses
- SSH connection string
- Service URLs (OpenClaw, Nanobot, API, Worker)
- Health check URLs
- Deployment instructions

Example:

```
droplet_ipv4_address = "123.45.67.89"
ssh_connection_string = "ssh root@123.45.67.89"
openclaw_url = "http://123.45.67.89:3000"
```

## Post-Deployment

### 1. SSH into the Droplet

```bash
ssh root@<droplet-ip>
```

Or use the output connection string:

```bash
terraform output ssh_connection_string
```

### 2. Verify Cloud-Init

Check if cloud-init completed successfully:

```bash
cloud-init status
```

View cloud-init logs:

```bash
cat /var/log/cloud-init-output.log
```

### 3. Install OpenClaw

```bash
sudo /opt/miniclaw-scripts/install-openclaw.sh
```

### 4. Install Nanobot

```bash
sudo /opt/miniclaw-scripts/install-nanobot.sh
```

### 5. Verify Installation

Run health checks:

```bash
/opt/miniclaw-scripts/health-check.sh
```

Check service status:

```bash
sudo systemctl status openclaw
sudo systemctl status nanobot
```

View logs:

```bash
sudo journalctl -u openclaw -f
sudo journalctl -u nanobot -f
```

## Management Commands

### Check Droplet Status

```bash
terraform output
```

### SSH into Droplet

```bash
ssh -i ~/.ssh/id_rsa root@$(terraform output droplet_ipv4_address)
```

### Rebuild Droplet

```bash
terraform taint digitalocean_droplet.base_image
terraform apply
```

### Destroy Infrastructure

```bash
terraform destroy
```

## Updating Infrastructure

### Modify Configuration

1. Edit `terraform.tfvars` or `main.tf`
2. Run `terraform plan` to see changes
3. Run `terraform apply` to apply changes

### Create Snapshot

To create a snapshot of the base image:

```bash
terraform apply -var="create_snapshot=true"
```

## Troubleshooting

### Cloud-Init Issues

Check cloud-init logs:

```bash
ssh root@<droplet-ip> "tail -f /var/log/cloud-init-output.log"
```

### Service Not Starting

Check service status and logs:

```bash
sudo systemctl status openclaw
sudo journalctl -u openclaw -n 50
```

### Connection Issues

Verify firewall rules:

```bash
sudo ufw status
```

### Resource Issues

Check system resources:

```bash
/opt/miniclaw-scripts/health-check.sh -v
```

## Security Best Practices

1. **Use SSH Keys**: Never use password authentication
2. **Configure Firewall**: Limit access to specific IPs
3. **Enable Backups**: Protect against data loss
4. **Monitor Resources**: Set up monitoring and alerts
5. **Update Regularly**: Keep system packages updated
6. **Use Secrets Management**: Never commit sensitive data

## Cost Management

Estimated monthly costs (varies by region):

- Droplet (s-2vcpu-4gb): $40/month
- Monitoring: $5/month
- Backups: $4/month
- Floating IP (optional): $5/month
- Volume storage (optional): $0.10/GB/month

See `estimated_monthly_cost` output for current configuration.

## Backup and Recovery

### Automated Backups

Enable in `terraform.tfvars`:

```hcl
enable_backups = true
backup_retention_days = 30
```

### Manual Snapshot

```bash
doctl compute droplet snapshot <droplet-id> --snapshot-name "manual-backup-$(date +%Y%m%d)"
```

### Restore from Snapshot

1. Create new droplet from snapshot
2. Update Terraform configuration
3. Apply changes

## Scaling

### Horizontal Scaling

Create multiple droplets using `count`:

```hcl
resource "digitalocean_droplet" "base_image" {
  count = 3
  # ... other configuration
}
```

### Vertical Scaling

Upgrade droplet size:

```hcl
droplet_size = "s-4vcpu-8gb"  # Upgrade to larger size
```

## Support

- DigitalOcean Documentation: https://docs.digitalocean.com/
- Terraform Provider: https://registry.terraform.io/providers/digitalocean/digitalocean/latest/docs
- Miniclaw Documentation: See project README

## License

See project LICENSE file.
