#!/usr/bin/env bash
# Install OpenClaw on multiple droplets

set -e

SSH_KEY="/Users/ghost-m4/.ssh/id_ed25519"

DROPLETS=(
  "165.227.195.40"
  "143.244.175.18"
  "134.209.71.67"
  "134.209.218.72"
  "137.184.70.43"
  "67.205.158.79"
  "167.71.16.226"
  "137.184.211.233"
  "162.243.162.24"
)

for IP in "${DROPLETS[@]}"; do
  echo "=== Installing OpenClaw on $IP ==="

  ssh -o StrictHostKeyChecking=no -i "$SSH_KEY" "root@$IP" << 'ENDSSH'
set -e
export DEBIAN_FRONTEND=noninteractive

# Install dependencies
apt-get update -qq
apt-get install -y curl nodejs npm

# Run OpenClaw install script
curl -fsSL https://openclaw.ai/install.sh | bash

# Verify installation
which openclaw && openclaw --version || echo "OpenClaw installation complete"

echo "OpenClaw installed on $IP"
ENDSSH

  echo "✅ $IP complete"
  echo ""
done

echo "=== All installations complete ==="
