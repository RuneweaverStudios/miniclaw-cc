#!/bin/bash
################################################################################
# Miniclaw Health Check Script
# This script checks the health of OpenClaw and Nanobot services
################################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
OPENCLAW_SERVICE="openclaw"
NANOBOT_SERVICE="nanobot"
OPENCLAW_PORT="${OPENCLAW_PORT:-3000}"
NANOBOT_PORT="${NANOBOT_PORT:-8000}"
OPENCLAW_HEALTH_URL="http://localhost:${OPENCLAW_PORT}/health"
NANOBOT_HEALTH_URL="http://localhost:${NANOBOT_PORT}/health"

# Exit codes
EXIT_OK=0
EXIT_WARNING=1
EXIT_CRITICAL=2
EXIT_UNKNOWN=3

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Print usage
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Health check script for Miniclaw services (OpenClaw and Nanobot)

OPTIONS:
    -s, --service SERVICE    Check specific service (openclaw|nanobot|all)
    -p, --process-only       Only check process status
    -h, --http-only          Only check HTTP endpoints
    -d, --docker             Check Docker containers
    -v, --verbose            Enable verbose output
    -q, --quiet              Quiet mode (only show errors)
    --help                   Display this help message

EXAMPLES:
    $0                       # Check all services
    $0 -s openclaw          # Check only OpenClaw
    $0 -s nanobot -v        # Check Nanobot with verbose output
    $0 --docker             # Check Docker containers

EXIT CODES:
    0 - All checks passed
    1 - One or more warnings
    2 - One or more critical errors
    3 - Unknown error

EOF
}

# Parse command line arguments
parse_args() {
    SERVICE="all"
    CHECK_PROCESS=true
    CHECK_HTTP=true
    CHECK_DOCKER=false
    VERBOSE=false
    QUIET=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            -s|--service)
                SERVICE="$2"
                shift 2
                ;;
            -p|--process-only)
                CHECK_HTTP=false
                shift
                ;;
            -h|--http-only)
                CHECK_PROCESS=false
                shift
                ;;
            -d|--docker)
                CHECK_DOCKER=true
                shift
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -q|--quiet)
                QUIET=true
                shift
                ;;
            --help)
                usage
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                usage
                exit $EXIT_UNKNOWN
                ;;
        esac
    done
}

# Check if a service is running
check_service_process() {
    local service=$1
    local status=0

    if ! $QUIET; then
        log_info "Checking $service service process..."
    fi

    if systemctl is-active --quiet "$service.service"; then
        if ! $QUIET; then
            log_success "$service service is running"
        fi
        return 0
    else
        log_error "$service service is not running"
        return $EXIT_CRITICAL
    fi
}

# Check HTTP health endpoint
check_http_endpoint() {
    local service_name=$1
    local url=$2
    local timeout=5

    if ! $QUIET; then
        log_info "Checking $service_name HTTP endpoint: $url"
    fi

    local response
    response=$(curl -sf -m "$timeout" "$url" 2>&1) || {
        log_error "$service_name health endpoint is not responding (URL: $url)"
        return $EXIT_CRITICAL
    }

    # Try to parse JSON response
    if echo "$response" | python3 -m json.tool > /dev/null 2>&1; then
        if ! $QUIET; then
            log_success "$service_name health endpoint is responding"
        fi

        if $VERBOSE; then
            echo "$response" | python3 -m json.tool
        fi
        return 0
    else
        log_warn "$service_name health endpoint returned invalid JSON"
        if $VERBOSE; then
            echo "$response"
        fi
        return $EXIT_WARNING
    fi
}

# Check Docker containers
check_docker_containers() {
    if ! $QUIET; then
        log_info "Checking Docker containers..."
    fi

    # Check if Docker is running
    if ! systemctl is-active --quiet docker.service; then
        log_error "Docker service is not running"
        return $EXIT_CRITICAL
    fi

    if ! $QUIET; then
        log_success "Docker service is running"
    fi

    # Check for Miniclaw containers
    local containers
    containers=$(docker ps --filter "name=openclaw" --filter "name=nanobot" --format "{{.Names}}")

    if [[ -n "$containers" ]]; then
        if ! $QUIET; then
            log_success "Found Miniclaw containers:"
            echo "$containers"
        fi
        return 0
    else
        log_warn "No Miniclaw containers found running"
        return $EXIT_WARNING
    fi
}

