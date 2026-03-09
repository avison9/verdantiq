# VerdantIQ

**VerdantIQ** is a real-time precision agriculture platform for monitoring soil health, optimising irrigation, and predicting crop needs through sensor, satellite, and market data.

---

## Features

- Real-time soil sensor ingestion via IoT/MQTT
- Weather and satellite NDVI data processing
- Predictive ML for moisture, disease, and yield forecasting
- Multi-tenant SaaS — each farm organisation is fully isolated
- Star-schema data warehouse (Apache Iceberg)
- Dashboards via Grafana / Apache Superset

---

## Architecture

VerdantIQ is a **microservice architecture** split across three independent domains:

```
Internet → Nginx Gateway (port 8000)
               ├── /register, /login, /logout, /users  → Auth Service   (8001)
               ├── /billings                            → Tenant Service (8002)
               └── /sensors                             → Sensor Service (8003)

Sensor Service ──(httpx)──► Tenant Service  (internal billing mutations)
All services   ──(shared JWT)──► PostgreSQL (single shared DB, isolated by tenant_id)
```

Data Services runs independently and connects to the same network:

```
IoT Devices → MQTT → Kafka → Spark Streaming → Iceberg (MinIO) → Trino → Frontend
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **API Gateway** | Nginx |
| **Backend services** | FastAPI, Python 3.13, SQLAlchemy 2, PostgreSQL 15 |
| **Auth** | PyJWT, pwdlib (bcrypt), httponly cookies |
| **Inter-service** | httpx (async HTTP calls) |
| **Ingestion** | Kafka 7.4, Zookeeper, Schema Registry, Avro |
| **Streaming ETL** | Apache Spark 3.5 Structured Streaming |
| **Storage** | MinIO (S3-compatible), Apache Iceberg |
| **Query** | Trino |
| **Frontend** | React 19, TypeScript, Vite, TailwindCSS, Redux Toolkit |
| **Monitoring** | Prometheus, Grafana |
| **Package management** | uv (Python), npm (frontend) |

---

## Getting Started

### Prerequisites

| Tool | Version | Install |
|---|---|---|
| Docker Desktop | ≥ 4.x | [docs.docker.com](https://docs.docker.com/get-docker/) |
| Node.js | ≥ 20 | [nodejs.org](https://nodejs.org/) |
| Make | any | Ships with macOS/Linux; Windows: use WSL2 |
| curl | any | Ships with macOS/Linux/WSL2 |

> **Windows users:** all `make` commands should be run inside **WSL2**.

---

### One-command setup

```bash
git clone https://github.com/avison9/verdantiq
cd verdantiq
make setup
```

`make setup` will:
1. Install **uv** (Python package manager) if not already present
2. Run `uv sync` for each backend service (auth, tenant, sensor)
3. Run `npm ci` for the frontend
4. Copy `.env.example` → `.env` (skips if already exists)
5. Install **pre-commit** and register git hooks

After setup, open `.env` and fill in any secrets marked `change-me-in-production`.

---

### Start the development stack

Start only what you need — each domain can run independently:

```bash
# Backend API services + PostgreSQL only (fastest for API work)
make dev-backend

# Data pipeline — Kafka + Spark + MinIO + Iceberg
make dev-dataservices

# Observability — Prometheus + Grafana
make dev-monitor

# Backend (detached) + Vite frontend dev server
make dev-frontend

# Full stack — everything
make dev
```

#### Service URLs

| Service | URL | Profile |
|---|---|---|
| API Gateway (Swagger) | http://localhost:8000/docs | backend |
| Auth Service | http://localhost:8001/docs | backend |
| Tenant Service | http://localhost:8002/docs | backend |
| Sensor Service | http://localhost:8003/docs | backend |
| Frontend (dev server) | http://localhost:5173 | — |
| Kafka Schema Registry | http://localhost:8089 | dataservices |
| Spark Master UI | http://localhost:8080 | dataservices |
| MinIO Console | http://localhost:9001 | dataservices |
| Iceberg REST Catalog | http://localhost:8181 | dataservices |
| Prometheus | http://localhost:9090 | monitor |
| Grafana | http://localhost:3000 | monitor |

---

### Run tests

```bash
# All unit tests (auth + tenant + sensor + frontend)
make test

# Per-service backend tests
make test-auth
make test-tenant
make test-sensor

# Frontend (lint + tsc — vitest suite added in Phase 2)
make test-frontend

# Infrastructure integration tests (spins up postgres + test container)
make test-infra
```

---

### Lint and format

```bash
# Check everything (ruff + mypy across all services, eslint + tsc)
make lint

# Auto-fix Python formatting across all services
make format
```

Pre-commit hooks run the same checks automatically on every `git commit`.

---

### Other useful commands

```bash
make build               # Build all Docker images
make build-backend       # Build backend service images only
make build-dataservices  # Build data service images only

make clean               # Stop all containers and remove volumes
make clean-backend       # Stop backend containers only
make clean-dataservices  # Stop data service containers only

make logs                # Tail all logs
make logs-backend        # Tail auth + tenant + sensor + gateway logs
make logs-dataservices   # Tail data pipeline logs
make logs-auth           # Tail auth service logs only
make logs-tenant         # Tail tenant service logs only
make logs-sensor         # Tail sensor service logs only

make shell-auth          # Open shell in the auth container
make shell-tenant        # Open shell in the tenant container
make shell-sensor        # Open shell in the sensor container
make shell-db            # Open psql in the Postgres container

