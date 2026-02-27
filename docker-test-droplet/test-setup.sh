#!/bin/bash

# Test Setup Script for MiniClaw-CC
# This script starts Docker containers and updates the database with test droplet IPs

set -e

echo "🐳 Starting test droplets with Docker..."

# Start containers
cd /Users/ghost-m4/Desktop/miniclaw-cc/docker-test-droplet
docker-compose up -d

# Wait for containers to be ready
echo "⏳ Waiting for containers to start..."
sleep 5

# Get container IPs
NANOBOT_IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' miniclaw-nanobot-test)
OPENCLAW_IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' miniclaw-openclaw-test)

echo "✅ Containers started!"
echo "   Nanobot: $NANOBOT_IP (SSH: localhost:2221)"
echo "   OpenClaw: $OPENCLAW_IP (SSH: localhost:2222)"

# Test SSH connection
echo ""
echo "🔑 Testing SSH connection..."

if sshpass -p 'testpass123' ssh -o StrictHostKeyChecking=no -p 2221 root@localhost "echo 'Nanobot SSH OK'" 2>/dev/null; then
    echo "   ✅ Nanobot SSH is accessible"
else
    echo "   ⚠️  Nanobot SSH needs manual setup (install sshpass: brew install sshpass)"
fi

if sshpass -p 'testpass123' ssh -o StrictHostKeyChecking=no -p 2222 root@localhost "echo 'OpenClaw SSH OK'" 2>/dev/null; then
    echo "   ✅ OpenClaw SSH is accessible"
else
    echo "   ⚠️  OpenClaw SSH needs manual setup (install sshpass: brew install sshpass)"
fi

echo ""
echo "📊 Database update needed:"
echo "   Run this SQL to update pool_servers with real IPs:"
echo ""
echo "   UPDATE pool_servers SET ip_address = '$NANOBOT_IP' WHERE droplet_id = 1000000 AND stack = 'nanobot';"
echo "   UPDATE pool_servers SET ip_address = '$OPENCLAW_IP' WHERE droplet_id = 1000001 AND stack = 'openclaw';"
echo ""
echo "🔑 SSH_PRIVATE_KEY for .env:"
echo "   SSH_PRIVATE_KEY=\"$(cat ~/.ssh/id_rsa 2>/dev/null || echo '<generate with: ssh-keygen -t rsa -b 4096>')\""
echo ""
echo "🎯 Quick test commands:"
echo "   ssh -p 2221 root@localhost  # Connect to Nanobot droplet"
echo "   ssh -p 2222 root@localhost  # Connect to OpenClaw droplet"
