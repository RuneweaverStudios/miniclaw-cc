#!/bin/bash
################################################################################
# Nanobot Installation Script
# This script installs Nanobot and sets it up as a systemd service
################################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
NANOBOT_USER="nanobot"
NANOBOT_DIR="/opt/nanobot"
NANOBOT_PORT="${NANOBOT_PORT:-8000}"
LOG_FILE="/var/log/miniclaw/nanobot.log"
SERVICE_FILE="/etc/systemd/system/nanobot.service"
HEALTH_CHECK_ENDPOINT="http://localhost:${NANOBOT_PORT}/health"
PYTHON_VERSION="${PYTHON_VERSION:-3.11}"

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Error handler
error_exit() {
    log_error "$1"
    exit 1
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error_exit "This script must be run as root or with sudo"
    fi
}

# Check system prerequisites
check_prerequisites() {
    log_info "Checking system prerequisites..."

    # Check for Python 3
    if ! command -v python3 &> /dev/null; then
        log_error "Python 3 is not installed"
        apt-get update && apt-get install -y python3 python3-pip python3-venv
    fi

    # Check Python version
    local python_version=$(python3 --version | awk '{print $2}')
    log_info "Found Python version: $python_version"

    # Check for pip
    if ! command -v pip3 &> /dev/null; then
        log_warn "pip3 not found. Installing..."
        apt-get update && apt-get install -y python3-pip
    fi

    # Check for curl
    if ! command -v curl &> /dev/null; then
        apt-get update && apt-get install -y curl
    fi

    log_info "Prerequisites check complete"
}

# Create Nanobot user
create_user() {
    log_info "Creating Nanobot user..."

    if ! id "$NANOBOT_USER" &>/dev/null; then
        useradd -m -s /bin/bash -d "$NANOBOT_DIR" "$NANOBOT_USER"
        usermod -aG docker "$NANOBOT_USER"
        log_info "User $NANOBOT_USER created"
    else
        log_info "User $NANOBOT_USER already exists"
    fi

    # Create directories
    mkdir -p "$NANOBOT_DIR"
    mkdir -p "$NANOBOT_DIR/venv"
    mkdir -p /var/log/miniclaw
    chown -R "$NANOBOT_USER:$NANOBOT_USER" "$NANOBOT_DIR"
    chown "$NANOBOT_USER:$NANOBOT_USER" "$LOG_FILE"
}

# Create Python virtual environment
create_virtualenv() {
    log_info "Creating Python virtual environment..."

    cd "$NANOBOT_DIR" || error_exit "Cannot change to $NANOBOT_DIR"

    # Create virtual environment
    if [[ ! -d "$NANOBOT_DIR/venv" ]]; then
        su - "$NANOBOT_USER" -c "python3 -m venv $NANOBOT_DIR/venv"
        log_info "Virtual environment created"
    else
        log_info "Virtual environment already exists"
    fi
}

# Install Nanobot
install_nanobot() {
    log_info "Installing Nanobot..."

    cd "$NANOBOT_DIR" || error_exit "Cannot change to $NANOBOT_DIR"

    # Activate virtual environment and install
    su - "$NANOBOT_USER" -c "
        source $NANOBOT_DIR/venv/bin/activate &&
        pip install --upgrade pip setuptools wheel &&
        pip install nanobot-ai
    "

    if [[ $? -eq 0 ]]; then
        log_info "Nanobot installed successfully"
    else
        error_exit "Failed to install Nanobot"
    fi

    # Install additional dependencies
    su - "$NANOBOT_USER" -c "
        source $NANOBOT_DIR/venv/bin/activate &&
        pip install fastapi uvicorn[standard] pydantic python-multipart aiofiles
    "

    log_info "Additional dependencies installed"
}

