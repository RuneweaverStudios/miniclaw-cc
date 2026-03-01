#!/bin/bash
set -euo pipefail

# Deploy API to Production (DigitalOcean)
# This script creates/updates a droplet and deploys the API

echo "🚀 Deploying MiniClaw API to Production..."
echo "========================================"

# Configuration
DROPLET_NAME="miniclaw-api"
REGION="nyc1"
SIZE="s-2vcpu-4gb" # 2GB RAM, 2 vCPUs - good for API with Redis/DB connections
IMAGE="ubuntu-24-04-x64"
SSH_KEY_ID="54440239" # ghost-m4-mac SSH key ID
DOMAIN="api.miniclaw.xyz"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Check if doctl is installed
if ! command -v doctl &> /dev/null; then
    error "doctl not found. Install with: brew install doctl"
fi

# Check if authenticated
if ! doctl account get &> /dev/null; then
    error "Not authenticated. Run: doctl auth init"
fi

log "Authenticated with DigitalOcean"

# Step 1: Create or get droplet
log "Checking for existing droplet: ${DROPLET_NAME}"

if doctl compute droplet list | grep -q "${DROPLET_NAME}"; then
    log "Droplet ${DROPLET_NAME} already exists"
    DROPLET_IP=$(doctl compute droplet get ${DROPLET_NAME} --format PublicIPv4 --no-header)
else
    log "Creating new droplet: ${DROPLET_NAME}"

    # Create user data script for droplet initialization
    USER_DATA=$(cat <<'EOF'
#!/bin/bash
export DEBIAN_FRONTEND=noninteractive

# Update system
apt-get update -qq
apt-get upgrade -y -qq

# Install dependencies
apt-get install -y curl git nodejs npm postgresql-client redis-tools

# Install PM2 for process management
npm install -g pm2

# Install Docker (for Redis if needed)
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
usermod -aG docker ubuntu

# Configure firewall
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 4000/tcp
ufw --force enable

echo "✅ Droplet initialization complete"
EOF
)

    # Create droplet
    doctl compute droplet create ${DROPLET_NAME} \
        --region ${REGION} \
        --size ${SIZE} \
        --image ${IMAGE} \
        --ssh-keys ${SSH_KEY_ID} \
        --user-data "${USER_DATA}" \
        --enable-monitoring \
        --format ID,Name,PublicIPv4,Status

    # Wait for droplet to be active
    log "Waiting for droplet to become active..."
    sleep 30

    DROPLET_IP=$(doctl compute droplet get ${DROPLET_NAME} --format PublicIPv4 --no-header)

    # Wait for SSH to be available
    log "Waiting for SSH (this may take 1-2 minutes)..."
    for i in {1..30}; do
        if ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 root@${DROPLET_IP} "echo 'SSH is up'" &> /dev/null; then
            log "✅ SSH is available"
            break
        fi
        echo -n "."
        sleep 5
    done
    echo
fi

log "Droplet IP: ${DROPLET_IP}"

# Step 2: Deploy application
log "Deploying application to droplet..."

SSH_CMD="ssh -o StrictHostKeyChecking=no root@${DROPLET_IP}"

# Create deployment script on droplet
${SSH_CMD} <<'ENDSSH'
set -euo pipefail

# Create app directory
mkdir -p /opt/miniclaw-api
cd /opt/miniclaw-api

# Clone or update repo
if [ -d ".git" ]; then
    echo "Pulling latest code..."
    git pull
