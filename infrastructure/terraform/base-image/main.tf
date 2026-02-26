################################################################################
# Terraform Configuration for Miniclaw Base Image
# This configuration creates a DigitalOcean droplet for building base images
################################################################################

terraform {
  required_version = ">= 1.0"

  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
  }

  backend "local" {
    path = "terraform.tfstate"
  }
}

################################################################################
# Provider Configuration
################################################################################

provider "digitalocean" {
  token = var.do_token
}

################################################################################
# SSH Key Resource
################################################################################

resource "digitalocean_ssh_key" "miniclaw_key" {
  name       = var.ssh_key_name
  public_key = file(var.ssh_public_key_path)
}

################################################################################
# Base Image Droplet
################################################################################

resource "digitalocean_droplet" "base_image" {
  image      = var.droplet_image
  name       = "${var.droplet_name}-${var.environment}"
  region     = var.region
  size       = var.droplet_size
  monitoring = var.monitoring
  ipv6       = var.ipv6

  # SSH key for authentication
  ssh_keys = [digitalocean_ssh_key.miniclaw_key.fingerprint]

  # Cloud-init configuration
  user_data = file("${path.module}/cloud-init.yaml")

  # Tags
  tags = var.droplet_tags

  # Volume attachments (optional)
  volume_ids = var.volume_ids

  # Resize disk
  resize_disk = var.resize_disk

  # Graceful shutdown
  graceful_shutdown = var.graceful_shutdown

  # Timeouts
  timeouts {
    create = var.create_timeout
    delete = var.delete_timeout
    update = var.update_timeout
  }

  # Lifecycle
  lifecycle {
    create_before_destroy = false
    prevent_destroy       = false
    ignore_changes        = []
  }

  # Provisioners
  provisioner "file" {
    connection {
      type        = "ssh"
      user        = "root"
      host        = self.ipv4_address
      private_key = file(var.ssh_private_key_path)
      timeout     = "5m"
    }

    source      = "${path.root}/../scripts/"
    destination = "/tmp/scripts"
  }

  provisioner "remote-exec" {
    connection {
      type        = "ssh"
      user        = "root"
      host        = self.ipv4_address
      private_key = file(var.ssh_private_key_path)
      timeout     = "5m"
    }

    inline = [
      "chmod +x /tmp/scripts/*.sh",
      "mv /tmp/scripts /opt/miniclaw-scripts",
    ]
  }
}

################################################################################
# Snapshot for Base Image
################################################################################

resource "digitalocean_snapshot" "base_snapshot" {
  name        = "${var.snapshot_name}-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"
  droplet_id  = digitalocean_droplet.base_image.id
  region      = var.region

  # Create snapshot only when explicitly enabled
  count       = var.create_snapshot ? 1 : 0

  lifecycle {
    create_before_destroy = true
  }
}

################################################################################
# Floating IP (Optional)
################################################################################

resource "digitalocean_floating_ip" "base_floating_ip" {
  count     = var.create_floating_ip ? 1 : 0
  region    = var.region
  droplet_id = digitalocean_droplet.base_image.id
}

################################################################################
# Firewall (Optional)
################################################################################

resource "digitalocean_firewall" "base_firewall" {
  count = var.create_firewall ? 1 : 0
  name  = "${var.firewall_name}-${var.environment}"

  droplet_ids = [digitalocean_droplet.base_image.id]

  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = var.firewall_ssh_sources
  }

  inbound_rule {
    protocol         = "tcp"
    port_range       = "80"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  inbound_rule {
    protocol         = "tcp"
    port_range       = "443"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  inbound_rule {
    protocol         = "tcp"
    port_range       = "3000"
    source_addresses = var.firewall_app_sources
  }

  inbound_rule {
    protocol         = "tcp"
    port_range       = "8000"
    source_addresses = var.firewall_app_sources
  }

  inbound_rule {
    protocol         = "tcp"
    port_range       = "8080"
    source_addresses = var.firewall_app_sources
  }

  inbound_rule {
    protocol         = "tcp"
    port_range       = "9090"
    source_addresses = var.firewall_app_sources
  }

  outbound_rule {
    protocol              = "tcp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "udp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "icmp"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  tags = var.droplet_tags
}

################################################################################
# Project Assignment (Optional)
################################################################################

resource "digitalocean_project_resources" "base_project" {
  count = var.project_id != "" ? 1 : 0
  project = var.project_id
  resources = [
    digitalocean_droplet.base_image.urn
  ]
}

################################################################################
# DNS Records (Optional)
################################################################################

resource "digitalocean_record" "base_dns" {
  count = var.create_dns_records && var.domain_name != "" ? 1 : 0

  domain = var.domain_name
  type   = "A"
  name   = var.dns_subdomain
  value  = digitalocean_droplet.base_image.ipv4_address
  ttl    = var.dns_ttl
}

################################################################################
# Volumes (Optional)
################################################################################

resource "digitalocean_volume" "base_volume" {
  count      = var.create_volume ? 1 : 0
  region     = var.region
  name       = "${var.volume_name}-${var.environment}"
  size       = var.volume_size
  filesystem = var.volume_filesystem
  description = "Additional storage for ${var.droplet_name}"
}

resource "digitalocean_volume_attachment" "base_volume_attachment" {
  count      = var.create_volume ? 1 : 0
  droplet_id = digitalocean_droplet.base_image.id
  volume_id  = digitalocean_volume.base_volume[0].id
}

################################################################################
# Load Data Sources
################################################################################

data "digitalocean_image" "base_image" {
  slug = var.droplet_image
}

data "digitalocean_regions" "available" {
  available = true
}

data "digitalocean_sizes" "available" {
  available = true
}
