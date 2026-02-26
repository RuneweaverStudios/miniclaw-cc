#!/bin/sh
################################################################################
# Startup script for Worker with local Redis instance
# This script starts Redis and then the worker process
################################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "${GREEN}[INFO]${NC} Starting Miniclaw Worker with local Redis..."

# Start Redis in background
echo "${GREEN}[INFO]${NC} Starting Redis server..."
redis-server --daemonize yes --port 6379

# Wait for Redis to be ready
echo "${GREEN}[INFO]${NC} Waiting for Redis to be ready..."
until redis-cli -h localhost -p 6379 ping > /dev/null 2>&1; do
    echo "${YELLOW}[WARN]${NC} Redis is not ready yet, waiting..."
    sleep 1
done

echo "${GREEN}[INFO]${NC} Redis is ready!"

# Start the worker
echo "${GREEN}[INFO]${NC} Starting Worker process..."
exec node /app/packages/worker/dist/index.js
