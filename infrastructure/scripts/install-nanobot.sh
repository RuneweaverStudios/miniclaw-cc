#!/bin/bash
# install-nanobot.sh - Automated Nanobot installation for MiniClaw-CC
# Usage: sudo bash install-nanobot.sh
#
# This script installs Nanobot on a fresh Ubuntu droplet
# Version: 1.0.0
# Docs: https://github.com/HKUDS/nanobot

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[Nanobot]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[Nanobot]${NC} $1"
}

log_error() {
    echo -e "${RED}[Nanobot]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    log_error "Please run as root (sudo)"
    exit 1
fi

log_info "Starting Nanobot installation..."

# Step 1: Install system dependencies
log_info "Installing system dependencies..."
apt-get update
apt-get install -y \
    python3.11 \
    python3.11-venv \
    python3-pip \
    python3-dev \
    build-essential \
    curl \
    git

# Step 2: Install Nanobot from PyPI
# IMPORTANT: Use PyPI version (0.1.3.post4) to avoid oauth-cli-kit dependency
# The oauth-cli-kit package is only needed for OpenAI Codex OAuth (optional feature)
log_info "Installing Nanobot from PyPI..."
pip3 install nanobot-ai==0.1.3.post4 --break-system-packages

# Verify installation
if ! command -v nanobot &> /dev/null; then
    log_error "Nanobot installation failed"
    exit 1
fi

log_info "Nanobot installed successfully"

# Step 3: Create nanobot user for security
log_info "Creating nanobot user..."
if ! id nanobot &>/dev/null; then
    useradd -m -s /bin/bash nanobot
    log_info "Created nanobot user"
else
    log_info "Nanobot user already exists"
fi

# Step 4: Initialize config
log_info "Initializing Nanobot configuration..."
sudo -u nanobot nanobot onboard

# Step 5: Create systemd service
log_info "Creating systemd service..."
cat > /etc/systemd/system/nanobot-gateway.service << 'EOF'
[Unit]
Description=Nanobot Gateway
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=nanobot
Group=nanobot
WorkingDirectory=/home/nanobot
ExecStart=/usr/local/bin/nanobot gateway
Restart=always
RestartSec=10
Environment="PATH=/usr/local/bin:/usr/bin:/bin"

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/home/nanobot/.nanobot
ReadWritePaths=/tmp

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=nanobot-gateway

[Install]
WantedBy=multi-user.target
EOF

# Step 6: Enable service (but don't start yet - needs config)
log_info "Enabling systemd service..."
systemctl daemon-reload
systemctl enable nanobot-gateway

# Step 7: Set up log directory
log_info "Setting up log directory..."
mkdir -p /var/log/nanobot
chown nanobot:nanobot /var/log/nanobot

# Step 8: Create health check script
log_info "Creating health check script..."
cat > /usr/local/bin/nanobot-healthcheck.sh << 'EOF'
#!/bin/bash
# Health check script for Nanobot

# Check if process is running
if ! pgrep -f "nanobot gateway" > /dev/null; then
    echo "ERROR: Nanobot gateway is not running"
    exit 1
fi

# Check if config exists
if [ ! -f /home/nanobot/.nanobot/config.json ]; then
    echo "ERROR: Config file not found"
    exit 1
fi

# Check if systemd service is active
if ! systemctl is-active --quiet nanobot-gateway; then
    echo "ERROR: Nanobot gateway service is not active"
    exit 1
fi

echo "OK: Nanobot gateway is healthy"
exit 0
EOF

chmod +x /usr/local/bin/nanobot-healthcheck.sh

# Step 9: Display version and status
log_info "Installation complete!"
echo ""
echo "===================="
nanobot --version
echo "===================="
echo ""
log_info "Nanobot installed successfully"
echo ""
echo "Next steps:"
echo "  1. Configure /home/nanobot/.nanobot/config.json:"
echo "     - Add provider API key (providers.openrouter.apiKey)"
echo "     - Set model (agents.defaults.model)"
echo "     - Add Telegram bot token (channels.telegram.token)"
echo ""
echo "  2. Start the gateway:"
echo "     systemctl start nanobot-gateway"
echo ""
echo "  3. Check status:"
echo "     systemctl status nanobot-gateway"
echo "     journalctl -u nanobot-gateway -f"
echo ""
echo "  4. Health check:"
echo "     /usr/local/bin/nanobot-healthcheck.sh"
echo ""

# Don't start gateway yet - it needs configuration
log_warn "Gateway NOT started - requires configuration"
log_info "Run 'systemctl start nanobot-gateway' after configuring"

exit 0