# Configure Nanobot
configure_nanobot() {
    log_info "Configuring Nanobot..."

    # Create configuration directory
    mkdir -p "$NANOBOT_DIR/.config/nanobot"

    # Create environment file
    cat > "$NANOBOT_DIR/.env" << EOF
# Nanobot Configuration
PYTHONUNBUFFERED=1
NANOBOT_PORT=${NANOBOT_PORT}
NANOBOT_HOST=127.0.0.1
NANOBOT_LOG_LEVEL=info

# Paths
NANOBOT_HOME=$NANOBOT_DIR
NANOBOT_LOG_FILE=$LOG_FILE
NANOBOT_VENV=$NANOBOT_DIR/venv

# Health Check
HEALTH_CHECK_ENABLED=true
HEALTH_CHECK_PORT=${NANOBOT_PORT}
EOF

    chown "$NANOBOT_USER:$NANOBOT_USER" "$NANOBOT_DIR/.env"

    # Create Nanobot config file
    cat > "$NANOBOT_DIR/.config/nanobot/config.yaml" << EOF
# Nanobot Configuration
version: "1.0"

server:
  host: 127.0.0.1
  port: ${NANOBOT_PORT}
  workers: 4
  log_level: info

nanobot:
  model: default
  max_tokens: 4096
  temperature: 0.7

logging:
  file: $LOG_FILE
  level: info
  format: json
  rotation:
    max_size: 100MB
    backup_count: 10
EOF

    chown "$NANOBOT_USER:$NANOBOT_USER" "$NANOBOT_DIR/.config/nanobot/config.yaml"

    log_info "Configuration complete"
}

# Set up health check
setup_health_check() {
    log_info "Setting up health check..."

    cat > "$NANOBOT_DIR/health_check.py" << 'EOF'
#!/usr/bin/env python3
"""
Health check endpoint for Nanobot
"""
import os
import sys
import json
import psutil
import platform
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

PORT = int(os.environ.get('NANOBOT_PORT', 8000))


class HealthCheckHandler(BaseHTTPRequestHandler):
    """Health check request handler"""

    def do_GET(self):
        """Handle GET requests"""
        parsed_path = urlparse(self.path)

        if parsed_path.path == '/health':
            self.send_health_check()
        else:
            self.send_not_found()

    def send_health_check(self):
        """Send health check response"""
        health = {
            'status': 'healthy',
            'timestamp': datetime.utcnow().isoformat(),
            'service': 'nanobot',
            'version': '1.0.0',
            'system': {
                'platform': platform.system(),
                'platform_release': platform.release(),
                'platform_version': platform.version(),
                'architecture': platform.machine(),
                'processor': platform.processor(),
                'python_version': platform.python_version(),
            },
            'resources': {
                'cpu_percent': psutil.cpu_percent(interval=0.1),
                'memory': {
                    'total': psutil.virtual_memory().total,
                    'available': psutil.virtual_memory().available,
                    'percent': psutil.virtual_memory().percent,
                    'used': psutil.virtual_memory().used,
                    'free': psutil.virtual_memory().free,
                },
                'disk': {
                    'total': psutil.disk_usage('/').total,
                    'used': psutil.disk_usage('/').used,
                    'free': psutil.disk_usage('/').free,
                    'percent': psutil.disk_usage('/').percent,
                }
            },
            'process': {
                'pid': os.getpid(),
                'cwd': os.getcwd(),
            }
        }

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(health, indent=2).encode())

    def send_not_found(self):
        """Send 404 response"""
        self.send_response(404)
        self.send_header('Content-Type', 'text/plain')
        self.end_headers()
        self.wfile.write(b'Not Found')

    def log_message(self, format, *args):
        """Suppress default logging"""
        pass


def run_health_check_server():
    """Run the health check server"""
    server_address = ('127.0.0.1', PORT)
    httpd = HTTPServer(server_address, HealthCheckHandler)
    print(f"Health check server running on port {PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down health check server")
        httpd.shutdown()


if __name__ == '__main__':
    run_health_check_server()
EOF

    chmod +x "$NANOBOT_DIR/health_check.py"
    chown "$NANOBOT_USER:$NANOBOT_USER" "$NANOBOT_DIR/health_check.py"

    log_info "Health check configured"
}

# Create systemd service
create_systemd_service() {
    log_info "Creating systemd service..."

    cat > "$SERVICE_FILE" << EOF
[Unit]
Description=Nanobot AI Agent
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=$NANOBOT_USER
WorkingDirectory=$NANOBOT_DIR
Environment="PYTHONUNBUFFERED=1"
Environment="NANOBOT_PORT=${NANOBOT_PORT}"
EnvironmentFile=$NANOBOT_DIR/.env

# Restart configuration
Restart=always
RestartSec=10
StartLimitBurst=3
StartLimitInterval=60

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$NANOBOT_DIR /var/log/miniclaw

# Logging
StandardOutput=append:$LOG_FILE
StandardError=append:$LOG_FILE
SyslogIdentifier=nanobot

# Execution
ExecStartPre=/usr/bin/env bash -c 'test -f $NANOBOT_DIR/venv/bin/python || exit 1'
ExecStart=$NANOBOT_DIR/venv/bin/python -m nanobot
ExecStop=/bin/kill -SIGTERM \$MAINPID
ExecReload=/bin/kill -HUP \$MAINPID

# Health check
ExecStartPost=$NANOBOT_DIR/venv/bin/python $NANOBOT_DIR/health_check.py

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096
MemoryMax=2G
CPUQuota=200%

# Timeout settings
TimeoutStartSec=180
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
EOF

    # Reload systemd and enable service
    systemctl daemon-reload
    systemctl enable nanobot.service

    log_info "Systemd service created and enabled"
}

