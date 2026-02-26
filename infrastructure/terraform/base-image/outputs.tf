################################################################################
# Outputs for Miniclaw Base Image Terraform Configuration
################################################################################

################################################################################
# Droplet Outputs
################################################################################

output "droplet_id" {
  description = "ID of the created droplet"
  value       = digitalocean_droplet.base_image.id
}

output "droplet_name" {
  description = "Name of the created droplet"
  value       = digitalocean_droplet.base_image.name
}

output "droplet_ipv4_address" {
  description = "Public IPv4 address of the droplet"
  value       = digitalocean_droplet.base_image.ipv4_address
}

output "droplet_ipv6_address" {
  description = "Public IPv6 address of the droplet (if enabled)"
  value       = digitalocean_droplet.base_image.ipv6_address
}

output "droplet_urn" {
  description = "URN of the droplet"
  value       = digitalocean_droplet.base_image.urn
}

output "droplet_status" {
  description = "Status of the droplet"
  value       = digitalocean_droplet.base_image.status
}

output "droplet_created_at" {
  description = "Creation timestamp of the droplet"
  value       = digitalocean_droplet.base_image.created_at
}

output "droplet_region" {
  description = "Region where the droplet is deployed"
  value       = digitalocean_droplet.base_image.region
}

output "droplet_size" {
  description = "Size of the droplet"
  value       = digitalocean_droplet.base_image.size
}

output "droplet_image" {
  description = "Image used for the droplet"
  value       = digitalocean_droplet.base_image.image
}

output "droplet_features" {
  description = "Features enabled on the droplet"
  value       = digitalocean_droplet.base_image.features
}

################################################################################
# SSH Key Outputs
################################################################################

output "ssh_key_id" {
  description = "ID of the SSH key"
  value       = digitalocean_ssh_key.miniclaw_key.id
}

output "ssh_key_name" {
  description = "Name of the SSH key"
  value       = digitalocean_ssh_key.miniclaw_key.name
}

output "ssh_key_fingerprint" {
  description = "Fingerprint of the SSH key"
  value       = digitalocean_ssh_key.miniclaw_key.fingerprint
}

################################################################################
# Snapshot Outputs
################################################################################

output "snapshot_id" {
  description = "ID of the created snapshot (if any)"
  value       = var.create_snapshot ? digitalocean_snapshot.base_snapshot[0].id : null
}

output "snapshot_name" {
  description = "Name of the snapshot (if any)"
  value       = var.create_snapshot ? digitalocean_snapshot.base_snapshot[0].name : null
}

output "snapshot_created_at" {
  description = "Creation time of the snapshot (if any)"
  value       = var.create_snapshot ? digitalocean_snapshot.base_snapshot[0].created_at : null
}

output "snapshot_size_gigabytes" {
  description = "Size of the snapshot in GB (if any)"
  value       = var.create_snapshot ? digitalocean_snapshot.base_snapshot[0].size_gigabytes : null
}

################################################################################
# Floating IP Outputs
################################################################################

output "floating_ip" {
  description = "Floating IP address (if created)"
  value       = var.create_floating_ip ? digitalocean_floating_ip.base_floating_ip[0].ip_address : null
}

output "floating_ip_urn" {
  description = "URN of the floating IP (if created)"
  value       = var.create_floating_ip ? digitalocean_floating_ip.base_floating_ip[0].urn : null
}

################################################################################
# Firewall Outputs
################################################################################

output "firewall_id" {
  description = "ID of the firewall (if created)"
  value       = var.create_firewall ? digitalocean_firewall.base_firewall[0].id : null
}

output "firewall_name" {
  description = "Name of the firewall (if created)"
  value       = var.create_firewall ? digitalocean_firewall.base_firewall[0].name : null
}

output "firewall_status" {
  description = "Status of the firewall (if created)"
  value       = var.create_firewall ? digitalocean_firewall.base_firewall[0].status : null
}

output "firewall_created_at" {
  description = "Creation time of the firewall (if created)"
  value       = var.create_firewall ? digitalocean_firewall.base_firewall[0].created_at : null
}

################################################################################
# Volume Outputs
################################################################################

output "volume_id" {
  description = "ID of the volume (if created)"
  value       = var.create_volume ? digitalocean_volume.base_volume[0].id : null
}

output "volume_name" {
  description = "Name of the volume (if created)"
  value       = var.create_volume ? digitalocean_volume.base_volume[0].name : null
}

output "volume_size_gigabytes" {
  description = "Size of the volume in GB (if created)"
  value       = var.create_volume ? digitalocean_volume.base_volume[0].size_gigabytes : null
}

################################################################################
# DNS Outputs
################################################################################

