################################################################################
# Variables for Miniclaw Base Image Terraform Configuration
################################################################################

variable "do_token" {
  description = "DigitalOcean API token"
  type        = string
  sensitive   = true
}

variable "environment" {
  description = "Environment name (e.g., development, staging, production)"
  type        = string
  default     = "development"
}

variable "region" {
  description = "DigitalOcean region for the droplet"
  type        = string
  default     = "nyc1"

  validation {
    condition     = contains(["nyc1", "nyc2", "nyc3", "ams1", "ams2", "ams3", "sfo1", "sfo2", "sfo3", "lon1", "fra1", "tor1", "sgp1", "blr1"], var.region)
    error_message = "Region must be a valid DigitalOcean region slug."
  }
}

variable "droplet_name" {
  description = "Base name for the droplet"
  type        = string
  default     = "miniclaw-base"
}

variable "droplet_image" {
  description = "Droplet image slug (OS distribution)"
  type        = string
  default     = "ubuntu-22-04-x64"
}

variable "droplet_size" {
  description = "Droplet size slug"
  type        = string
  default     = "s-2vcpu-4gb"

  validation {
    condition     = can(regex("^s-[0-9]+vcpu-[0-9]+gb$", var.droplet_size))
    error_message = "Droplet size must be a valid DigitalOcean size slug."
  }
}

variable "monitoring" {
  description = "Enable DigitalOcean monitoring"
  type        = bool
  default     = true
}

variable "ipv6" {
  description = "Enable IPv6"
  type        = bool
  default     = true
}

variable "droplet_tags" {
  description = "Tags to apply to the droplet"
  type        = list(string)
  default     = ["miniclaw", "base-image", "infrastructure"]
}

variable "ssh_key_name" {
  description = "Name for the SSH key in DigitalOcean"
  type        = string
  default     = "miniclaw-deploy-key"
}

variable "ssh_public_key_path" {
  description = "Path to the public SSH key file"
  type        = string
  default     = "~/.ssh/id_rsa.pub"
}

variable "ssh_private_key_path" {
  description = "Path to the private SSH key file"
  type        = string
  default     = "~/.ssh/id_rsa"
}

variable "volume_ids" {
  description = "List of volume IDs to attach to the droplet"
  type        = list(string)
  default     = []
}

variable "resize_disk" {
  description = "Whether to resize the disk when upgrading the droplet"
  type        = bool
  default     = true
}

variable "graceful_shutdown" {
  description = "Enable graceful shutdown"
  type        = bool
  default     = true
}

variable "create_timeout" {
  description = "Timeout for droplet creation"
  type        = string
  default     = "10m"
}

variable "delete_timeout" {
  description = "Timeout for droplet deletion"
  type        = string
  default     = "5m"
}

variable "update_timeout" {
  description = "Timeout for droplet update"
  type        = string
  default     = "5m"
}

variable "snapshot_name" {
  description = "Base name for snapshots"
  type        = string
  default     = "miniclaw-base-snapshot"
}

variable "create_snapshot" {
  description = "Whether to create a snapshot of the droplet"
  type        = bool
  default     = false
}

variable "create_floating_ip" {
  description = "Whether to create a floating IP"
  type        = bool
  default     = false
}

variable "create_firewall" {
  description = "Whether to create a firewall"
  type        = bool
  default     = true
}

variable "firewall_name" {
  description = "Name for the firewall"
  type        = string
  default     = "miniclaw-firewall"
}

variable "firewall_ssh_sources" {
  description = "Allowed source addresses for SSH"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "firewall_app_sources" {
  description = "Allowed source addresses for application ports"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "project_id" {
  description = "DigitalOcean project ID for resource assignment"
  type        = string
  default     = ""
}

variable "create_dns_records" {
  description = "Whether to create DNS records"
  type        = bool
  default     = false
}

variable "domain_name" {
  description = "Domain name for DNS records"
  type        = string
  default     = ""
}

variable "dns_subdomain" {
  description = "Subdomain for the DNS record"
  type        = string
  default     = "base"
}

variable "dns_ttl" {
  description = "TTL for DNS records"
  type        = number
  default     = 300
}

variable "create_volume" {
  description = "Whether to create an additional volume"
  type        = bool
  default     = false
}

variable "volume_name" {
  description = "Name for the volume"
  type        = string
  default     = "miniclaw-volume"
}

variable "volume_size" {
  description = "Size of the volume in GB"
  type        = number
  default     = 100

  validation {
    condition     = var.volume_size >= 1 && var.volume_size <= 16384
    error_message = "Volume size must be between 1 and 16384 GB."
  }
}

variable "volume_filesystem" {
  description = "Filesystem type for the volume"
  type        = string
  default     = "ext4"

  validation {
    condition     = contains(["ext4", "xfs"], var.volume_filesystem)
    error_message = "Filesystem must be either 'ext4' or 'xfs'."
  }
}

################################################################################
# Application-specific Variables
################################################################################

variable "openclaw_port" {
  description = "Port for OpenClaw service"
  type        = number
  default     = 3000
}

variable "nanobot_port" {
  description = "Port for Nanobot service"
  type        = number
  default     = 8000
}

variable "api_port" {
  description = "Port for API service"
  type        = number
  default     = 8080
}

variable "worker_port" {
  description = "Port for Worker service"
  type        = number
  default     = 9090
}

variable "enable_auto_scaling" {
  description = "Enable auto-scaling configuration"
  type        = bool
  default     = false
}

variable "max_droplets" {
  description = "Maximum number of droplets for auto-scaling"
  type        = number
  default     = 10
}

variable "min_droplets" {
  description = "Minimum number of droplets for auto-scaling"
  type        = number
  default     = 1
}

################################################################################
# Cost Management Variables
################################################################################

variable "budget_alert_enabled" {
  description = "Enable budget alerts"
  type        = bool
  default     = false
}

variable "monthly_budget_limit" {
  description = "Monthly budget limit in USD"
  type        = number
  default     = 100
}

################################################################################
# Backup Variables
################################################################################

variable "enable_backups" {
  description = "Enable automatic backups"
  type        = bool
  default     = true
}

variable "backup_retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 30

  validation {
    condition     = var.backup_retention_days >= 1 && var.backup_retention_days <= 90
    error_message = "Backup retention must be between 1 and 90 days."
  }
}
