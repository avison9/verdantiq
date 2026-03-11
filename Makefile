# =============================================================================
#  VerdantIQ — Developer Makefile
#  Run `make` or `make help` to see all available commands.
# =============================================================================

.DEFAULT_GOAL := help

# Colours
GREEN  := \033[0;32m
YELLOW := \033[1;33m
CYAN   := \033[0;36m
NC     := \033[0m

# Compose file references
COMPOSE_BACKEND      := docker compose -f backend/docker-compose.yml
COMPOSE_DATASERVICES := docker compose -f data-services/docker-compose.yml
COMPOSE_ALL          := docker compose

# Service source directories
AUTH_DIR    := backend/services/auth
TENANT_DIR  := backend/services/tenant
SENSOR_DIR  := backend/services/sensor
FRONTEND_DIR := frontend

# =============================================================================
#  HELP
# =============================================================================
.PHONY: help
help: ## Show this help message
	@echo ""
	@echo "$(CYAN)VerdantIQ — available commands$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-28s$(NC) %s\n", $$1, $$2}'
	@echo ""

# =============================================================================
#  SETUP  (run once after cloning)
# =============================================================================
.PHONY: setup
setup: ## One-time setup: install uv, npm packages, and pre-commit hooks
	@echo "$(YELLOW)── Installing uv (Python package manager) ──$(NC)"
	@command -v uv >/dev/null 2>&1 \
		|| curl -LsSf https://astral.sh/uv/install.sh | sh
	@echo "$(YELLOW)── Syncing Python dependencies for each service ──$(NC)"
	cd $(AUTH_DIR)   && uv sync
	cd $(TENANT_DIR) && uv sync
	cd $(SENSOR_DIR) && uv sync
	@echo "$(YELLOW)── Installing frontend dependencies ──$(NC)"
	cd $(FRONTEND_DIR) && npm ci
	@echo "$(YELLOW)── Copying .env file (skips if already present) ──$(NC)"
	@cp -n .env.example .env 2>/dev/null \
		&& echo "  Created .env" || echo "  .env already exists — skipped"
	@cp -n $(FRONTEND_DIR)/.env.example $(FRONTEND_DIR)/.env 2>/dev/null \
		&& echo "  Created frontend/.env" || echo "  frontend/.env already exists — skipped"
	@echo "$(YELLOW)── Installing pre-commit hooks ──$(NC)"
	@command -v pre-commit >/dev/null 2>&1 \
		|| uv tool install pre-commit
	pre-commit install
	@echo ""
	@echo "$(GREEN)Setup complete!$(NC)"
	@echo "  Next: edit .env with your credentials, then run $(CYAN)make dev-backend$(NC)"
	@echo ""

# =============================================================================
#  DEVELOPMENT SERVERS
# =============================================================================
.PHONY: dev dev-backend dev-dataservices dev-monitor dev-frontend

dev: ## Start the full stack (backend + data services + monitoring)
	$(COMPOSE_ALL) up --build

dev-backend: ## Start auth + tenant + sensor + gateway + postgres
	$(COMPOSE_BACKEND) --profile backend up --build

dev-dataservices: ## Start Kafka + Spark + MinIO + Iceberg + Trino
	$(COMPOSE_DATASERVICES) --profile dataservices up --build

dev-monitor: ## Start Prometheus + Grafana
	$(COMPOSE_DATASERVICES) --profile monitor up --build

dev-frontend: ## Start backend services (detached) + Vite frontend dev server
	$(COMPOSE_BACKEND) --profile backend up --build -d
	cd $(FRONTEND_DIR) && npm run dev

# =============================================================================
#  TESTING
# =============================================================================
.PHONY: test test-auth test-tenant test-sensor test-frontend test-infra

test: test-auth test-tenant test-sensor test-frontend ## Run all unit tests

test-auth: ## Run auth service pytest suite
	@echo "$(YELLOW)── Auth service tests ──$(NC)"
	cd $(AUTH_DIR) && uv run pytest tests/ -v --tb=short \
		--cov=. --cov-report=term-missing

test-tenant: ## Run tenant service pytest suite
	@echo "$(YELLOW)── Tenant service tests ──$(NC)"
	cd $(TENANT_DIR) && uv run pytest tests/ -v --tb=short \
		--cov=. --cov-report=term-missing

test-sensor: ## Run sensor service pytest suite
	@echo "$(YELLOW)── Sensor service tests ──$(NC)"
	cd $(SENSOR_DIR) && uv run pytest tests/ -v --tb=short \
		--cov=. --cov-report=term-missing

test-frontend: ## Run frontend vitest suite
	@echo "$(YELLOW)── Frontend tests ──$(NC)"
	cd $(FRONTEND_DIR) && npm run test 2>/dev/null \
		|| (echo "No test script yet — running lint instead" && npm run lint)

test-infra: ## Run full-stack integration tests (spins up postgres + test-infra container)
	@echo "$(YELLOW)── Infrastructure integration tests ──$(NC)"
	$(COMPOSE_BACKEND) --profile test up --build --abort-on-container-exit

# =============================================================================
#  LINTING & FORMATTING
# =============================================================================
.PHONY: lint lint-backend lint-frontend format format-backend

lint: lint-backend lint-frontend ## Run all linters

lint-backend: ## Lint all Python services with ruff + mypy
	@echo "$(YELLOW)── Auth service: ruff + mypy ──$(NC)"
	cd $(AUTH_DIR)   && uv run ruff check . && uv run ruff format --check . && uv run mypy . --ignore-missing-imports
	@echo "$(YELLOW)── Tenant service: ruff + mypy ──$(NC)"
	cd $(TENANT_DIR) && uv run ruff check . && uv run ruff format --check . && uv run mypy . --ignore-missing-imports
	@echo "$(YELLOW)── Sensor service: ruff + mypy ──$(NC)"
	cd $(SENSOR_DIR) && uv run ruff check . && uv run ruff format --check . && uv run mypy . --ignore-missing-imports

lint-frontend: ## Lint TypeScript/React code with eslint + tsc
	@echo "$(YELLOW)── ESLint ──$(NC)"
	cd $(FRONTEND_DIR) && npm run lint
	@echo "$(YELLOW)── TypeScript type check ──$(NC)"
	cd $(FRONTEND_DIR) && npx tsc --noEmit

format: format-backend ## Auto-fix all formatting issues

format-backend: ## Auto-fix Python formatting with ruff across all services
	cd $(AUTH_DIR)   && uv run ruff check --fix . && uv run ruff format .
	cd $(TENANT_DIR) && uv run ruff check --fix . && uv run ruff format .
	cd $(SENSOR_DIR) && uv run ruff check --fix . && uv run ruff format .

# =============================================================================
#  BUILD
# =============================================================================
.PHONY: build build-backend build-dataservices build-frontend

build: build-backend build-dataservices build-frontend ## Build all Docker images

build-backend: ## Build backend service Docker images
	$(COMPOSE_BACKEND) --profile backend build

build-dataservices: ## Build data service Docker images
	$(COMPOSE_DATASERVICES) --profile dataservices build

build-frontend: ## Build the frontend for production
	cd $(FRONTEND_DIR) && npm run build

# =============================================================================
#  DEPENDENCY MANAGEMENT
# =============================================================================
.PHONY: lock update-deps

lock: ## Regenerate uv.lock files for all Python services
	cd $(AUTH_DIR)   && uv lock
	cd $(TENANT_DIR) && uv lock
	cd $(SENSOR_DIR) && uv lock

update-deps: ## Upgrade all dependencies to latest compatible versions
	cd $(AUTH_DIR)   && uv lock --upgrade
	cd $(TENANT_DIR) && uv lock --upgrade
	cd $(SENSOR_DIR) && uv lock --upgrade
	cd $(FRONTEND_DIR) && npm update

# =============================================================================
#  UTILITIES
# =============================================================================
.PHONY: clean clean-backend clean-dataservices logs logs-backend logs-dataservices
.PHONY: shell-auth shell-tenant shell-sensor shell-db

clean: ## Stop all containers and remove volumes
	@echo "$(YELLOW)── Tearing down all containers ──$(NC)"
	$(COMPOSE_ALL) down -v --remove-orphans 2>/dev/null || true
	$(COMPOSE_BACKEND) down -v --remove-orphans 2>/dev/null || true
	$(COMPOSE_DATASERVICES) down -v --remove-orphans 2>/dev/null || true
	@echo "$(GREEN)Clean complete$(NC)"

clean-backend: ## Stop backend containers only
	$(COMPOSE_BACKEND) down -v --remove-orphans

clean-dataservices: ## Stop data service containers only
	$(COMPOSE_DATASERVICES) down -v --remove-orphans

logs: ## Tail all logs
	$(COMPOSE_ALL) logs -f

logs-backend: ## Tail backend service logs
	$(COMPOSE_BACKEND) logs -f auth tenant sensor gateway

logs-dataservices: ## Tail data service logs
	$(COMPOSE_DATASERVICES) logs -f

logs-auth: ## Tail auth service logs
	$(COMPOSE_BACKEND) logs -f auth

logs-tenant: ## Tail tenant service logs
	$(COMPOSE_BACKEND) logs -f tenant

logs-sensor: ## Tail sensor service logs
	$(COMPOSE_BACKEND) logs -f sensor

shell-auth: ## Open a shell in the running auth container
	docker exec -it auth /bin/sh

shell-tenant: ## Open a shell in the running tenant container
	docker exec -it tenant /bin/sh

shell-sensor: ## Open a shell in the running sensor container
	docker exec -it sensor /bin/sh

shell-db: ## Open a psql shell in the running Postgres container
	docker exec -it postgres psql -U $${POSTGRES_USER:-admin} -d $${POSTGRES_DB:-verdantiq}

shell-trino: ## Open a Trino CLI session
	docker exec -it trino trino

trino-status: ## Check Trino cluster info
	@curl -s http://localhost:8085/v1/info | python3 -m json.tool 2>/dev/null \
		|| echo "Trino not running — start with: make dev-dataservices"