# Check OpenClaw specifically
check_openclaw() {
    local exit_code=0

    if ! $QUIET; then
        echo "=========================================="
        echo "Checking OpenClaw Service"
        echo "=========================================="
    fi

    if $CHECK_PROCESS; then
        check_service_process "$OPENCLAW_SERVICE" || exit_code=$?
    fi

    if $CHECK_HTTP; then
        check_http_endpoint "OpenClaw" "$OPENCLAW_HEALTH_URL" || {
            local ret=$?
            if [[ $ret -gt $exit_code ]]; then
                exit_code=$ret
            fi
        }
    fi

    return $exit_code
}

# Check Nanobot specifically
check_nanobot() {
    local exit_code=0

    if ! $QUIET; then
        echo "=========================================="
        echo "Checking Nanobot Service"
        echo "=========================================="
    fi

    if $CHECK_PROCESS; then
        check_service_process "$NANOBOT_SERVICE" || exit_code=$?
    fi

    if $CHECK_HTTP; then
        check_http_endpoint "Nanobot" "$NANOBOT_HEALTH_URL" || {
            local ret=$?
            if [[ $ret -gt $exit_code ]]; then
                exit_code=$ret
            fi
        }
    fi

    return $exit_code
}

# Check system resources
check_system_resources() {
    if ! $QUIET; then
        echo "=========================================="
        echo "System Resources"
        echo "=========================================="
    fi

    # CPU usage
    local cpu_usage
    cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    if ! $QUIET; then
        log_info "CPU Usage: ${cpu_usage}%"
    fi

    # Memory usage
    local mem_info
    mem_info=$(free | grep Mem)
    local total_mem=$(echo "$mem_info" | awk '{print $2}')
    local used_mem=$(echo "$mem_info" | awk '{print $3}')
    local mem_percent=$((used_mem * 100 / total_mem))

    if ! $QUIET; then
        log_info "Memory Usage: ${mem_percent}%"
    fi

    if [[ $mem_percent -gt 90 ]]; then
        log_warn "High memory usage: ${mem_percent}%"
        return $EXIT_WARNING
    fi

    # Disk usage
    local disk_usage
    disk_usage=$(df -h / | tail -1 | awk '{print $5}' | cut -d'%' -f1)
    if ! $QUIET; then
        log_info "Disk Usage: ${disk_usage}%"
    fi

    if [[ $disk_usage -gt 90 ]]; then
        log_warn "High disk usage: ${disk_usage}%"
        return $EXIT_WARNING
    fi

    if ! $QUIET; then
        log_success "System resources OK"
    fi

    return 0
}

# Main health check function
main() {
    parse_args "$@"

    if ! $QUIET; then
        echo "=========================================="
        echo "Miniclaw Health Check"
        echo "=========================================="
        echo "Time: $(date)"
        echo "=========================================="
        echo
    fi

    local exit_code=0

    # Check system resources
    check_system_resources || {
        local ret=$?
        if [[ $ret -gt $exit_code ]]; then
            exit_code=$ret
        fi
    }
    echo

    # Check Docker if requested
    if $CHECK_DOCKER; then
        check_docker_containers || {
            local ret=$?
            if [[ $ret -gt $exit_code ]]; then
                exit_code=$ret
            fi
        }
        echo
    fi

    # Check services based on selection
    case "$SERVICE" in
        openclaw)
            check_openclaw || exit_code=$?
            ;;
        nanobot)
            check_nanobot || exit_code=$?
            ;;
        all)
            check_openclaw || {
                local ret=$?
                if [[ $ret -gt $exit_code ]]; then
                    exit_code=$ret
                fi
            }
            echo
            check_nanobot || {
                local ret=$?
                if [[ $ret -gt $exit_code ]]; then
                    exit_code=$ret
                fi
            }
            ;;
        *)
            log_error "Unknown service: $SERVICE"
            exit $EXIT_UNKNOWN
            ;;
    esac

    # Print summary
    if ! $QUIET; then
        echo
        echo "=========================================="
        echo "Health Check Summary"
        echo "=========================================="
        if [[ $exit_code -eq 0 ]]; then
            log_success "All health checks passed"
        elif [[ $exit_code -eq 1 ]]; then
            log_warn "Health check completed with warnings"
        else
            log_error "Health check failed with errors"
        fi
        echo "=========================================="
    fi

    exit $exit_code
}

# Run main function
main "$@"
