#!/bin/bash
# Simple production deployment for MiniClaw API

set -e

DROPLET_IP="137.184.20.158"
DROPLET_USER="root"
APP_DIR="/opt/miniclaw-api"

echo "🚀 Deploying MiniClaw API to Production..."
echo "=========================================="

# Step 1: Create deployment package locally
echo "[1/5] Creating deployment package..."
cd /Users/ghost-m4/Desktop/miniclaw-cc

# Build shared package
cd packages/shared
pnpm build
cd ../..

# Copy needed files to a temp directory
rm -rf /tmp/miniclaw-deploy
mkdir -p /tmp/miniclaw-deploy/apps/api
mkdir -p /tmp/miniclaw-deploy/packages

cp -r packages/shared/dist /tmp/miniclaw-deploy/packages/shared
cp -r packages/shared/package.json /tmp/miniclaw-deploy/packages/shared/

cp -r apps/api/src /tmp/miniclaw-deploy/apps/api/
cp -r apps/api/package.json /tmp/miniclaw-deploy/apps/api/
cp -r apps/api/tsconfig.json /tmp/miniclaw-deploy/apps/api/

echo "✅ Deployment package created"

# Step 2: Upload to droplet
echo "[2/5] Uploading to droplet..."
rsync -avz --delete \
  -e "ssh -o StrictHostKeyChecking=no" \
  /tmp/miniclaw-deploy/ \
  ${DROPLET_USER}@${DROPLET_IP}:${APP_DIR}/

echo "✅ Upload complete"

# Step 3: Install dependencies on droplet
echo "[3/5] Installing dependencies..."
ssh -o StrictHostKeyChecking=no ${DROPLET_USER}@${DROPLET_IP} bash << 'ENDSSH'
cd /opt/miniclaw-api
export PATH=/root/.local/share/pnpm:$PATH
pnpm install --filter @miniclaw/api
ENDSSH

echo "✅ Dependencies installed"

# Step 4: Setup workspace symlinks
echo "[4/5] Setting up workspace packages..."
ssh -o StrictHostKeyChecking=no ${DROPLET_USER}@${DROPLET_IP} bash << 'ENDSSH'
cd /opt/miniclaw-api

# Create node_modules/@miniclaw structure
rm -rf apps/api/node_modules/@miniclaw
mkdir -p apps/api/node_modules/@miniclaw

# Copy built shared package
cp -r packages/shared apps/api/node_modules/@miniclaw/
echo '{"name":"@miniclaw/shared","type":"module","main":"./dist/index.js"}' > apps/api/node_modules/@miniclaw/shared/package.json

# For config, we need to use source since it's not built
mkdir -p apps/api/node_modules/@miniclaw/config
cp -r packages/config/src/* apps/api/node_modules/@miniclaw/config/
echo '{"name":"@miniclaw/config","type":"module","main":"./index.ts"}' > apps/api/node_modules/@miniclaw/config/package.json

echo "✅ Workspace configured"
ENDSSH

# Step 5: Restart API
echo "[5/5] Starting API..."
ssh -o StrictHostKeyChecking=no ${DROPLET_USER}@${DROPLET_IP} bash << 'ENDSSH'
cd /opt/miniclaw-api
pm2 restart miniclaw-api || pm2 start 'npx tsx apps/api/src/index.ts' --name miniclaw-api
sleep 10
curl -s http://localhost:4000/health && echo "" && echo "✅ API is healthy!" || echo "❌ API not responding"
pm2 logs miniclaw-api --lines 30 --nostream
ENDSSH

echo ""
echo "=========================================="
echo "🎉 Deployment Complete!"
echo ""
echo "API URL: http://${DROPLET_IP}:4000"
echo "SSH: ssh ${DROPLET_USER}@${DROPLET_IP}"
echo ""