output "dns_record_id" {
  description = "ID of the DNS record (if created)"
  value       = var.create_dns_records && var.domain_name != "" ? digitalocean_record.base_dns[0].id : null
}

output "dns_record_fqdn" {
  description = "Fully qualified domain name (if created)"
  value       = var.create_dns_records && var.domain_name != "" ? digitalocean_record.base_dns[0].fqdn : null
}

################################################################################
# Connection Information Outputs
################################################################################

output "ssh_connection_string" {
  description = "SSH connection string"
  value       = "ssh root@${digitalocean_droplet.base_image.ipv4_address}"
}

output "connection_info" {
  description = "Connection information for the droplet"
  value = {
    host     = digitalocean_droplet.base_image.ipv4_address
    username = "root"
    port     = 22
    key_path = var.ssh_private_key_path
  }
}

################################################################################
# Application URLs Outputs
################################################################################

output "openclaw_url" {
  description = "URL for OpenClaw service"
  value       = "http://${digitalocean_droplet.base_image.ipv4_address}:${var.openclaw_port}"
}

output "nanobot_url" {
  description = "URL for Nanobot service"
  value       = "http://${digitalocean_droplet.base_image.ipv4_address}:${var.nanobot_port}"
}

output "api_url" {
  description = "URL for API service"
  value       = "http://${digitalocean_droplet.base_image.ipv4_address}:${var.api_port}"
}

output "worker_url" {
  description = "URL for Worker service"
  value       = "http://${digitalocean_droplet.base_image.ipv4_address}:${var.worker_port}"
}

################################################################################
# Health Check URLs
################################################################################

output "openclaw_health_url" {
  description = "Health check URL for OpenClaw service"
  value       = "http://${digitalocean_droplet.base_image.ipv4_address}:${var.openclaw_port}/health"
}

output "nanobot_health_url" {
  description = "Health check URL for Nanobot service"
  value       = "http://${digitalocean_droplet.base_image.ipv4_address}:${var.nanobot_port}/health"
}

################################################################################
# Cost Information Outputs
################################################################################

output "estimated_monthly_cost" {
  description = "Estimated monthly cost in USD"
  value = {
    droplet    = 40  # Based on s-2vcpu-4gb size
    monitoring = var.monitoring ? 5 : 0
    backup     = var.enable_backups ? 4 : 0
    floating_ip = var.create_floating_ip ? 5 : 0
    volume     = var.create_volume ? var.volume_size * 0.10 : 0
    total = (
      40 +
      (var.monitoring ? 5 : 0) +
      (var.enable_backups ? 4 : 0) +
      (var.create_floating_ip ? 5 : 0) +
      (var.create_volume ? var.volume_size * 0.10 : 0)
    )
  }
}

################################################################################
# Terraform Cloud/Enterprise Outputs
################################################################################

output "terraform_workspace" {
  description = "Terraform workspace name"
  value       = terraform.workspace
}

################################################################################
# Additional Useful Outputs
################################################################################

output "deployment_instructions" {
  description = "Instructions for deploying to the droplet"
  value = <<-EOT
    # SSH into the droplet
    ${var.ssh_private_key_path != "" ? "ssh -i ${var.ssh_private_key_path}" : "ssh"} root@${digitalocean_droplet.base_image.ipv4_address}

    # Install OpenClaw
    sudo /opt/miniclaw-scripts/install-openclaw.sh

    # Install Nanobot
    sudo /opt/miniclaw-scripts/install-nanobot.sh

    # Check service status
    sudo systemctl status openclaw
    sudo systemctl status nanobot

    # Run health checks
    /opt/miniclaw-scripts/health-check.sh

    # View logs
    sudo journalctl -u openclaw -f
    sudo journalctl -u nanobot -f
  EOT
}

output "useful_commands" {
  description = "Useful commands for managing the droplet"
  value = {
    ssh_connect      = "ssh root@${digitalocean_droplet.base_image.ipv4_address}"
    reboot_droplet   = "doctl compute droplet reboot ${digitalocean_droplet.base_image.id}"
    poweroff_droplet = "doctl compute droplet power-off ${digitalocean_droplet.base_image.id}"
    delete_droplet   = "doctl compute droplet delete ${digitalocean_droplet.base_image.id}"
    view_console     = "doctl compute droplet console ${digitalocean_droplet.base_image.id}"
  }
}

output "next_steps" {
  description = "Suggested next steps"
  value = [
    "1. SSH into the droplet and verify cloud-init completed successfully",
    "2. Run the installation scripts for OpenClaw and Nanobot",
    "3. Configure your applications and services",
    "4. Set up monitoring and alerting",
    "5. Configure DNS records (if applicable)",
    "6. Set up CI/CD pipelines",
    "7. Configure backup strategy",
    "8. Document your infrastructure"
  ]
}
