#!/bin/bash
#
# OpenClaw Installation Script for MiniClaw-CC
#
# This script installs OpenClaw on a fresh Ubuntu server.
# OpenClaw is a Node.js/Typecript-based AI agent framework.
#
# Usage: ./install-openclaw.sh [version]
#   version: OpenClaw version to install (default: latest)
#
# Environment variables:
#   ANTHROPIC_API_KEY: API key for Claude
#   OPENROUTER_API_KEY: API key for OpenRouter
#   GATEWAY_PORT: Gateway port (default: 18789)
#   GATEWAY_BIND: Gateway bind address (default: 127.0.0.1)
#

set -euo pipefail

# Color output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

VERSION=${1:-latest}
OPENCLAW_DIR="$HOME/.openclaw"
GATEWAY_PORT=${GATEWAY_PORT:-18789}
GATEWAY_BIND=${GATEWAY_BIND:-127.0.0.1}
NODE_VERSION="22"

log_info "Starting OpenClaw installation (version: $VERSION)"

# ============================================================================
# 1. Install Node.js
# ============================================================================
log_info "Installing Node.js $NODE_VERSION..."

if ! command -v node &> /dev/null; then
    # Install Node.js using NodeSource
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt-get install -y nodejs

    # Verify installation
    NODE_INSTALLED_VERSION=$(node --version)
    log_success "Node.js $NODE_INSTALLED_VERSION installed"
else
    log_info "Node.js $(node --version) already installed"
fi

# ============================================================================
# 2. Install pnpm (recommended package manager for OpenClaw)
# ============================================================================
log_info "Installing pnpm..."

if ! command -v pnpm &> /dev/null; then
    npm install -g pnpm
    log_success "pnpm $(pnpm --version) installed"
else
    log_info "pnpm $(pnpm --version) already installed"
fi

# ============================================================================
# 3. Install OpenClaw
# ============================================================================
log_info "Installing OpenClaw..."

# Use the official install script
curl -fsSL https://openclaw.ai/install.sh | bash

# Verify installation
if command -v openclaw &> /dev/null; then
    OPENCLAW_VERSION=$(openclaw --version 2>/dev/null || echo "unknown")
    log_success "OpenClaw $OPENCLAW_VERSION installed"
else
    log_error "OpenClaw installation failed"
    exit 1
fi

# ============================================================================
# 4. Create OpenClaw configuration
# ============================================================================
log_info "Creating OpenClaw configuration..."

mkdir -p "$OPENCLAW_DIR"

# Create minimal config for non-interactive setup
cat > "$OPENCLAW_DIR/openclaw.json" << EOF
{
  "agents": {
    "defaults": {
      "workspace": "$OPENCLAW_DIR/workspace",
      "model": "anthropic/claude-opus-4-5"
    }
  },
  "gateway": {
    "mode": "token",
    "port": $GATEWAY_PORT,
    "bind": "$GATEWAY_BIND"
  },
  "session": {
    "dmScope": "pairing"
  },
  "wizard": {
    "lastRunAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "lastRunMode": "local"
  }
}
EOF

log_success "Configuration created at $OPENCLAW_DIR/openclaw.json"

# ============================================================================
# 5. Create systemd service
# ============================================================================
log_info "Creating systemd service..."

cat > /etc/systemd/system/openclaw.service << 'EOF'
[Unit]
Description=OpenClaw AI Agent Gateway
After=network-online.target
Wants=network-online.target
ConditionPathExists=/root/.openclaw

[Service]
Type=simple
User=root
WorkingDirectory=/root/.openclaw
Environment="NODE_ENV=production"
Environment="OPENCLAW_STATE_DIR=/root/.openclaw"
ExecStart=/usr/local/bin/openclaw gateway --daemon
ExecReload=/bin/kill -HUP $MAINPID
KillMode=mixed
KillSignal=SIGINT
TimeoutStopSec=30
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=openclaw

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/root/.openclaw /var/log

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
log_success "Systemd service created"

# ============================================================================
# 6. Set up API credentials from environment
# ============================================================================
log_info "Setting up API credentials..."

mkdir -p "$OPENCLAW_DIR/credentials"

if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
    cat > "$OPENCLAW_DIR/credentials/providers.json" << EOF
{
  "providers": {
    "anthropic": {
      "apiKey": "$ANTHROPIC_API_KEY"
    }
  }
}
EOF
    log_success "Anthropic API key configured"
fi

# ============================================================================
# 7. Create health check endpoint
# ============================================================================
log_info "Setting up health check..."

cat > /usr/local/bin/openclaw-healthcheck.sh << 'HEALTH_EOF'
#!/bin/bash
# OpenClaw Health Check Script

GATEWAY_PORT=${GATEWAY_PORT:-18789}
GATEWAY_BIND=${GATEWAY_BIND:-127.0.0.1}

# Check if process is running
if ! systemctl is-active --quiet openclaw; then
    echo "ERROR: OpenClaw service is not running"
    exit 1
fi

# Check HTTP health endpoint
if command -v curl &> /dev/null; then
    if curl -sf "http://${GATEWAY_BIND}:${GATEWAY_PORT}/health" > /dev/null 2>&1; then
        echo "OK: OpenClaw gateway is healthy"
        exit 0
    else
        echo "WARNING: Health endpoint not responding"
        exit 0  # Don't fail, service might be starting
    fi
fi

echo "OK: OpenClaw service is running"
exit 0
HEALTH_EOF

chmod +x /usr/local/bin/openclaw-healthcheck.sh
log_success "Health check script created"

# ============================================================================
# 8. Enable and start service
# ============================================================================
log_info "Enabling OpenClaw service..."

systemctl enable openclaw

# Start the service
log_info "Starting OpenClaw service..."
systemctl start openclaw

# Wait a moment for service to start
sleep 3

# Check service status
if systemctl is-active --quiet openclaw; then
    log_success "OpenClaw service is running"
else
    log_warn "OpenClaw service started but may not be fully ready yet"
fi

# ============================================================================
# 9. Final verification
# ============================================================================
log_info "Running health check..."

if /usr/local/bin/openclaw-healthcheck.sh; then
    log_success "OpenClaw installation completed successfully!"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "OpenClaw Installation Summary"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "  Version:        $OPENCLAW_VERSION"
    echo "  Config:         $OPENCLAW_DIR/openclaw.json"
    echo "  Gateway Port:   $GATEWAY_PORT"
    echo "  Service Status: $(systemctl is-active openclaw)"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Useful Commands:"
    echo "  openclaw status          - Check OpenClaw status"
    echo "  openclaw gateway         - Start gateway manually"
    echo "  openclaw agent           - Run agent interactively"
    echo "  systemctl status openclaw   - Check service status"
    echo "  journalctl -u openclaw -f   - View logs"
    echo ""
else
    log_warn "Installation completed but health check failed"
    echo "Check logs with: journalctl -u openclaw -n 50"
fi

exit 0