else
    echo "Cloning repository..."
    rm -rf temp
    git clone https://github.com/RuneweaverStudios/miniclaw-cc.git temp
    cp -r temp/* temp/.[!.]* . 2>/dev/null || true
    rm -rf temp
fi

# Install dependencies
echo "Installing dependencies..."
curl -fsSL https://get.pnpm.io/install.sh | sh -
export PATH="/root/.local/share/pnpm:$PATH"
pnpm install --filter @miniclaw/api

# Copy environment file
echo "Setting up environment..."
cat > .env <<'ENVEOF'
NODE_ENV=production
PORT=4000
LOG_LEVEL=info

# Redis (local)
REDIS_HOST=localhost
REDIS_PORT=6379

# PostgreSQL - UPDATE THIS
DATABASE_URL=postgresql://...

# DigitalOcean
DIGITALOCEAN_TOKEN=YOUR_DIGITALOCEAN_TOKEN

# OpenRouter
OPENROUTER_API_KEY=YOUR_OPENROUTER_API_KEY

# JWT
JWT_SECRET=YOUR_JWT_SECRET
JWT_EXPIRY=7d

# OAuth
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET

# Stripe
STRIPE_SECRET_KEY=YOUR_STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET=YOUR_STRIPE_WEBHOOK_SECRET

# Frontend
FRONTEND_URL=https://miniclaw.xyz
API_URL=https://api.miniclaw.xyz

# SSH - UPDATE THIS
# SSH_PRIVATE_KEY_PATH=/path/to/key

# Pool
POOL_TARGET_SIZE=10
POOL_MIN_SIZE=4
POOL_MAX_SIZE=20
POOL_HEALTH_CHECK_INTERVAL=30000
ENVEOF

# Setup SSH key for droplet connections
echo "Setting up SSH key..."
mkdir -p /root/.ssh
# You'll need to add your private key here

# Start Redis with Docker
echo "Starting Redis..."
docker run -d \
    --name redis \
    --restart unless-stopped \
    -p 6379:6379 \
    redis:alpine

# Install PM2 if not present
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi

# Start application with PM2
echo "Starting application..."
pm2 delete miniclaw-api 2>/dev/null || true
pm2 start "npx tsx src/index.ts" --name miniclaw-api --cwd /opt/miniclaw-api/apps/api
pm2 save
pm2 startup systemd -u root --hp /root

echo "✅ Deployment complete!"
ENDSSH

# Step 3: Setup domain (if configured)
if [ -n "${DOMAIN:-}" ]; then
    log "Setting up domain: ${DOMAIN}"

    # Get domain and subdomain
    if [[ ${DOMAIN} == *"."*"."* ]]; then
        SUBDOMAIN=$(echo ${DOMAIN} | cut -d. -f1)
        DOMAIN=$(echo ${DOMAIN} | cut -d. -f2-)

        # Check if domain exists in DNS
        if ! doctl compute domain list | grep -q "^${DOMAIN}"; then
            warn "Domain ${DOMAIN} not found in DigitalOcean DNS"
            warn "You'll need to add DNS record manually:"
            warn "  Subdomain: ${SUBDOMAIN}"
            warn "  Target IP: ${DROPLET_IP}"
        else
            # Create A record
            doctl compute domain records create ${DOMAIN} \
                --type A \
                --name ${SUBDOMAIN} \
                --data ${DROPLET_IP} \
                --ttl 300

            log "✅ DNS record created: ${SUBDOMAIN}.${DOMAIN} -> ${DROPLET_IP}"
        fi
    fi
fi

# Step 4: Configure Cloudflare (if using)
log "Note: If using Cloudflare, update your DNS to point to:"
log "  ${DOMAIN} -> ${DROPLET_IP}"
log ""
log "And update SSL/TLS in Cloudflare dashboard."

echo ""
echo "========================================"
log "🎉 Deployment Complete!"
echo ""
log "Droplet: ${DROPLET_NAME}"
log "IP: ${DROPLET_IP}"
log "Domain: ${DOMAIN:-"Not configured"}"
log ""
log "SSH into droplet:"
log "  ssh root@${DROPLET_IP}"
log ""
log "View logs:"
log "  ssh root@${DROPLET_IP} 'pm2 logs miniclaw-api'"
log ""
log "API will be available at:"
log "  http://${DROPLET_IP}:4000"
log "  https://${DOMAIN:-"domain-not-configured"}"
echo "========================================"