make lock                # Regenerate uv.lock files after editing pyproject.toml
make update-deps         # Upgrade all dependencies (Python + npm)
make help                # List all available commands with descriptions
```

---

## Project Structure

```
verdantiq/
├── Makefile                        # Single-command interface for all developer tasks
├── .pre-commit-config.yaml         # Git hooks: ruff, mypy, eslint, gitleaks
├── docker-compose.yml              # Root orchestrator (includes backend + data-services)
├── .env.example                    # Environment variable template
│
├── backend/                        # API microservices
│   ├── docker-compose.yml          # Backend-only compose (--profile backend)
│   │
│   ├── gateway/                    # Nginx API gateway
│   │   ├── nginx.conf              # Routing rules + /internal/ block
│   │   └── Dockerfile
│   │
│   ├── services/
│   │   ├── auth/                   # Auth Service — port 8001
│   │   │   ├── pyproject.toml      # Python 3.13 deps (pwdlib, PyJWT, FastAPI)
│   │   │   ├── main.py             # /register /login /logout /users/me
│   │   │   ├── models.py           # Tenant, User, Session, UserProfile, Role
│   │   │   ├── schemas.py
│   │   │   ├── crud.py
│   │   │   ├── authenticate.py     # Password hashing + JWT creation/validation
│   │   │   ├── configs.py          # pydantic-settings (reads .env)
│   │   │   ├── db_config.py        # Table creation on startup
│   │   │   ├── start.sh
│   │   │   └── Dockerfile
│   │   │
│   │   ├── tenant/                 # Tenant Service — port 8002
│   │   │   ├── pyproject.toml
│   │   │   ├── main.py             # /billings/ + /internal/* routes
│   │   │   ├── models.py           # Billing, MLFeatureSubscription
│   │   │   ├── schemas.py
│   │   │   ├── crud.py
│   │   │   ├── authenticate.py     # JWT decode only
│   │   │   ├── configs.py
│   │   │   ├── db_config.py
│   │   │   ├── start.sh
│   │   │   └── Dockerfile
│   │   │
│   │   └── sensor/                 # Sensor Service — port 8003
│   │       ├── pyproject.toml
│   │       ├── main.py             # /sensors/ + httpx calls to tenant service
│   │       ├── models.py           # Sensor
│   │       ├── schemas.py
│   │       ├── crud.py
│   │       ├── authenticate.py     # JWT decode only
│   │       ├── configs.py          # Includes TENANT_SERVICE_URL
│   │       ├── db_config.py
│   │       ├── start.sh
│   │       └── Dockerfile
│   │
│   └── test-infra/                 # Integration test runner container
│
├── data-services/                  # Data pipeline and observability
│   ├── docker-compose.yml          # Data-only compose (--profile dataservices/monitor)
│   │
│   ├── kafka/                      # Kafka brokers + Zookeeper + Schema Registry
│   │   ├── zookeeper/
│   │   ├── schema-registry/
│   │   ├── exporter/               # kafka-exporter for Prometheus metrics
│   │   └── kafka_utils/            # Topic creation scripts, zkok healthcheck
│   │
│   ├── spark/                      # Spark master + worker
│   │   ├── Dockerfile.spark
│   │   ├── spark-entrypoint.sh
│   │   ├── bronze_job.py           # Kafka → Iceberg streaming job
│   │   ├── metrics.properties
│   │   └── config/
│   │
│   ├── iceberg/                    # Iceberg REST catalog
│   │   └── Dockerfile.iceberg
│   │
│   ├── hive/                       # Hive metastore (optional)
│   │
│   ├── prometheus/                 # Prometheus config + alerting rules
│   │   ├── prometheus.yml
│   │   └── rules.yml
│   │
│   ├── grafana/                    # Grafana dashboards + datasource config
│   │   ├── conf/
│   │   └── dashboard/
│   │
│   └── iot/                        # IoT device simulator
│       └── simulator/
│
├── frontend/                       # React 19 + TypeScript SPA
│   ├── package.json
│   └── src/
│       ├── redux/                  # RTK Query API slices + auth state
│       ├── pages/                  # Route-level page components
│       └── components/             # Shared UI components
│
└── .github/
    └── workflows/
        └── test_infrastructure.yml # CI: backend-test, frontend-test, infra-test
```

---

## Environment Variables

Copy `.env.example` to `.env` at the project root. Key variables:

| Variable | Description | Default |
|---|---|---|
| `POSTGRES_DB` | Database name | `verdantiq` |
| `POSTGRES_USER` | Database user | `admin` |
| `POSTGRES_PASSWORD` | Database password | — |
| `SECRET_KEY` | JWT signing secret (shared by all services) | — |
| `ALGORITHM` | JWT algorithm | `HS256` |
| `TENANT_SERVICE_URL` | Sensor → Tenant inter-service URL | `http://tenant:8002` |
| `MINIO_ROOT_USER` | MinIO admin username | `admin` |
| `MINIO_ROOT_PASSWORD` | MinIO admin password | — |
| `GRAFANA_ADMIN_USER` | Grafana admin username | `admin` |
| `GRAFANA_ADMIN_PASSWORD` | Grafana admin password | — |

Generate a secure `SECRET_KEY`:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

---

## CI Pipeline

Three parallel jobs run on every pull request:

| Job | What it checks | When |
|---|---|---|
| `backend-test` | pytest + coverage (≥80%) | Every PR + push |
| `frontend-test` | tsc + eslint | Every PR + push |
| `infra-test` | Full docker-compose stack | Push to master only |

---

## License

VerdantIQ is a private project. All rights reserved. Not for public or commercial use.