# Post-install verification
verify_installation() {
    log_info "Running post-install verification..."

    # Check if virtual environment exists
    if [[ -d "$NANOBOT_DIR/venv" ]]; then
        log_info "Virtual environment exists"
    else
        log_warn "Virtual environment not found"
    fi

    # Check if nanobot is installed
    if su - "$NANOBOT_USER" -c "source $NANOBOT_DIR/venv/bin/activate && pip show nanobot-ai" > /dev/null 2>&1; then
        log_info "Nanobot package is installed"
        su - "$NANOBOT_USER" -c "source $NANOBOT_DIR/venv/bin/activate && pip show nanobot-ai" | grep -E "^Name:|^Version:" || true
    else
        log_warn "Nanobot package not found"
    fi

    # Check configuration
    if [[ -f "$NANOBOT_DIR/.env" ]]; then
        log_info "Configuration file exists"
    else
        log_warn "Configuration file not found"
    fi

    # Check health check script
    if [[ -f "$NANOBOT_DIR/health_check.py" ]]; then
        log_info "Health check script exists"
    else
        log_warn "Health check script not found"
    fi

    log_info "Verification complete"
}

# Start Nanobot service
start_service() {
    log_info "Starting Nanobot service..."

    if systemctl start nanobot.service; then
        log_info "Nanobot service started successfully"
    else
        log_error "Failed to start Nanobot service"
        journalctl -u nanobot.service -n 50 --no-pager
        return 1
    fi

    # Wait for service to start
    sleep 5

    # Check service status
    if systemctl is-active --quiet nanobot.service; then
        log_info "Nanobot service is running"
    else
        log_error "Nanobot service failed to start"
        systemctl status nanobot.service --no-pager
        return 1
    fi
}

# Health check verification
verify_health_check() {
    log_info "Verifying health check endpoint..."

    local max_attempts=30
    local attempt=1

    while [[ $attempt -le $max_attempts ]]; do
        if curl -sf "$HEALTH_CHECK_ENDPOINT" > /dev/null 2>&1; then
            log_info "Health check endpoint is responding"
            curl -s "$HEALTH_CHECK_ENDPOINT" | python3 -m json.tool || true
            return 0
        fi

        log_warn "Health check not ready yet (attempt $attempt/$max_attempts)"
        sleep 2
        ((attempt++))
    done

    log_error "Health check endpoint failed to respond after $max_attempts attempts"
    return 1
}

# Display installation summary
show_summary() {
    log_info "=========================================="
    log_info "Nanobot Installation Summary"
    log_info "=========================================="
    log_info "Installation Directory: $NANOBOT_DIR"
    log_info "User: $NANOBOT_USER"
    log_info "Port: $NANOBOT_PORT"
    log_info "Log File: $LOG_FILE"
    log_info "Health Check: $HEALTH_CHECK_ENDPOINT"
    log_info ""
    log_info "Useful Commands:"
    log_info "  Status:   systemctl status nanobot"
    log_info "  Start:    systemctl start nanobot"
    log_info "  Stop:     systemctl stop nanobot"
    log_info "  Restart:  systemctl restart nanobot"
    log_info "  Logs:     journalctl -u nanobot -f"
    log_info "  Shell:    su - nanobot -c 'source /opt/nanobot/venv/bin/activate && nanobot'"
    log_info "=========================================="
}

# Main installation flow
main() {
    log_info "Starting Nanobot installation..."
    log_info "=========================================="

    check_root
    check_prerequisites
    create_user
    create_virtualenv
    install_nanobot
    configure_nanobot
    setup_health_check
    create_systemd_service
    verify_installation

    if start_service; then
        verify_health_check
        show_summary
        log_info "Nanobot installation completed successfully!"
        exit 0
    else
        log_error "Nanobot installation completed with errors"
        exit 1
    fi
}

# Run main function
main "$@"
