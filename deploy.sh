#!/usr/bin/env bash
set -euo pipefail

###############################################################################
# Red Door Club - Deployment Script
#
# Run ON the server (inside the project directory).
#
# Usage:
#   First time:    ./deploy.sh --setup
#   Update:        ./deploy.sh
#   Full rebuild:  ./deploy.sh --build
#   Stop:          ./deploy.sh --stop
#   Status:        ./deploy.sh --status
#   Logs:          ./deploy.sh --logs
#   Migrations:    ./deploy.sh --migrate
#
# One-liner from local machine:
#   git push && ssh s8lls@ubuntu-16gb-hel1-2 'cd ~/red-door-club && ./deploy.sh'
#
# First-time setup from local machine:
#   git push && ssh s8lls@ubuntu-16gb-hel1-2 \
#     'git clone https://github.com/mateusz-kacpura/red-door-club.git ~/red-door-club \
#      && cd ~/red-door-club && ./deploy.sh --setup'
###############################################################################

COMPOSE_FILE="docker-compose.server.yml"
BRANCH="main"

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${GREEN}>>>${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
step()  { echo -e "\n${CYAN}=== $1 ===${NC}"; }

# --- Prerequisites ---
check_prerequisites() {
    command -v docker >/dev/null 2>&1 || error "Docker is not installed"
    docker compose version >/dev/null 2>&1 || error "Docker Compose v2 is not installed"
    command -v git >/dev/null 2>&1 || error "Git is not installed"
    command -v openssl >/dev/null 2>&1 || error "OpenSSL is not installed"
}

# --- Parse arguments ---
ACTION="deploy"
while [[ $# -gt 0 ]]; do
    case $1 in
        --setup)   ACTION="setup";   shift ;;
        --build)   ACTION="build";   shift ;;
        --logs)    ACTION="logs";    shift ;;
        --stop)    ACTION="stop";    shift ;;
        --status)  ACTION="status";  shift ;;
        --migrate) ACTION="migrate"; shift ;;
        -h|--help)
            echo "Usage: ./deploy.sh [--setup|--build|--stop|--status|--logs|--migrate|-h]"
            echo ""
            echo "  (no flag)   Pull latest code, rebuild changed images, restart, migrate"
            echo "  --setup     First-time setup: generate .env, full build, migrate"
            echo "  --build     Full rebuild without Docker cache"
            echo "  --stop      Stop all services"
            echo "  --status    Show service status"
            echo "  --logs      Tail service logs (Ctrl+C to stop)"
            echo "  --migrate   Run database migrations only"
            exit 0
            ;;
        *) error "Unknown option: $1. Use -h for help." ;;
    esac
done

# --- Simple commands (no prerequisites check needed beyond docker) ---
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

case "$ACTION" in
    stop)
        step "Stopping services"
        docker compose -f "$COMPOSE_FILE" down
        info "All services stopped"
        exit 0
        ;;
    status)
        docker compose -f "$COMPOSE_FILE" ps
        exit 0
        ;;
    logs)
        docker compose -f "$COMPOSE_FILE" logs -f --tail=100
        exit 0
        ;;
    migrate)
        step "Running database migrations"
        docker compose -f "$COMPOSE_FILE" exec -T app alembic upgrade head
        info "Migrations applied"
        exit 0
        ;;
esac

# --- Full deploy flow ---
check_prerequisites

# === SETUP: generate .env ===
if [[ "$ACTION" == "setup" ]]; then
    step "First-time setup"

    if [[ ! -f "$APP_DIR/.env" ]]; then
        info "Generating production .env file..."

        PG_PASS="$(openssl rand -base64 32 | tr -d '=/+')"
        REDIS_PASS="$(openssl rand -base64 32 | tr -d '=/+')"
        JWT_SECRET="$(openssl rand -hex 32)"

        cat > "$APP_DIR/.env" << EOF
# ===========================================
# Red Door Club — Production (.env)
# Generated: $(date -Iseconds)
# ===========================================

# App
ENVIRONMENT=production
PROJECT_NAME=red_door
DEBUG=false

# PostgreSQL
POSTGRES_HOST=db
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=${PG_PASS}
POSTGRES_DB=red_door

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=${REDIS_PASS}

# Auth / JWT
SECRET_KEY=${JWT_SECRET}
ACCESS_TOKEN_EXPIRE_MINUTES=10080
ALGORITHM=HS256

# CORS
CORS_ORIGINS=["https://club.s8lls.com"]
EOF

        info "Created .env with auto-generated secrets"
        warn "Review and adjust if needed: $APP_DIR/.env"
    else
        warn ".env already exists — skipping generation"
    fi

    # Setup continues with a full (no-cache) build
    ACTION="build"
fi

# === Check .env ===
[[ -f "$APP_DIR/.env" ]] || error ".env not found. Run './deploy.sh --setup' first."

# === Pull latest code ===
step "Pulling latest code"
git fetch origin "$BRANCH"
LOCAL_HEAD="$(git rev-parse HEAD)"
REMOTE_HEAD="$(git rev-parse "origin/$BRANCH")"

if [[ "$LOCAL_HEAD" == "$REMOTE_HEAD" && "$ACTION" != "build" ]]; then
    info "Already up to date (${LOCAL_HEAD:0:7})"
else
    git reset --hard "origin/$BRANCH"
    info "Updated to $(git log -1 --format='%h — %s')"
fi

# === Build ===
step "Building containers"
if [[ "$ACTION" == "build" ]]; then
    info "Full rebuild (no cache)..."
    docker compose -f "$COMPOSE_FILE" build --no-cache
else
    docker compose -f "$COMPOSE_FILE" build
fi

# === Start services ===
step "Starting services"
docker compose -f "$COMPOSE_FILE" up -d

# === Wait for database ===
step "Waiting for database"
for i in $(seq 1 30); do
    if docker compose -f "$COMPOSE_FILE" exec -T db pg_isready -U postgres >/dev/null 2>&1; then
        info "Database ready"
        break
    fi
    if [[ "$i" -eq 30 ]]; then
        error "Database not ready after 30 seconds. Check: ./deploy.sh --logs"
    fi
    sleep 1
done

# === Run migrations ===
step "Running database migrations"
docker compose -f "$COMPOSE_FILE" exec -T app alembic upgrade head
info "Migrations applied"

# === Clean up old images ===
docker image prune -f >/dev/null 2>&1 || true

# === Final status ===
step "Deployment complete"
docker compose -f "$COMPOSE_FILE" ps
echo ""
info "Application live at: https://club.s8lls.com"
